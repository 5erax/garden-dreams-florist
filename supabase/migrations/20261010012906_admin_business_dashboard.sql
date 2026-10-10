begin;
create function public.gd_business_dashboard(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz; end_at timestamptz; report jsonb; staging boolean;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>91 then raise exception 'INVALID_REPORT_PERIOD'; end if;
  start_at := p_from::timestamp at time zone 'Asia/Ho_Chi_Minh';
  end_at := (p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
  select environment<>'production' into staging from gd_private.runtime where id=1;
  with orders as (
    select * from public.gd_orders where not is_test or staging
  ), period as (
    select * from orders where created_at>=start_at and created_at<end_at
  ), buyers as (
    select owner_id,count(*) n from orders where status<>'CANCELLED' group by owner_id
  ), daily_orders as (
    select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as report_day,count(*) n,
      coalesce(sum(total) filter(where status<>'CANCELLED'),0) value
    from period group by 1
  ), daily_cash as (
    select (l.effective_at at time zone 'Asia/Ho_Chi_Minh')::date as report_day,
      sum(case when l.kind='RECEIPT' then l.amount else -l.amount end) value
    from public.gd_payment_ledger l join orders o on o.id=l.order_id
    where l.source='MANUAL' and l.effective_at>=start_at and l.effective_at<end_at group by 1
  ), methods as (
    select payment_method method,count(*) n,sum(total) value from period where status<>'CANCELLED' group by 1
  ), flowers as (
    select line->>'id' id,line->>'name' name,sum((line->>'quantity')::integer) quantity,
      sum((line->>'price')::bigint*(line->>'quantity')::integer) value
    from period cross join lateral jsonb_array_elements(items) line where status<>'CANCELLED' group by 1,2
    order by quantity desc,id limit 10
  ) select jsonb_build_object(
    'from',p_from,'to',p_to,'generatedAt',now(),'staging',staging,
    'cash',public.gd_reconciliation_totals(p_from,p_to),
    'orders',(select jsonb_build_object('count',count(*),'cancelled',count(*) filter(where status='CANCELLED'),
      'pending',count(*) filter(where status='PENDING'),'delivered',count(*) filter(where status='DELIVERED'),
      'bookedValue',coalesce(sum(total) filter(where status<>'CANCELLED'),0),
      'deliveredPaidValue',coalesce(sum(total) filter(where status='DELIVERED' and payment_status='PAID'),0),
      'buyers',count(distinct owner_id) filter(where status<>'CANCELLED')) from period),
    'receivableNow',(select coalesce(sum(total),0) from orders where payment_status='UNPAID' and status<>'CANCELLED'),
    'buyersAllTime',(select count(*) from buyers),'repeatBuyersAllTime',(select count(*) from buyers where n>1),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'orders',coalesce(o.n,0),
      'bookedValue',coalesce(o.value,0),'netCash',coalesce(c.value,0)) order by d),'[]')
      from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
      left join daily_orders o on o.report_day=d::date left join daily_cash c on c.report_day=d::date),
    'methods',(select coalesce(jsonb_agg(jsonb_build_object('method',method,'orders',n,'value',value) order by method),'[]') from methods),
    'flowers',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'quantity',quantity,'value',value)),'[]') from flowers),
    'catalog',(select jsonb_build_object('sale',count(*) filter(where active),'reference',count(*) filter(where reference_only),
      'missingSlug',count(*) filter(where (active or reference_only) and nullif(trim(slug),'') is null),
      'shortDescription',count(*) filter(where (active or reference_only) and length(trim(description))<120),
      'pendingImages',count(*) filter(where active and (image like '%.svg' or nullif(trim(image),'') is null))) from public.gd_products),
    'inventoryEnabled',(select enabled from public.gd_inventory_settings where id=1),
    'publicMemories',(select count(*) from public.gd_memories where listed and not revoked and (not is_test or staging))
  ) into report;
  return report;
end;
$$;
revoke execute on function public.gd_business_dashboard(date,date) from public,anon;
grant execute on function public.gd_business_dashboard(date,date) to authenticated;
notify pgrst,'reload schema';
commit;
