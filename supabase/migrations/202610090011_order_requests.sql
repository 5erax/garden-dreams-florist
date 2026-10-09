begin;
create table public.gd_order_requests (
  id uuid primary key,
  order_id uuid not null references public.gd_orders(id),
  owner_id uuid not null references auth.users(id),
  kind text not null check(kind in ('CANCEL','CONTACT')),
  body jsonb not null,
  body_hash text not null,
  order_version integer not null,
  status text not null default 'OPEN' check(status in ('OPEN','ACCEPTED','REJECTED','WITHDRAWN')),
  version integer not null default 1,
  response text not null default '',
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index gd_one_open_order_request on public.gd_order_requests(order_id) where status='OPEN';
create index gd_request_order_history on public.gd_order_requests(order_id,created_at desc,id desc);
create index gd_request_work_queue on public.gd_order_requests(status,created_at,id);
create index gd_requests_owner_rate on public.gd_order_requests(owner_id,created_at desc);
alter table public.gd_order_requests enable row level security;
revoke all on public.gd_order_requests from public,anon,authenticated;
grant select(id,order_id,owner_id,kind,body,order_version,status,version,response,created_at,processed_at)
  on public.gd_order_requests to authenticated;
create policy request_owner_or_admin on public.gd_order_requests for select to authenticated
  using(owner_id=auth.uid() or gd_private.is_admin());

create function gd_private.request_view(p_row public.gd_order_requests) returns jsonb
language sql immutable set search_path='' as $$
  select to_jsonb(p_row)-'body_hash'-'resolved_by';
$$;
revoke execute on function gd_private.request_view(public.gd_order_requests) from public,anon,authenticated;

create function public.gd_request_order_change(p_id uuid,p_order uuid,p_version integer,p_kind text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  customer uuid:=auth.uid(); current_order public.gd_orders;
  existing public.gd_order_requests; saved public.gd_order_requests;
  fingerprint text; v_name text; v_phone text; v_address text; v_reason text;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_id is null or p_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    or p_kind is null or p_kind not in ('CANCEL','CONTACT')
    or p_version is null or p_version<1 or jsonb_typeof(p_body) is distinct from 'object'
    or length(p_body::text)>4000 then raise exception 'INVALID_ORDER_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended('order-request:'||p_id::text,0));
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('order',p_order,'version',p_version,'kind',p_kind,'body',p_body)::text,'UTF8')),'hex');
  select * into existing from public.gd_order_requests where id=p_id;
  if found then
    if existing.owner_id<>customer or existing.body_hash<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return gd_private.request_view(existing);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('customer:'||customer::text,0));
  select * into current_order from public.gd_orders where id=p_order and owner_id=customer for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if current_order.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if current_order.status not in ('PENDING','CONFIRMED') or current_order.contacts_erased_at is not null
    then raise exception 'REQUEST_TOO_LATE'; end if;
  if exists(select 1 from public.gd_order_requests where order_id=p_order and status='OPEN')
    then raise exception 'REQUEST_ALREADY_OPEN'; end if;
  if (select count(*) from public.gd_order_requests where owner_id=customer and created_at>now()-interval '1 hour')>=10
    then raise exception 'REQUEST_RATE_LIMIT'; end if;
  v_reason:=trim(p_body->>'reason');
  if jsonb_typeof(p_body->'reason') is distinct from 'string' or length(v_reason) not between 5 and 500
    then raise exception 'INVALID_ORDER_REQUEST'; end if;
  if p_kind='CONTACT' then
    v_name:=trim(p_body->>'name'); v_address:=trim(p_body->>'address');
    v_phone:=regexp_replace(p_body->>'phone','[\s().-]','','g');
    if jsonb_typeof(p_body->'name') is distinct from 'string' or length(v_name) not between 2 and 80
      or jsonb_typeof(p_body->'address') is distinct from 'string' or length(v_address) not between 10 and 300
      or jsonb_typeof(p_body->'phone') is distinct from 'string' or v_phone !~ '^(0|\+84)[35789][0-9]{8}$'
      or p_body - array['name','phone','address','reason'] <> '{}'::jsonb
      then raise exception 'INVALID_CONTACT'; end if;
    if v_address is distinct from current_order.address then raise exception 'ADDRESS_REQUOTE_REQUIRED'; end if;
  elsif p_body-'reason'<>'{}'::jsonb then raise exception 'INVALID_ORDER_REQUEST'; end if;
  insert into public.gd_order_requests(id,order_id,owner_id,kind,body,body_hash,order_version)
    values(p_id,p_order,customer,p_kind,p_body,fingerprint,p_version) returning * into saved;
  insert into public.gd_order_events(order_id,actor_id,event)
    values(p_order,customer,case p_kind when 'CANCEL' then 'Khách gửi yêu cầu hủy' else 'Khách gửi yêu cầu đổi người nhận' end);
  return gd_private.request_view(saved);
end;
$$;
revoke execute on function public.gd_request_order_change(uuid,uuid,integer,text,jsonb) from public,anon;
grant execute on function public.gd_request_order_change(uuid,uuid,integer,text,jsonb) to authenticated;

create function public.gd_withdraw_order_request(p_id uuid,p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry public.gd_order_requests; oid uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select order_id into oid from public.gd_order_requests where id=p_id and owner_id=auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
  perform 1 from public.gd_orders where id=oid for update;
  select * into entry from public.gd_order_requests where id=p_id and owner_id=auth.uid() for update;
  if entry.status='WITHDRAWN' and entry.version=p_version+1 then return gd_private.request_view(entry); end if;
  if entry.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
  if entry.status<>'OPEN' then raise exception 'REQUEST_ALREADY_PROCESSED'; end if;
  update public.gd_order_requests set status='WITHDRAWN',version=version+1,processed_at=now()
    where id=p_id returning * into entry;
  insert into public.gd_order_events(order_id,actor_id,event) values(oid,auth.uid(),'Khách rút yêu cầu thay đổi');
  return gd_private.request_view(entry);
end;
$$;
revoke execute on function public.gd_withdraw_order_request(uuid,integer) from public,anon;
grant execute on function public.gd_withdraw_order_request(uuid,integer) to authenticated;

create function public.gd_resolve_order_request(p_id uuid,p_version integer,p_accept boolean,p_response text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  entry public.gd_order_requests; current_order public.gd_orders; oid uuid;
  decision text:=case when p_accept then 'ACCEPTED' else 'REJECTED' end;
  reply text:=trim(p_response); before_state jsonb;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_accept is null or reply is null or length(reply) not between 5 and 500
    or p_version is null or p_version<1 then raise exception 'INVALID_ORDER_REQUEST'; end if;
  select order_id into oid from public.gd_order_requests where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into current_order from public.gd_orders where id=oid for update;
  select * into entry from public.gd_order_requests where id=p_id for update;
  if entry.status=decision and entry.version=p_version+1 and entry.resolved_by=auth.uid() and entry.response=reply
    then return jsonb_build_object('request',gd_private.request_view(entry),'order',to_jsonb(current_order)-'request_body'); end if;
  if entry.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if entry.status<>'OPEN' then raise exception 'REQUEST_ALREADY_PROCESSED'; end if;
  before_state:=jsonb_build_object('requestId',entry.id,'orderId',oid,'version',current_order.version,
    'status',current_order.status,'paymentStatus',current_order.payment_status,'requestStatus',entry.status);
  if p_accept then
    if current_order.status not in ('PENDING','CONFIRMED') or current_order.contacts_erased_at is not null
      then raise exception 'REQUEST_TOO_LATE'; end if;
    if entry.kind='CANCEL' then
      perform public.gd_update_order(oid,current_order.version,'CANCELLED',current_order.payment_status,'Chấp thuận yêu cầu hủy '||entry.id::text);
      select * into current_order from public.gd_orders where id=oid;
    else
      if trim(entry.body->>'address') is distinct from current_order.address then raise exception 'ADDRESS_REQUOTE_REQUIRED'; end if;
      update public.gd_orders set recipient_name=trim(entry.body->>'name'),
        recipient_phone=regexp_replace(entry.body->>'phone','[\s().-]','','g'),address=trim(entry.body->>'address'),
        version=version+1,updated_at=now() where id=oid returning * into current_order;
    end if;
  end if;
  update public.gd_order_requests set status=decision,response=reply,resolved_by=auth.uid(),
    version=version+1,processed_at=now() where id=p_id returning * into entry;
  insert into public.gd_admin_audit(actor_id,entity,entity_id,action,before_data,after_data)
    values(auth.uid(),'gd_order_requests',entry.id::text,decision,before_state,
      jsonb_build_object('requestId',entry.id,'orderId',oid,'version',current_order.version,'status',current_order.status,
        'paymentStatus',current_order.payment_status,'requestStatus',decision,
        'changedFields',case when p_accept and entry.kind='CONTACT' then jsonb_build_array('recipient_name','recipient_phone')
          when p_accept then jsonb_build_array('status') else '[]'::jsonb end));
  insert into public.gd_order_events(order_id,actor_id,event,note) values(oid,auth.uid(),
    case when p_accept then 'Shop đồng ý yêu cầu thay đổi' else 'Shop từ chối yêu cầu thay đổi' end,'Yêu cầu '||entry.id::text);
  return jsonb_build_object('request',gd_private.request_view(entry),'order',to_jsonb(current_order)-'request_body');
end;
$$;
revoke execute on function public.gd_resolve_order_request(uuid,integer,boolean,text) from public,anon;
grant execute on function public.gd_resolve_order_request(uuid,integer,boolean,text) to authenticated;

-- Free text may contain contacts too; keep the decision log but erase the whole proposal/reply.
create function gd_private.erase_request_contacts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.gd_order_requests set body='{}'::jsonb,response='' where order_id=new.id;
  return new;
end;
$$;
revoke execute on function gd_private.erase_request_contacts() from public,anon,authenticated;
create trigger gd_requests_contact_retention after update of contacts_erased_at on public.gd_orders
  for each row when(new.contacts_erased_at is not null and old.contacts_erased_at is null)
  execute function gd_private.erase_request_contacts();

create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),
      'productVariants',true,'variantOrders',true,'deliveryCalendar',true,'operationsDesk',true,'orderRequests',true))
  from gd_private.runtime where id=1;
$$;
commit;
