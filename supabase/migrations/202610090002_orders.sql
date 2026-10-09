begin;
create function public.gd_create_order(p_request jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); rid uuid; existing public.gd_orders;
  cfg public.gd_shop; delivery public.gd_shipping; product public.gd_products;
  line jsonb; lines jsonb := '[]'; seen integer[] := '{}'; qty integer; pid integer;
  amount bigint := 0; day date; phone text; message text; name text; address text; pay text;
  result public.gd_orders; body_hash text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_request) <> 'object' or length(p_request::text)>16000 or p_request->>'website' <> '' then raise exception 'INVALID_ORDER'; end if;
  rid := (p_request->>'requestId')::uuid;
  if rid is null or p_request->>'requestId' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then raise exception 'INVALID_REQUEST_ID'; end if;
  -- Serialize retries of one intent before checking/inserting. Never trust submitted price/total.
  perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
  body_hash := encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
  select * into existing from public.gd_orders where id=rid;
  if found then
    if existing.owner_id <> uid or existing.request_body->>'hash' <> body_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(existing) - 'request_body';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('customer:'||uid::text,0));
  if (select count(*) from public.gd_orders where owner_id=uid and created_at>now()-interval '10 minutes')>=5
    or (select count(*) from public.gd_orders where owner_id=uid and created_at>now()-interval '1 day')>=30 then raise exception 'ORDER_RATE_LIMIT'; end if;
  select * into cfg from public.gd_shop where id=1 for share;
  if not cfg.accepting_orders then raise exception 'SHOP_CLOSED'; end if;
  if p_request->'consent' is distinct from 'true'::jsonb then raise exception 'CONSENT_REQUIRED'; end if;
  name := trim(p_request->>'name'); address := trim(p_request->>'address'); message := coalesce(trim(p_request->>'message'),'');
  phone := regexp_replace(p_request->>'phone','[\s().-]','','g');
  if name is null or length(name) not between 2 and 80 or address is null or length(address) not between 10 and 300 or length(message)>500 or phone is null or phone !~ '^(0|\+84)[35789][0-9]{8}$' then raise exception 'INVALID_CONTACT'; end if;
  if p_request->>'deliveryDate' is null or p_request->>'deliveryDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_DATE'; end if;
  day := (p_request->>'deliveryDate')::date;
  if day < (now() at time zone 'Asia/Ho_Chi_Minh')::date or day > (now() at time zone 'Asia/Ho_Chi_Minh')::date+90 then raise exception 'INVALID_DATE'; end if;
  if p_request->>'deliveryTime' is null or p_request->>'deliveryTime' not in ('Sáng · 9–12h','Chiều · 13–17h','Tối · 18–20h') then raise exception 'INVALID_TIME'; end if;
  select * into delivery from public.gd_shipping where id=(p_request->>'shippingId')::uuid and active for share;
  if not found then raise exception 'SHIPPING_UNAVAILABLE'; end if;
  if jsonb_typeof(p_request->'items') is distinct from 'array' or jsonb_array_length(p_request->'items') not between 1 and 20 then raise exception 'INVALID_ITEMS'; end if;
  for line in select value from jsonb_array_elements(p_request->'items') loop
    if jsonb_typeof(line->'id') <> 'number' or jsonb_typeof(line->'quantity') <> 'number' or line->>'id' !~ '^\d+$' or line->>'quantity' !~ '^\d+$' then raise exception 'INVALID_ITEMS'; end if;
    pid := (line->>'id')::integer; qty := (line->>'quantity')::integer;
    if pid=any(seen) or qty not between 1 and 20 then raise exception 'INVALID_ITEMS'; end if;
    seen := array_append(seen,pid);
    select * into product from public.gd_products where id=pid and active for share;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    amount := amount + product.price::bigint * qty;
    lines := lines || jsonb_build_array(jsonb_build_object('id',product.id,'name',product.name,'price',product.price,'quantity',qty,'image',product.image));
  end loop;
  if jsonb_typeof(p_request->'expectedTotal') is distinct from 'number' or p_request->>'expectedTotal' !~ '^\d+$' or (p_request->>'expectedTotal')::bigint <> amount+delivery.fee then raise exception 'PRICE_CHANGED'; end if;
  pay := p_request->>'paymentMethod';
  if pay is null or pay not in ('COD','VIETQR') or (pay='COD' and not cfg.cod_enabled) or (pay='VIETQR' and not cfg.transfer_enabled) then raise exception 'PAYMENT_UNAVAILABLE'; end if;
  insert into public.gd_orders(id,owner_id,reference,request_body,recipient_name,recipient_phone,address,card_message,delivery_date,delivery_time,items,subtotal,shipping,total,payment_method,bank)
  values(rid,uid,'GD-'||upper(substr(replace(rid::text,'-',''),1,16)),jsonb_build_object('hash',body_hash),name,phone,address,message,day,p_request->>'deliveryTime',lines,amount,
    jsonb_build_object('id',delivery.id,'name',delivery.name,'area',delivery.area,'fee',delivery.fee),amount+delivery.fee,pay,
    case when pay='VIETQR' then jsonb_build_object('bin',cfg.bank_bin,'account',cfg.bank_account,'bankName',cfg.bank_name,'accountName',cfg.account_name) end)
  returning * into result;
  insert into public.gd_order_events(order_id,actor_id,event) values(rid,uid,'Đã tạo yêu cầu đặt hoa');
  return to_jsonb(result) - 'request_body';
end;
$$;
revoke execute on function public.gd_create_order(jsonb) from public,anon;
grant execute on function public.gd_create_order(jsonb) to authenticated;

create function public.gd_update_order(p_id uuid,p_version integer,p_status text,p_payment text,p_note text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current public.gd_orders; first_flower jsonb;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if length(coalesce(p_note,''))>500 then raise exception 'INVALID_NOTE'; end if;
  select * into current from public.gd_orders where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if current.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_status is null or p_payment is null then raise exception 'INVALID_STATUS'; end if;
  if p_status<>current.status and not (
    (current.status='PENDING' and p_status in ('CONFIRMED','CANCELLED')) or
    (current.status='CONFIRMED' and p_status in ('PREPARING','CANCELLED')) or
    (current.status='PREPARING' and p_status in ('SHIPPING','CANCELLED')) or
    (current.status='SHIPPING' and p_status in ('DELIVERED','CANCELLED'))
  ) then raise exception 'INVALID_TRANSITION'; end if;
  if p_payment<>current.payment_status then
    if not ((current.payment_status='UNPAID' and p_payment='PAID' and p_status<>'CANCELLED') or (current.payment_status='PAID' and p_payment='REFUNDED')) then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
    if length(trim(coalesce(p_note,'')))<5 then raise exception 'PAYMENT_EVIDENCE_REQUIRED'; end if;
  end if;
  update public.gd_orders set status=p_status,payment_status=p_payment,version=version+1,updated_at=now() where id=p_id returning * into current;
  insert into public.gd_order_events(order_id,actor_id,event,note) values(p_id,auth.uid(),p_status||' · '||p_payment,coalesce(trim(p_note),''));
  if p_status='DELIVERED' and p_payment='PAID' then
    first_flower := current.items->0;
    insert into public.gd_memories(order_id,owner_id,flower_name,flower_image)
      values(p_id,current.owner_id,first_flower->>'name',first_flower->>'image') on conflict(order_id) do nothing;
  end if;
  if p_payment='REFUNDED' or p_status='CANCELLED' then
    update public.gd_memories set share_token=null,listed=false,revoked=true where order_id=p_id;
  end if;
  return to_jsonb(current) - 'request_body';
end;
$$;
revoke execute on function public.gd_update_order(uuid,integer,text,text,text) from public,anon;
grant execute on function public.gd_update_order(uuid,integer,text,text,text) to authenticated;

create function public.gd_share_memory(p_id uuid,p_visibility text,p_signature text default '') returns jsonb language plpgsql security definer set search_path = '' as $$
declare memory public.gd_memories; card text; result public.gd_memories;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into memory from public.gd_memories where id=p_id and owner_id=auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_visibility is null or p_visibility not in ('PRIVATE','LINK','GARDEN') or length(coalesce(p_signature,''))>80 then raise exception 'INVALID_SHARING'; end if;
  if p_visibility='PRIVATE' then
    update public.gd_memories set share_token=null,listed=false,message='',signature='' where id=p_id returning * into result;
  else
    select o.card_message into card from public.gd_orders o where o.id=memory.order_id and o.status='DELIVERED' and o.payment_status='PAID';
    if not found or memory.revoked or length(trim(card))=0 then raise exception 'MEMORY_UNAVAILABLE'; end if;
    update public.gd_memories set message=card,signature=coalesce(trim(p_signature),''),share_token=coalesce(share_token,gen_random_uuid()),listed=(p_visibility='GARDEN') where id=p_id returning * into result;
  end if;
  return to_jsonb(result);
end;
$$;
revoke execute on function public.gd_share_memory(uuid,text,text) from public,anon;
grant execute on function public.gd_share_memory(uuid,text,text) to authenticated;

create function public.gd_public_memory(p_token uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('token',share_token,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at)
    from public.gd_memories where share_token=p_token and not revoked;
$$;
create function public.gd_garden(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 24) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('token',share_token,'id',id,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at) order by created_at desc,id desc),'[]'::jsonb)
  from (select * from public.gd_memories where listed and not revoked
    and (p_before is null or (created_at,id) < (p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by created_at desc,id desc limit greatest(1,least(coalesce(p_limit,24),48))) m;
$$;
revoke execute on function public.gd_public_memory(uuid),public.gd_garden(timestamptz,uuid,integer) from public;
grant execute on function public.gd_public_memory(uuid),public.gd_garden(timestamptz,uuid,integer) to anon,authenticated;

create function public.gd_memory_count() returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from public.gd_memories where not revoked;
$$;
revoke execute on function public.gd_memory_count() from public;
grant execute on function public.gd_memory_count() to anon,authenticated;

-- Run daily using Supabase Cron; only the database owner can invoke this retention job.
create function public.gd_expire_contacts() returns bigint language plpgsql security definer set search_path = '' as $$
declare affected bigint;
begin
  update public.gd_orders set recipient_name=null,recipient_phone=null,address=null,contacts_erased_at=now()
    where status in ('DELIVERED','CANCELLED') and updated_at<now()-interval '90 days' and contacts_erased_at is null;
  get diagnostics affected=row_count; return affected;
end;
$$;
revoke execute on function public.gd_expire_contacts() from public,anon,authenticated;
commit;
