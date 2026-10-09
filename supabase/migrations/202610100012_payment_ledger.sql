begin;
lock table public.gd_orders in share row exclusive mode;
create table public.gd_payment_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.gd_orders(id),
  kind text not null check(kind in ('RECEIPT','REFUND')),
  amount bigint not null check(amount>=0),
  payment_method text not null check(payment_method in ('COD','VIETQR')),
  reference text not null default '' check(length(reference)<=120),
  evidence text not null check(length(evidence) between 5 and 500),
  actor_id uuid references auth.users(id),
  order_version integer not null,
  source text not null check(source in ('LEGACY','MANUAL')),
  request_hash text,
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id,order_version,kind),
  check((source='LEGACY' and effective_at is null) or (source='MANUAL' and effective_at is not null and actor_id is not null))
);
create index gd_ledger_order on public.gd_payment_ledger(order_id,created_at desc,id desc);
create index gd_ledger_settlement on public.gd_payment_ledger(effective_at,kind) where source='MANUAL';
create unique index gd_ledger_external_reference on public.gd_payment_ledger(payment_method,reference,kind)
  where reference<>'';
alter table public.gd_payment_ledger enable row level security;
revoke all on public.gd_payment_ledger from public,anon,authenticated;
grant select(id,order_id,kind,amount,payment_method,reference,evidence,actor_id,order_version,source,effective_at,created_at)
  on public.gd_payment_ledger to authenticated;
create policy ledger_admin on public.gd_payment_ledger for select to authenticated using(gd_private.is_admin());

-- An opening snapshot carries no invented settlement date or claim of a new bank transaction.
insert into public.gd_payment_ledger(order_id,kind,amount,payment_method,evidence,order_version,source)
  select id,'RECEIPT',total,payment_method,'Trạng thái tiền đã được ghi nhận trước khi có sổ đối soát',version,'LEGACY'
  from public.gd_orders where payment_status in ('PAID','REFUNDED');
insert into public.gd_payment_ledger(order_id,kind,amount,payment_method,evidence,order_version,source)
  select id,'REFUND',total,payment_method,'Trạng thái hoàn đã được ghi nhận trước khi có sổ đối soát',version,'LEGACY'
  from public.gd_orders where payment_status='REFUNDED';

create function gd_private.payment_balance(p_order uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('orderId',o.id,'total',o.total,'received',l.received,'refunded',l.refunded,
    'heldCash',l.received-l.refunded,'receivable',case when o.status<>'CANCELLED' and o.payment_status='UNPAID' then o.total else 0 end,
    'refundable',greatest(l.received-l.refunded,0),'legacyBalance',l.legacy,'fullOnly',true)
  from public.gd_orders o cross join lateral (
    select coalesce(sum(amount) filter(where kind='RECEIPT'),0) received,
      coalesce(sum(amount) filter(where kind='REFUND'),0) refunded,
      coalesce(bool_or(source='LEGACY'),false) legacy
    from public.gd_payment_ledger where order_id=o.id
  ) l where o.id=p_order;
$$;
revoke execute on function gd_private.payment_balance(uuid) from public,anon,authenticated;
create function public.gd_payment_balance(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.gd_orders where id=p_order and (owner_id=auth.uid() or gd_private.is_admin()))
    then raise exception 'NOT_FOUND'; end if;
  return gd_private.payment_balance(p_order);
end;
$$;
revoke execute on function public.gd_payment_balance(uuid) from public,anon;
grant execute on function public.gd_payment_balance(uuid) to authenticated;

alter function public.gd_update_order(uuid,integer,text,text,text) set schema gd_private;
alter function gd_private.gd_update_order(uuid,integer,text,text,text) rename to apply_order_update;
revoke execute on function gd_private.apply_order_update(uuid,integer,text,text,text) from public,anon,authenticated;

create function gd_private.record_order_update(p_order uuid,p_version integer,p_status text,p_payment text,p_evidence text,
  p_reference text default '',p_operation uuid default null,p_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.gd_orders; saved jsonb; entry public.gd_payment_ledger;
  operation uuid:=coalesce(p_operation,gen_random_uuid()); financial boolean; note text;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if length(coalesce(p_evidence,''))>500 then raise exception 'INVALID_NOTE'; end if;
  select * into previous from public.gd_orders where id=p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if previous.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
  financial:=p_payment is not null and p_payment<>previous.payment_status;
  if financial and length(trim(coalesce(p_evidence,'')))<5 then raise exception 'PAYMENT_EVIDENCE_REQUIRED'; end if;
  note:=case when financial then 'Đối soát '||operation::text else p_evidence end;
  saved:=gd_private.apply_order_update(p_order,p_version,p_status,p_payment,note);
  if financial then
    insert into public.gd_payment_ledger(id,order_id,kind,amount,payment_method,reference,evidence,actor_id,order_version,source,request_hash,effective_at)
      values(operation,p_order,case when p_payment='PAID' then 'RECEIPT' else 'REFUND' end,previous.total,
        previous.payment_method,p_reference,trim(p_evidence),auth.uid(),(saved->>'version')::integer,'MANUAL',p_hash,now()) returning * into entry;
    insert into public.gd_admin_audit(actor_id,entity,entity_id,action,before_data,after_data)
      values(auth.uid(),'gd_payment_ledger',entry.id::text,entry.kind,
        jsonb_build_object('orderId',p_order,'version',previous.version,'paymentStatus',previous.payment_status),
        jsonb_build_object('orderId',p_order,'version',saved->'version','paymentStatus',p_payment,'amount',entry.amount,'requestId',entry.id));
  end if;
  return jsonb_build_object('order',saved,'event',case when financial then to_jsonb(entry)-'request_hash' else null end);
end;
$$;
revoke execute on function gd_private.record_order_update(uuid,integer,text,text,text,text,uuid,text) from public,anon,authenticated;

create function public.gd_update_order(p_id uuid,p_version integer,p_status text,p_payment text,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return gd_private.record_order_update(p_id,p_version,p_status,p_payment,p_note)->'order';
end;
$$;
revoke execute on function public.gd_update_order(uuid,integer,text,text,text) from public,anon;
grant execute on function public.gd_update_order(uuid,integer,text,text,text) to authenticated;

create function public.gd_reconcile_payment(p_id uuid,p_order uuid,p_version integer,p_action text,p_evidence text,p_reference text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.gd_payment_ledger; current_order public.gd_orders; fingerprint text; saved jsonb;
  evidence text:=trim(p_evidence); external_ref text:=upper(trim(coalesce(p_reference,''))); next_payment text;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_id is null or p_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    or p_version is null or p_version<1 or p_action is null or p_action not in ('RECEIPT','REFUND')
    or evidence is null or length(evidence) not between 5 and 500 or length(external_ref)>120
    or external_ref !~ '^[A-Z0-9 /._-]*$' then raise exception 'INVALID_RECONCILIATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended('reconciliation:'||p_id::text,0));
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('order',p_order,'version',p_version,'action',p_action,'evidence',evidence,'reference',external_ref)::text,'UTF8')),'hex');
  select * into existing from public.gd_payment_ledger where id=p_id;
  if found then
    if existing.actor_id is distinct from auth.uid() or existing.request_hash is distinct from fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    select * into current_order from public.gd_orders where id=p_order;
    return jsonb_build_object('order',to_jsonb(current_order)-'request_body','event',to_jsonb(existing)-'request_hash','balance',gd_private.payment_balance(p_order));
  end if;
  select * into current_order from public.gd_orders where id=p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if current_order.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if external_ref<>'' then
    perform pg_advisory_xact_lock(hashtextextended('payment-reference:'||current_order.payment_method||':'||external_ref||':'||p_action,0));
    if exists(select 1 from public.gd_payment_ledger where payment_method=current_order.payment_method and reference=external_ref and kind=p_action)
      then raise exception 'PAYMENT_REFERENCE_USED'; end if;
  end if;
  next_payment:=case when p_action='RECEIPT' then 'PAID' else 'REFUNDED' end;
  if (p_action='RECEIPT' and (current_order.payment_status<>'UNPAID' or current_order.status='CANCELLED'))
    or (p_action='REFUND' and current_order.payment_status<>'PAID') then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
  saved:=gd_private.record_order_update(p_order,p_version,current_order.status,next_payment,evidence,external_ref,p_id,fingerprint);
  return saved||jsonb_build_object('balance',gd_private.payment_balance(p_order));
end;
$$;
revoke execute on function public.gd_reconcile_payment(uuid,uuid,integer,text,text,text) from public,anon;
grant execute on function public.gd_reconcile_payment(uuid,uuid,integer,text,text,text) to authenticated;

create function public.gd_reconciliation_queue(p_filter text default 'ALL',p_method text default 'ALL',p_search text default '',
  p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; query text:=upper(trim(coalesce(p_search,'')));
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_filter is null or p_filter not in ('ALL','UNPAID','PAID','REFUNDED') or p_method is null or p_method not in ('ALL','COD','VIETQR')
    or length(query)>40 or (query<>'' and query !~ '^GD-[A-Z0-9-]+$') or p_limit is null or p_limit not between 1 and 50
    or (p_before is null)<>(p_before_id is null) then raise exception 'INVALID_QUEUE_FILTER'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'reference',o.reference,'total',o.total,'payment_method',o.payment_method,
    'payment_status',o.payment_status,'status',o.status,'created_at',o.created_at,'version',o.version)||
    (gd_private.payment_balance(o.id)-array['orderId','total','fullOnly','legacyBalance','refundable']) order by o.created_at desc,o.id desc),'[]'::jsonb)
    into result from (
      select * from public.gd_orders
      where (not is_test or (select environment from gd_private.runtime where id=1)<>'production')
        and (p_filter='ALL' or (payment_status=p_filter and (p_filter<>'UNPAID' or status<>'CANCELLED')))
        and (p_method='ALL' or payment_method=p_method)
        and (query='' or reference like query||'%')
        and (p_before is null or (created_at,id)<(p_before,p_before_id))
      order by created_at desc,id desc limit p_limit+1
    ) o;
  return result;
end;
$$;
revoke execute on function public.gd_reconciliation_queue(text,text,text,timestamptz,uuid,integer) from public,anon;
grant execute on function public.gd_reconciliation_queue(text,text,text,timestamptz,uuid,integer) to authenticated;

create function public.gd_reconciliation_totals(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare receipts bigint; refunds bigint; events bigint; opening_receipts bigint; opening_refunds bigint;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>91 then raise exception 'INVALID_REPORT_PERIOD'; end if;
  select coalesce(sum(l.amount) filter(where l.kind='RECEIPT'),0),coalesce(sum(l.amount) filter(where l.kind='REFUND'),0),count(*)
    into receipts,refunds,events from public.gd_payment_ledger l join public.gd_orders o on o.id=l.order_id
    where l.source='MANUAL' and l.effective_at>=p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'
      and l.effective_at<(p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'
      and (not o.is_test or (select environment from gd_private.runtime where id=1)<>'production');
  select coalesce(sum(l.amount) filter(where l.kind='RECEIPT'),0),coalesce(sum(l.amount) filter(where l.kind='REFUND'),0)
    into opening_receipts,opening_refunds from public.gd_payment_ledger l join public.gd_orders o on o.id=l.order_id
    where l.source='LEGACY' and (not o.is_test or (select environment from gd_private.runtime where id=1)<>'production');
  return jsonb_build_object('from',p_from,'to',p_to,'received',receipts,'refunded',refunds,'netCollected',receipts-refunds,
    'eventCount',events,'legacyReceiptBalance',opening_receipts,'legacyRefundBalance',opening_refunds,'basis','SETTLEMENT_DATE');
end;
$$;
revoke execute on function public.gd_reconciliation_totals(date,date) from public,anon;
grant execute on function public.gd_reconciliation_totals(date,date) to authenticated;

create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),
      'productVariants',true,'variantOrders',true,'deliveryCalendar',true,'operationsDesk',true,'orderRequests',true,'reconciliationLedger',true))
  from gd_private.runtime where id=1;
$$;
commit;
