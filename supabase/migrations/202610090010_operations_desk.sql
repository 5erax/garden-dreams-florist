begin;
create index gd_orders_delivery_queue on public.gd_orders(delivery_date,status,created_at desc,id desc);
create index gd_orders_reference_search on public.gd_orders(lower(reference) text_pattern_ops);

create table public.gd_order_staff_notes (
  id uuid primary key,
  order_id uuid not null references public.gd_orders(id),
  actor_id uuid not null references auth.users(id),
  body text not null check(length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index gd_staff_notes_order on public.gd_order_staff_notes(order_id,created_at,id);
alter table public.gd_order_staff_notes enable row level security;
revoke all on public.gd_order_staff_notes from public,anon,authenticated;
grant select on public.gd_order_staff_notes to authenticated;
create policy staff_note_admin on public.gd_order_staff_notes for select to authenticated using(gd_private.is_admin());

create function public.gd_add_staff_note(p_id uuid,p_order uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.gd_order_staff_notes; saved public.gd_order_staff_notes; body text:=trim(p_body);
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_id is null or p_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    or body is null or length(body) not between 1 and 1000 then raise exception 'INVALID_NOTE'; end if;
  perform pg_advisory_xact_lock(hashtextextended('staff-note:'||p_id::text,0));
  select * into existing from public.gd_order_staff_notes where id=p_id;
  if found then
    if existing.order_id is distinct from p_order or existing.actor_id<>auth.uid() or existing.body<>body
      then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(existing);
  end if;
  if not exists(select 1 from public.gd_orders where id=p_order) then raise exception 'NOT_FOUND'; end if;
  insert into public.gd_order_staff_notes(id,order_id,actor_id,body) values(p_id,p_order,auth.uid(),body) returning * into saved;
  return to_jsonb(saved);
end;
$$;
revoke execute on function public.gd_add_staff_note(uuid,uuid,text) from public,anon;
grant execute on function public.gd_add_staff_note(uuid,uuid,text) to authenticated;

create function public.gd_operations_queue(p_queue text default 'ALL',p_day date default null,p_search text default '',
  p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; query text:=upper(trim(coalesce(p_search,''))); pattern text;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_queue is null or p_queue not in ('ALL','PENDING','CONFIRMED','PREPARING','SHIPPING','DELIVERED','CANCELLED','COLLECTION')
    or length(query)>40 or (query<>'' and query !~ '^GD-[A-Z0-9-]+$')
    or p_limit is null or p_limit not between 1 and 50
    or (p_before is null) <> (p_before_id is null)
    then raise exception 'INVALID_QUEUE_FILTER'; end if;
  pattern := lower(query)||'%';
  select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id desc),'[]'::jsonb) into result from (
    select id,reference,recipient_name,delivery_date,delivery_time,status,payment_status,payment_method,total,version,created_at,
      shipping->>'name' as shipping_name,is_test
    from public.gd_orders
    where (not is_test or (select environment from gd_private.runtime where id=1)<>'production')
      and (p_day is null or delivery_date=p_day)
      and (query='' or lower(reference) like pattern)
      and (p_queue='ALL' or status=p_queue or (p_queue='COLLECTION' and payment_status='UNPAID' and status<>'CANCELLED'))
      and (p_before is null or (created_at,id)<(p_before,p_before_id))
    order by created_at desc,id desc limit p_limit+1
  ) page;
  return result;
end;
$$;
revoke execute on function public.gd_operations_queue(text,date,text,timestamptz,uuid,integer) from public,anon;
grant execute on function public.gd_operations_queue(text,date,text,timestamptz,uuid,integer) to authenticated;

create function public.gd_operations_summary(p_day date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare summary jsonb;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_day is null then raise exception 'INVALID_DATE'; end if;
  select jsonb_build_object('day',p_day,'orders',count(*),
    'pending',count(*) filter(where status='PENDING'),
    'preparing',count(*) filter(where status in ('CONFIRMED','PREPARING')),
    'shipping',count(*) filter(where status='SHIPPING'),
    'delivered',count(*) filter(where status='DELIVERED'),
    'needsCollection',count(*) filter(where payment_status='UNPAID' and status<>'CANCELLED'),
    'outstanding',coalesce(sum(total) filter(where payment_status='UNPAID' and status<>'CANCELLED'),0),
    'heldCash',coalesce(sum(total) filter(where payment_status='PAID'),0)) into summary
  from public.gd_orders where delivery_date=p_day
    and (not is_test or (select environment from gd_private.runtime where id=1)<>'production');
  return summary;
end;
$$;
revoke execute on function public.gd_operations_summary(date) from public,anon;
grant execute on function public.gd_operations_summary(date) to authenticated;

create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),
      'productVariants',true,'variantOrders',true,'deliveryCalendar',true,'operationsDesk',true))
  from gd_private.runtime where id=1;
$$;
commit;
