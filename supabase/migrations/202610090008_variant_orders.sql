begin;
create or replace function public.gd_create_order(p_request jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); rid uuid; existing public.gd_orders;
  cfg public.gd_shop; delivery public.gd_shipping; product public.gd_products;
  line jsonb; lines jsonb := '[]'; seen text[] := '{}'; qty integer; pid integer; vid integer; item_key text; unit_price integer; variant public.gd_product_variants;
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
    if jsonb_typeof(line->'id') is distinct from 'number' or jsonb_typeof(line->'quantity') is distinct from 'number' or line->>'id' !~ '^\d+$' or line->>'quantity' !~ '^\d+$' then raise exception 'INVALID_ITEMS'; end if;
    pid := (line->>'id')::integer; qty := (line->>'quantity')::integer; vid := null;
    if line ? 'variantId' and line->'variantId' <> 'null'::jsonb then
      if jsonb_typeof(line->'variantId') is distinct from 'number' or line->>'variantId' !~ '^[1-9]\d*$' then raise exception 'INVALID_ITEMS'; end if;
      vid := (line->>'variantId')::integer;
    end if;
    item_key := pid::text || ':' || coalesce(vid::text,'base');
    if item_key=any(seen) or qty not between 1 and 20 then raise exception 'INVALID_ITEMS'; end if;
    seen := array_append(seen,item_key);
    select * into product from public.gd_products where id=pid and active for share;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    unit_price := product.price;
    if vid is not null then
      select * into variant from public.gd_product_variants where id=vid and product_id=pid and active for share;
      if not found then raise exception 'VARIANT_UNAVAILABLE'; end if;
      unit_price := variant.price;
    end if;
    amount := amount + unit_price::bigint * qty;
    lines := lines || jsonb_build_array(jsonb_build_object('id',product.id,'name',product.name,'price',unit_price,'quantity',qty,'image',product.image,'occasion',product.occasion)
      || case when vid is not null then jsonb_build_object('variantId',variant.id,'sku',variant.sku,'sizeName',variant.size_name) else '{}'::jsonb end);
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
alter table public.gd_memories add column flower_metadata jsonb not null default '{}' check(jsonb_typeof(flower_metadata)='object');
create function gd_private.memory_flower_metadata() returns trigger language plpgsql security definer set search_path='' as $$
declare flower jsonb;
begin
  if tg_op='INSERT' then
    select items->0 into flower from public.gd_orders where id=new.order_id;
    new.flower_metadata := jsonb_strip_nulls(jsonb_build_object('productId',flower->'id','occasion',flower->'occasion',
      'variantId',flower->'variantId','sku',flower->'sku','sizeName',flower->'sizeName'));
  elsif new.flower_metadata is distinct from old.flower_metadata then raise exception 'MEMORY_METADATA_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.memory_flower_metadata() from public,anon,authenticated;
create trigger memory_flower_metadata before insert or update on public.gd_memories for each row execute function gd_private.memory_flower_metadata();
create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),'productVariants',true,'variantOrders',true))
  from gd_private.runtime where id=1;
$$;
commit;
