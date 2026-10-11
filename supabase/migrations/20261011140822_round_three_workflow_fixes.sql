begin;
set local lock_timeout='10s';
do $$ begin if to_regclass('public.gd_recipe_lines') is null or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='gd_shop' and column_name='opens_at') then raise exception 'ROUND_THREE_REQUIRES_AUDIT';end if;end $$;
create function gd_private.delivery_deadline(p_day date,p_time text) returns timestamptz language sql immutable set search_path='' as $$ select (p_day+make_time(substring(p_time from '[–-]([0-9]+)h')::integer,0,0)) at time zone 'Asia/Ho_Chi_Minh'; $$;
revoke execute on function gd_private.delivery_deadline(date,text) from public,anon,authenticated;
create function gd_private.inventory_readiness() returns jsonb language sql stable set search_path='' as $$ select jsonb_build_object(
'ingredients',exists(select 1 from public.gd_ingredients where active),
'recipes',exists(select 1 from public.gd_products where active) and not exists(select 1 from public.gd_products p where p.active and not exists(select 1 from public.gd_recipes r where r.active and r.product_id=p.id and r.variant_id is null)) and not exists(select 1 from public.gd_product_variants v join public.gd_products p on p.id=v.product_id where v.active and p.active and not exists(select 1 from public.gd_recipes r where r.active and r.product_id=p.id and r.variant_id=v.id)),
'stock',exists(select 1 from public.gd_stock_batches where expires_on>=(now() at time zone 'Asia/Ho_Chi_Minh')::date and on_hand>reserved));$$;
revoke execute on function gd_private.inventory_readiness() from public,anon,authenticated;
create or replace function public.gd_inventory_state() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return jsonb_build_object('readiness',gd_private.inventory_readiness(),'enabled',(select enabled from public.gd_inventory_settings where id=1),
    'ingredients',coalesce((select jsonb_agg(to_jsonb(i) order by name) from public.gd_ingredients i),'[]'::jsonb),
    'batches',coalesce((select jsonb_agg(to_jsonb(b)) from (select * from public.gd_stock_batches order by created_at desc,id limit 200) b),'[]'::jsonb),
    'recipes',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('lines',(select jsonb_agg(to_jsonb(l)) from public.gd_recipe_lines l where recipe_id=r.id))) from public.gd_recipes r where active),'[]'::jsonb),
    'movements',coalesce((select jsonb_agg(to_jsonb(m)) from (select * from public.gd_stock_movements order by id desc limit 50) m),'[]'::jsonb));
end; $$;
create or replace function public.gd_inventory_command(p_id uuid,p_action text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.gd_inventory_operations; digest text; answer jsonb; ingredient integer; batch uuid; recipe uuid;
  line jsonb; pid integer; vid integer; qty integer; cost integer; expiry date; rev integer;
  stock public.gd_stock_batches; target_enabled boolean;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_id is null or p_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    or p_action is null or p_action not in ('INGREDIENT','RECEIVE','RECIPE','WASTE','ENABLE')
    or jsonb_typeof(p_body) is distinct from 'object' or length(p_body::text)>16000 then raise exception 'INVALID_INVENTORY'; end if;
  -- shortcut: one inventory lock serializes this single shop; use ordered ingredient locks when contention is measured.
  perform pg_advisory_xact_lock(hashtextextended('garden-dreams-inventory',0));
  digest:=encode(sha256(convert_to(p_action||p_body::text,'UTF8')),'hex');
  select * into saved from public.gd_inventory_operations where id=p_id;
  if found then
    if saved.actor_id<>auth.uid() or saved.hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return saved.result;
  end if;
  if p_action='INGREDIENT' then
    if p_body->>'name' is null or length(trim(p_body->>'name')) not between 2 and 120 or p_body->>'unit' is null or p_body->>'unit' not in ('STEM','UNIT','ROLL','GRAM') then raise exception 'INVALID_INVENTORY'; end if;
    if coalesce(p_body->>'minimumStock','0') !~ '^[0-9]{1,7}$' then raise exception 'INVALID_INVENTORY'; end if;
    insert into public.gd_ingredients(name,unit,minimum_stock) values(trim(p_body->>'name'),p_body->>'unit',coalesce((p_body->>'minimumStock')::integer,0)) returning id into ingredient;
    answer:=jsonb_build_object('ingredientId',ingredient);
  elsif p_action='RECEIVE' then
    if p_body->>'quantity' is null or p_body->>'quantity' !~ '^[1-9][0-9]{0,6}$' or p_body->>'unitCost' is null or p_body->>'unitCost' !~ '^[0-9]{1,9}$'
      or p_body->>'expiresOn' is null or p_body->>'expiresOn' !~ '^\d{4}-\d{2}-\d{2}$' or length(coalesce(trim(p_body->>'code'),'')) not between 1 and 80
      or length(coalesce(p_body->>'supplier',''))>120 then raise exception 'INVALID_INVENTORY'; end if;
    ingredient:=(p_body->>'ingredientId')::integer; qty:=(p_body->>'quantity')::integer; cost:=(p_body->>'unitCost')::integer; expiry:=(p_body->>'expiresOn')::date;
    if expiry<(now() at time zone 'Asia/Ho_Chi_Minh')::date or cost>100000000 or not exists(select 1 from public.gd_ingredients where id=ingredient and active) then raise exception 'INVALID_INVENTORY'; end if;
    batch:=p_id;
    insert into public.gd_stock_batches(id,ingredient_id,code,supplier,expires_on,unit_cost,on_hand)
      values(batch,ingredient,trim(p_body->>'code'),coalesce(trim(p_body->>'supplier'),''),expiry,cost,qty);
    insert into public.gd_stock_movements(batch_id,operation_id,kind,delta,unit_cost,actor_id) values(batch,p_id,'RECEIVE',qty,cost,auth.uid());
    answer:=jsonb_build_object('batchId',batch);
  elsif p_action='RECIPE' then
    pid:=(p_body->>'productId')::integer; vid:=(p_body->>'variantId')::integer;
    if not exists(select 1 from public.gd_products where id=pid and active) or (vid is not null and not exists(select 1 from public.gd_product_variants where id=vid and product_id=pid and active))
      or jsonb_typeof(p_body->'lines') is distinct from 'array' or jsonb_array_length(p_body->'lines') not between 1 and 50 then raise exception 'INVALID_RECIPE'; end if;
    select coalesce(max(revision),0)+1 into rev from public.gd_recipes where product_id=pid and variant_id is not distinct from vid;
    update public.gd_recipes set active=false where product_id=pid and variant_id is not distinct from vid and active;
    recipe:=p_id;
    insert into public.gd_recipes(id,product_id,variant_id,revision,actor_id) values(recipe,pid,vid,rev,auth.uid());
    for line in select value from jsonb_array_elements(p_body->'lines') loop
      if line->>'quantity' is null or line->>'quantity' !~ '^[1-9][0-9]{0,4}$' or (line->>'quantity')::integer>10000 or not exists(select 1 from public.gd_ingredients where id=(line->>'ingredientId')::integer and active) then raise exception 'INVALID_RECIPE'; end if;
      insert into public.gd_recipe_lines(recipe_id,ingredient_id,quantity) values(recipe,(line->>'ingredientId')::integer,(line->>'quantity')::integer);
    end loop;
    if vid is null then update public.gd_products set stems=stems where id=pid; end if;
    answer:=jsonb_build_object('recipeId',recipe,'revision',rev);
  elsif p_action='WASTE' then
    if p_body->>'quantity' is null or p_body->>'quantity' !~ '^[1-9][0-9]{0,6}$' or length(coalesce(trim(p_body->>'reason'),'')) not between 5 and 500 then raise exception 'INVALID_INVENTORY'; end if;
    qty:=(p_body->>'quantity')::integer; batch:=(p_body->>'batchId')::uuid;
    select * into stock from public.gd_stock_batches where id=batch for update;
    if not found or stock.on_hand-stock.reserved<qty then raise exception 'STOCK_RESERVED_OR_INSUFFICIENT'; end if;
    update public.gd_stock_batches set on_hand=on_hand-qty where id=batch;
    insert into public.gd_stock_movements(batch_id,operation_id,kind,delta,unit_cost,reason,actor_id) values(batch,p_id,'WASTE',-qty,stock.unit_cost,trim(p_body->>'reason'),auth.uid());
    answer:=jsonb_build_object('batchId',batch);
  else
    if jsonb_typeof(p_body->'enabled') is distinct from 'boolean' then raise exception 'INVALID_INVENTORY'; end if;
    target_enabled:=(p_body->>'enabled')::boolean;
    if target_enabled and (exists(select 1 from public.gd_products p where active and not exists(select 1 from public.gd_recipes r where r.active and r.product_id=p.id and r.variant_id is null))
      or exists(select 1 from public.gd_product_variants v join public.gd_products p on p.id=v.product_id where v.active and p.active and not exists(select 1 from public.gd_recipes r where r.active and r.product_id=v.product_id and r.variant_id=v.id))) then raise exception 'RECIPES_REQUIRED'; end if;
    if target_enabled and not (gd_private.inventory_readiness()->>'stock')::boolean then raise exception 'STOCK_REQUIRED';end if;
    update public.gd_inventory_settings set enabled=target_enabled where id=1;
    answer:=jsonb_build_object('enabled',target_enabled);
  end if;
  insert into public.gd_inventory_operations(id,actor_id,hash,result) values(p_id,auth.uid(),digest,answer);
  insert into public.gd_admin_audit(actor_id,entity,entity_id,action,after_data) values(auth.uid(),'inventory',p_id::text,p_action,jsonb_build_object('result',answer));
  return answer;
end; $$;
create or replace function public.gd_operations_queue(p_queue text default 'ALL',p_day date default null,p_search text default '',
  p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; query text:=upper(trim(coalesce(p_search,''))); pattern text;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_queue is null or p_queue not in ('ALL','PENDING','CONFIRMED','PREPARING','SHIPPING','DELIVERED','CANCELLED','COLLECTION','PACKING','OVERDUE')
    or length(query)>40 or (query<>'' and query !~ '^GD-[A-Z0-9-]+$')
    or p_limit is null or p_limit not between 1 and 50
    or (p_before is null) <> (p_before_id is null)
    then raise exception 'INVALID_QUEUE_FILTER'; end if;
  pattern := lower(query)||'%';
  select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id desc),'[]'::jsonb) into result from (
    select id,reference,recipient_name,recipient_phone,buyer_phone,delivery_date,delivery_time,status,payment_status,payment_method,total,version,created_at,
      shipping->>'name' as shipping_name,is_test
    from public.gd_orders
    where (not is_test or (select environment from gd_private.runtime where id=1)<>'production')
      and (p_day is null or delivery_date=p_day)
      and (query='' or lower(reference) like pattern)
      and (p_queue='ALL' or status=p_queue or (p_queue='OVERDUE' and gd_private.delivery_deadline(delivery_date,delivery_time)<statement_timestamp() and status in ('PENDING','CONFIRMED','PREPARING','SHIPPING')) or (p_queue='PACKING' and status in ('CONFIRMED','PREPARING')) or (p_queue='COLLECTION' and payment_status in ('UNPAID','PARTIAL') and status<>'CANCELLED'))
      and (p_before is null or (created_at,id)<(p_before,p_before_id))
    order by created_at desc,id desc limit p_limit+1
  ) page;
  return result;
end;
$$;
create or replace function public.gd_business_dashboard(p_from date,p_to date) returns jsonb
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
    'receivableNow',(select coalesce(sum((gd_private.payment_balance(id)->>'receivable')::bigint),0) from orders),
    'buyersAllTime',(select count(*) from buyers),'repeatBuyersAllTime',(select count(*) from buyers where n>1),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'orders',coalesce(o.n,0),
      'bookedValue',coalesce(o.value,0),'netCash',coalesce(c.value,0)) order by d),'[]')
      from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
      left join daily_orders o on o.report_day=d::date left join daily_cash c on c.report_day=d::date),
    'methods',(select coalesce(jsonb_agg(jsonb_build_object('method',method,'orders',n,'value',value) order by method),'[]') from methods),
    'flowers',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'quantity',quantity,'value',value)),'[]') from flowers),
    'catalog',(select jsonb_build_object('sale',count(*) filter(where active),'reference',count(*) filter(where reference_only),
      'missingSlug',count(*) filter(where (active or reference_only) and nullif(trim(slug),'') is null),'genericSlug',count(*) filter(where (active or reference_only) and slug ~ '^bo-hoa-[0-9]+$'),
      'shortDescription',count(*) filter(where (active or reference_only) and length(trim(description))<120),
      'pendingImages',count(*) filter(where active and (image like '%.svg' or nullif(trim(image),'') is null))) from public.gd_products),
    'inventoryEnabled',(select enabled from public.gd_inventory_settings where id=1),
    'publicMemories',(select count(*) from public.gd_memories where listed and not revoked and not moderation_removed and (not is_test or staging))
  ) into report;
  return report || jsonb_build_object('previous',(select jsonb_build_object('orders',count(*),'bookedValue',coalesce(sum(total) filter(where status<>'CANCELLED'),0)) from public.gd_orders where (not is_test or staging) and created_at>=((p_from-(p_to-p_from+1))::timestamp at time zone 'Asia/Ho_Chi_Minh') and created_at<start_at),'overdueNow',(select count(*) from public.gd_orders where (not is_test or staging) and status in ('PENDING','CONFIRMED','PREPARING','SHIPPING') and gd_private.delivery_deadline(delivery_date,delivery_time)<statement_timestamp()));
end;
$$;
create or replace function public.gd_operations_summary(p_day date) returns jsonb language plpgsql security definer set search_path='' as $$ declare answer jsonb;begin
if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
with orders as(select * from public.gd_orders where (p_day is null or delivery_date=p_day) and (not is_test or (select environment from gd_private.runtime where id=1)<>'production'))
select jsonb_build_object('day',p_day,'orders',count(*),'pending',count(*) filter(where status='PENDING'),'preparing',count(*) filter(where status in ('CONFIRMED','PREPARING')),'shipping',count(*) filter(where status='SHIPPING'),'delivered',count(*) filter(where status='DELIVERED'),'needsCollection',count(*) filter(where payment_status in ('UNPAID','PARTIAL') and status<>'CANCELLED'),'outstanding',coalesce(sum((gd_private.payment_balance(id)->>'receivable')::bigint),0),'heldCash',coalesce(sum((gd_private.payment_balance(id)->>'heldCash')::bigint),0),'queueCounts',jsonb_build_object('ALL',count(*),'OVERDUE',count(*) filter(where status not in ('DELIVERED','CANCELLED') and gd_private.delivery_deadline(delivery_date,delivery_time)<statement_timestamp()),'PENDING',count(*) filter(where status='PENDING'),'PACKING',count(*) filter(where status in ('CONFIRMED','PREPARING')),'CONFIRMED',count(*) filter(where status='CONFIRMED'),'PREPARING',count(*) filter(where status='PREPARING'),'SHIPPING',count(*) filter(where status='SHIPPING'),'COLLECTION',count(*) filter(where payment_status in ('UNPAID','PARTIAL') and status<>'CANCELLED'),'DELIVERED',count(*) filter(where status='DELIVERED'),'CANCELLED',count(*) filter(where status='CANCELLED'))) into answer from orders;return answer;end;$$;
create or replace function gd_private.delivery_option(p_shipping uuid,p_day date,p_time text,p_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  rule public.gd_delivery_rules;
  start_time time;
  cutoff timestamptz;
  used integer := 0; shop public.gd_shop;
  reason text := '';
begin
  select * into rule from public.gd_delivery_rules
    where shipping_id=p_shipping and delivery_time=p_time;
  if not found then
    return jsonb_build_object('time',p_time,'available',false,'reason','NO_SLOT','remaining',0);
  end if;
  used := gd_private.delivery_used(p_shipping,p_day,p_time);
  start_time := case p_time when 'Sáng · 9–12h' then time '09:00'
    when 'Chiều · 13–17h' then time '13:00' else time '18:00' end;
  cutoff := ((p_day + start_time) at time zone 'Asia/Ho_Chi_Minh') - make_interval(mins=>rule.lead_minutes);
  select * into shop from public.gd_shop where id=1;
  if (cutoff at time zone 'Asia/Ho_Chi_Minh')::date=p_day and ((cutoff at time zone 'Asia/Ho_Chi_Minh')::time<shop.opens_at or (cutoff at time zone 'Asia/Ho_Chi_Minh')::time>shop.closes_at) then cutoff:=least(cutoff,((p_day-1)+time '20:00') at time zone 'Asia/Ho_Chi_Minh');end if;
  if not rule.active then reason := 'NO_SLOT';
  elsif exists(select 1 from public.gd_delivery_closures where shipping_id=p_shipping and delivery_date=p_day and active)
    or not (extract(isodow from p_day)::integer=any(rule.weekdays)) then reason := 'DAY_CLOSED';
  elsif p_at >= cutoff then reason := 'CUTOFF';
  elsif used >= rule.capacity then reason := 'FULL';
  end if;
  return jsonb_build_object('id',rule.id,'time',p_time,'available',reason='',
    'reason',reason,'remaining',greatest(0,rule.capacity-used),'cutoffAt',cutoff,'version',rule.version);
end;
$$;
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
    if product.image is null or product.image ~* '\.svg($|\?)' then raise exception 'PRODUCT_PHOTO_REQUIRED'; end if;
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
  insert into public.gd_orders(id,owner_id,reference,request_body,recipient_name,recipient_phone,address,card_message,delivery_date,delivery_time,items,subtotal,shipping,total,payment_method,bank,buyer_name,buyer_phone)
  values(rid,uid,'GD-'||upper(substr(replace(rid::text,'-',''),1,16)),jsonb_build_object('hash',body_hash),name,phone,address,message,day,p_request->>'deliveryTime',lines,amount,
    jsonb_build_object('id',delivery.id,'name',delivery.name,'area',delivery.area,'fee',delivery.fee),amount+delivery.fee,pay,
    case when pay='VIETQR' then jsonb_build_object('bin',cfg.bank_bin,'account',cfg.bank_account,'bankName',cfg.bank_name,'accountName',cfg.account_name) end,nullif(trim(p_request->>'buyerName'),''),nullif(regexp_replace(p_request->>'buyerPhone','[\s().-]','','g'),''))
  returning * into result;
  insert into public.gd_order_events(order_id,actor_id,event) values(rid,uid,'Đã tạo yêu cầu đặt hoa');
  return to_jsonb(result) - 'request_body';
end;
$$;
create function gd_private.guard_overdue_confirmation() returns trigger language plpgsql set search_path='' as $$ begin if new.status='CONFIRMED' and old.status='PENDING' and gd_private.delivery_deadline(new.delivery_date,new.delivery_time)<statement_timestamp() then raise exception 'ORDER_OVERDUE';end if;return new;end;$$;
revoke execute on function gd_private.guard_overdue_confirmation() from public,anon,authenticated;
create trigger guard_overdue_confirmation before update on public.gd_orders for each row execute function gd_private.guard_overdue_confirmation();
create function gd_private.slug_name(p_name text) returns text language sql immutable set search_path='' as $$ select trim(both '-' from left(regexp_replace(translate(lower(p_name),'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ','aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'),'[^a-z0-9]+','-','g'),85));$$;
revoke execute on function gd_private.slug_name(text) from public,anon,authenticated;
create or replace function gd_private.product_slug_default() returns trigger language plpgsql set search_path='' as $$ begin if new.slug is null or new.slug='' then new.slug:=coalesce(nullif(gd_private.slug_name(new.name),''),'bo-hoa')||'-'||new.id;end if;return new;end;$$;
create function public.gd_generate_product_slugs(p_ids integer[]) returns integer language plpgsql security definer set search_path='' as $$ declare amount integer;begin
if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
if cardinality(p_ids) not between 1 and 200 or p_ids is null or exists(select 1 from unnest(p_ids) value where not exists(select 1 from public.gd_products where id=value)) then raise exception 'INVALID_ITEMS';end if;
perform pg_advisory_xact_lock(hashtextextended('catalog-order',0));
update public.gd_products set slug=coalesce(nullif(gd_private.slug_name(name),''),'bo-hoa')||'-'||id where id=any(p_ids) and slug~'^bo-hoa-[0-9]+$';get diagnostics amount=row_count;return amount;end;$$;
revoke execute on function public.gd_generate_product_slugs(integer[]) from public,anon;grant execute on function public.gd_generate_product_slugs(integer[]) to authenticated;

alter table public.gd_orders drop constraint gd_orders_payment_status_check;
alter table public.gd_orders add constraint gd_orders_payment_status_check check(payment_status in ('UNPAID','PAID','REFUNDED','PARTIAL','REFUND_PARTIAL'));
create or replace function gd_private.apply_order_update(p_id uuid,p_version integer,p_status text,p_payment text,p_note text) returns jsonb language plpgsql security definer set search_path = '' as $$
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
    if not ((current.payment_status in ('UNPAID','PARTIAL') and p_payment='PAID' and p_status<>'CANCELLED') or (current.payment_status='PAID' and p_payment='REFUNDED') or p_payment=(select case when received=0 then 'UNPAID' when refunded=received then 'REFUNDED' when refunded>0 then 'REFUND_PARTIAL' when received=current.total then 'PAID' else 'PARTIAL' end from (select coalesce(sum(amount) filter(where kind='RECEIPT'),0) received,coalesce(sum(amount) filter(where kind='REFUND'),0) refunded from public.gd_payment_ledger where order_id=p_id) balances)) then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
    if length(trim(coalesce(p_note,'')))<5 then raise exception 'PAYMENT_EVIDENCE_REQUIRED'; end if;
  end if;
  update public.gd_orders set status=p_status,payment_status=p_payment,version=version+1,updated_at=now() where id=p_id returning * into current;
  insert into public.gd_order_events(order_id,actor_id,event,note) values(p_id,auth.uid(),p_status||' · '||p_payment,coalesce(trim(p_note),''));
  if p_status='DELIVERED' and p_payment='PAID' then
    first_flower := current.items->0;
    insert into public.gd_memories(order_id,owner_id,flower_name,flower_image)
      values(p_id,current.owner_id,first_flower->>'name',first_flower->>'image') on conflict(order_id) do nothing;
  end if;
  if p_payment in ('REFUNDED','REFUND_PARTIAL') or p_status='CANCELLED' then
    update public.gd_memories set share_token=null,listed=false,revoked=true where order_id=p_id;
  end if;
  return to_jsonb(current) - 'request_body';
end;
$$;
create or replace function gd_private.payment_balance(p_order uuid) returns jsonb language sql stable set search_path='' as $$ select jsonb_build_object('orderId',o.id,'total',o.total,'received',l.received,'refunded',l.refunded,'heldCash',l.received-l.refunded,'receivable',case when o.status<>'CANCELLED' and l.refunded=0 then greatest(o.total-l.received,0) else 0 end,'refundable',greatest(l.received-l.refunded,0),'legacyBalance',l.legacy,'fullOnly',false) from public.gd_orders o cross join lateral (select coalesce(sum(amount) filter(where kind='RECEIPT'),0) received,coalesce(sum(amount) filter(where kind='REFUND'),0) refunded,coalesce(bool_or(source='LEGACY'),false) legacy from public.gd_payment_ledger where order_id=o.id) l where o.id=p_order;$$;
drop function public.gd_reconcile_payment(uuid,uuid,integer,text,text,text);
create function public.gd_reconcile_payment(p_id uuid,p_order uuid,p_version integer,p_action text,p_evidence text,p_reference text default '',p_amount bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare entry public.gd_payment_ledger; current_order public.gd_orders; fingerprint text; balance jsonb; amount bigint; next_payment text; saved jsonb; external_ref text:=upper(trim(coalesce(p_reference,'')));evidence text:=trim(p_evidence);
begin
if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
if p_id is null or p_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' or p_version is null or p_version<1 or p_action not in ('RECEIPT','REFUND') or p_action is null or evidence is null or length(evidence) not between 5 and 500 or external_ref !~ '^[A-Z0-9 /._-]{0,120}$' or (p_amount is not null and p_amount<=0) then raise exception 'INVALID_RECONCILIATION';end if;
perform pg_advisory_xact_lock(hashtextextended('reconciliation:'||p_id::text,0));
fingerprint:=encode(sha256(convert_to(jsonb_build_object('order',p_order,'version',p_version,'action',p_action,'evidence',evidence,'reference',external_ref,'amount',p_amount)::text,'UTF8')),'hex');
select * into entry from public.gd_payment_ledger where id=p_id;
if found then if entry.actor_id is distinct from auth.uid() or (entry.request_hash is distinct from fingerprint and not (p_amount is null and entry.request_hash=encode(sha256(convert_to(jsonb_build_object('order',p_order,'version',p_version,'action',p_action,'evidence',evidence,'reference',external_ref)::text,'UTF8')),'hex'))) then raise exception 'IDEMPOTENCY_CONFLICT';end if;select * into current_order from public.gd_orders where id=p_order;return jsonb_build_object('order',to_jsonb(current_order)-'request_body','event',to_jsonb(entry)-'request_hash','balance',gd_private.payment_balance(p_order));end if;
select * into current_order from public.gd_orders where id=p_order for update;if not found then raise exception 'NOT_FOUND';end if;
if current_order.version<>p_version then raise exception 'VERSION_CONFLICT';end if;
if current_order.payment_method='VIETQR' and external_ref='' then raise exception 'PAYMENT_REFERENCE_REQUIRED';end if;
balance:=gd_private.payment_balance(p_order);amount:=coalesce(p_amount,(balance->>case when p_action='RECEIPT' then 'receivable' else 'refundable' end)::bigint);
if amount<=0 or (p_action='RECEIPT' and (current_order.status in ('PENDING','CANCELLED') or amount>(balance->>'receivable')::bigint)) or (p_action='REFUND' and amount>(balance->>'refundable')::bigint) then raise exception 'INVALID_PAYMENT_TRANSITION';end if;
if external_ref<>'' then perform pg_advisory_xact_lock(hashtextextended('payment-reference:'||current_order.payment_method||':'||external_ref||':'||p_action,0));if exists(select 1 from public.gd_payment_ledger where payment_method=current_order.payment_method and reference=external_ref and kind=p_action) then raise exception 'PAYMENT_REFERENCE_USED';end if;end if;
insert into public.gd_payment_ledger(id,order_id,kind,amount,payment_method,reference,evidence,actor_id,order_version,source,request_hash,effective_at) values(p_id,p_order,p_action,amount,current_order.payment_method,external_ref,evidence,auth.uid(),current_order.version+1,'MANUAL',fingerprint,now()) returning * into entry;
balance:=gd_private.payment_balance(p_order);
next_payment:=case when (balance->>'received')::bigint=0 then 'UNPAID' when (balance->>'heldCash')::bigint=0 then 'REFUNDED' when (balance->>'refunded')::bigint>0 then 'REFUND_PARTIAL' when (balance->>'received')::bigint=current_order.total then 'PAID' else 'PARTIAL' end;
saved:=gd_private.apply_order_update(p_order,p_version,current_order.status,next_payment,'Đối soát đã ghi nhận');
insert into public.gd_admin_audit(actor_id,entity,entity_id,action,before_data,after_data) values(auth.uid(),'gd_payment_ledger',p_id::text,p_action,jsonb_build_object('orderId',p_order,'version',p_version),jsonb_build_object('orderId',p_order,'amount',amount,'paymentStatus',next_payment));
return jsonb_build_object('order',saved,'event',to_jsonb(entry)-'request_hash','balance',balance);end;$$;
revoke execute on function public.gd_reconcile_payment(uuid,uuid,integer,text,text,text,bigint) from public,anon;grant execute on function public.gd_reconcile_payment(uuid,uuid,integer,text,text,text,bigint) to authenticated;
create or replace function public.gd_update_order(p_id uuid,p_version integer,p_status text,p_payment text,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$ declare current_order public.gd_orders;begin
if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
select * into current_order from public.gd_orders where id=p_id for update;if not found then raise exception 'NOT_FOUND';end if;
if p_payment<>current_order.payment_status and (current_order.status='PENDING' or current_order.payment_method='VIETQR' or current_order.payment_status in ('PARTIAL','REFUND_PARTIAL')) then raise exception 'PAYMENT_USE_LEDGER_REQUIRED';end if;
return gd_private.record_order_update(p_id,p_version,p_status,p_payment,p_note)->'order';end;$$;


create table gd_private.reschedule_authorizations(order_id uuid primary key,actor_id uuid not null,transaction_id bigint not null);
revoke all on gd_private.reschedule_authorizations from public,anon,authenticated;
create or replace function gd_private.guard_delivery_calendar() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  managed boolean;
  option jsonb;
  rule public.gd_delivery_rules;
  v_shipping uuid;
begin
  v_shipping := (new.shipping->>'id')::uuid;
  select enabled into managed from public.gd_delivery_settings where id=1 for share;
  if tg_op='UPDATE' and exists(select 1 from gd_private.reschedule_authorizations where order_id=new.id and actor_id=auth.uid() and transaction_id=txid_current()) then return new;end if;
  if tg_op='UPDATE' then
    if new.delivery_rule_id is distinct from old.delivery_rule_id
      or new.shipping->'calendar' is distinct from old.shipping->'calendar'
      or new.delivery_date is distinct from old.delivery_date
      or new.delivery_time is distinct from old.delivery_time then raise exception 'CALENDAR_SNAPSHOT_IMMUTABLE'; end if;
    if new.status=old.status or not managed then return new; end if;
    if new.status='CANCELLED' then
      perform pg_advisory_xact_lock(hashtextextended('delivery:'||v_shipping::text||':'||new.delivery_date::text||':'||new.delivery_time,0));
      return new;
    end if;
    if new.status<>'CONFIRMED' then return new; end if;
  elsif not managed then
    return new;
  end if;
  select * into rule from public.gd_delivery_rules where shipping_id=v_shipping and delivery_time=new.delivery_time for share;
  if not found then raise exception 'DELIVERY_UNAVAILABLE'; end if;
  -- The order state itself owns a seat; this also counts legacy confirmed orders.
  perform pg_advisory_xact_lock(hashtextextended('delivery:'||v_shipping::text||':'||new.delivery_date::text||':'||new.delivery_time,0));
  option := gd_private.delivery_option(v_shipping,new.delivery_date,new.delivery_time,statement_timestamp());
  if not (option->>'available')::boolean then raise exception 'DELIVERY_UNAVAILABLE:%',option->>'reason'; end if;
  if tg_op='INSERT' then
    new.delivery_rule_id := rule.id;
    new.shipping := new.shipping || jsonb_build_object('calendar',jsonb_build_object(
      'ruleId',rule.id,'ruleVersion',rule.version,'capacity',rule.capacity,'leadMinutes',rule.lead_minutes,
      'weekdays',rule.weekdays,'cutoffAt',option->'cutoffAt'));
  end if;
  return new;
end;
$$;
create function public.gd_reschedule_order(p_id uuid,p_version integer,p_day date,p_time text,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$ declare previous public.gd_orders; saved public.gd_orders; managed boolean; option jsonb; rule public.gd_delivery_rules;bank_snapshot jsonb;begin
if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
if p_day is null or p_day<(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_day>(now() at time zone 'Asia/Ho_Chi_Minh')::date+60 or p_time is null or p_time not in ('Sáng · 9–12h','Chiều · 13–17h','Tối · 18–20h') or length(trim(coalesce(p_note,''))) not between 10 and 500 or gd_private.delivery_deadline(p_day,p_time)<=statement_timestamp() then raise exception 'INVALID_DATE';end if;
select enabled into managed from public.gd_delivery_settings where id=1 for update;
select * into previous from public.gd_orders where id=p_id for update;if not found then raise exception 'NOT_FOUND';end if;
if previous.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
if previous.status not in ('PENDING','CONFIRMED') then raise exception 'INVALID_TRANSITION';end if;
if (p_day,p_time)=(previous.delivery_date,previous.delivery_time) then raise exception 'INVALID_DATE';end if;
perform pg_advisory_xact_lock(hashtextextended('garden-dreams-inventory',0));
if exists(select 1 from public.gd_stock_allocations a join public.gd_stock_batches b on b.id=a.batch_id where a.order_id=p_id and a.status='HELD' and b.expires_on<p_day) then raise exception 'STOCK_SHORTAGE';end if;
bank_snapshot:=previous.shipping-'calendar';
if managed then
perform pg_advisory_xact_lock(hashtextextended('delivery:'||(previous.shipping->>'id')||':'||p_day::text||':'||p_time,0));option:=gd_private.delivery_option((previous.shipping->>'id')::uuid,p_day,p_time,statement_timestamp());if not (option->>'available')::boolean then raise exception 'DELIVERY_UNAVAILABLE';end if;
select * into rule from public.gd_delivery_rules where shipping_id=(previous.shipping->>'id')::uuid and delivery_time=p_time;
bank_snapshot:=bank_snapshot||jsonb_build_object('calendar',jsonb_build_object('ruleId',rule.id,'ruleVersion',rule.version,'capacity',rule.capacity,'leadMinutes',rule.lead_minutes,'weekdays',rule.weekdays,'cutoffAt',option->'cutoffAt'));end if;
insert into gd_private.reschedule_authorizations values(p_id,auth.uid(),txid_current());
update public.gd_orders set delivery_date=p_day,delivery_time=p_time,shipping=bank_snapshot,delivery_rule_id=case when managed then rule.id else null end,version=version+1,updated_at=now() where id=p_id returning * into saved;
delete from gd_private.reschedule_authorizations where order_id=p_id;
insert into public.gd_order_events(order_id,actor_id,event,note) values(p_id,auth.uid(),'Đã đổi lịch giao',trim(p_note)||' · '||previous.delivery_date||' / '||previous.delivery_time||' → '||p_day||' / '||p_time);
insert into public.gd_admin_audit(actor_id,entity,entity_id,action,before_data,after_data) values(auth.uid(),'gd_orders',p_id::text,'RESCHEDULE',jsonb_build_object('date',previous.delivery_date,'time',previous.delivery_time,'version',previous.version),jsonb_build_object('date',p_day,'time',p_time,'version',saved.version));
return to_jsonb(saved)-'request_body';end;$$;
revoke execute on function public.gd_reschedule_order(uuid,integer,date,text,text) from public,anon;grant execute on function public.gd_reschedule_order(uuid,integer,date,text,text) to authenticated;
create function gd_private.short_order_reference() returns trigger language plpgsql set search_path='' as $$ declare alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; bytes bytea; value text; begin
loop bytes:=sha256(convert_to(gen_random_uuid()::text,'UTF8'));value:='';for i in 0..7 loop value:=value||substr(alphabet,1+get_byte(bytes,i)%length(alphabet),1);end loop;new.reference:='GD-'||value;exit when not exists(select 1 from public.gd_orders where reference=new.reference);end loop;return new;end;$$;
revoke execute on function gd_private.short_order_reference() from public,anon,authenticated;
create trigger short_order_reference before insert on public.gd_orders for each row execute function gd_private.short_order_reference();

create or replace function public.gd_reconciliation_queue(p_filter text default 'ALL',p_method text default 'ALL',p_search text default '',
  p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; query text:=upper(trim(coalesce(p_search,'')));
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_filter is null or p_filter not in ('ALL','UNPAID','PARTIAL','PAID','REFUND_PARTIAL','REFUNDED') or p_method is null or p_method not in ('ALL','COD','VIETQR')
    or length(query)>40 or (query<>'' and query !~ '^GD-[A-Z0-9-]+$') or p_limit is null or p_limit not between 1 and 50
    or (p_before is null)<>(p_before_id is null) then raise exception 'INVALID_QUEUE_FILTER'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'reference',o.reference,'total',o.total,'payment_method',o.payment_method,
    'payment_status',o.payment_status,'status',o.status,'created_at',o.created_at,'version',o.version)||
    (gd_private.payment_balance(o.id)-array['orderId','total','fullOnly','legacyBalance','refundable']) order by o.created_at desc,o.id desc),'[]'::jsonb)
    into result from (
      select * from public.gd_orders
      where (not is_test or (select environment from gd_private.runtime where id=1)<>'production')
        and (p_filter='ALL' or (payment_status=p_filter and (p_filter not in ('UNPAID','PARTIAL') or status='DELIVERED')))
        and (p_method='ALL' or payment_method=p_method)
        and (query='' or reference like query||'%')
        and (p_before is null or (created_at,id)<(p_before,p_before_id))
      order by created_at desc,id desc limit p_limit+1
    ) o;
  return result;
end;
$$;
alter table public.gd_shop add column if not exists address text not null default '665L, xã Long Phước, Đồng Nai';
update public.gd_shop set address='665L, xã Long Phước, Đồng Nai' where address='665L, xã Long Phước, huyện Long Thành, tỉnh Đồng Nai';
update public.gd_shop set returns_policy='Nếu giao sai mẫu, thiếu hoa hoặc hoa hỏng khi nhận, hãy liên hệ điện thoại/Zalo của shop trong 4 giờ sau khi giao, gửi mã đơn cùng ảnh hoặc video rõ tình trạng hoa và bao gói lúc nhận. Shop xác minh, trao đổi phương án đổi bó tương đương hoặc hoàn phần giá trị bị ảnh hưởng; khoản hoàn tối đa bằng tiền đã thực thu của đơn. Mốc 4 giờ giúp kiểm tra hoa tươi và không loại bỏ quyền khiếu nại theo quy định. Hoa héo do bảo quản sai sau khi nhận không thuộc hỗ trợ chất lượng; shop vẫn xem xét từng trường hợp. Nếu địa chỉ sai, người nhận vắng mặt hoặc không liên lạc được, shop liên hệ người đặt để thống nhất giao lại, thời gian và phí phát sinh trước khi thực hiện, không tự ghi đã giao. Đổi giờ, địa chỉ hoặc hủy cần được shop xác nhận trước khi bó; đơn đã bó được xử lý theo tình trạng thực tế và thỏa thuận, không tự mất toàn bộ tiền. Mọi thay thế hoa theo mùa phải được khách đồng ý trước, giữ giá trị và sắc hoa đã thống nhất; khách có thể từ chối trước khi thực hiện. Hoàn tiền qua phương thức hai bên thống nhất trong 3–5 ngày làm việc sau khi chốt phương án; shop cung cấp tham chiếu và ghi nhận vào sổ đối soát. Website không tự chuyển tiền.' where returns_policy='Nếu giao sai mẫu, thiếu hoa hoặc hoa hỏng khi nhận, hãy liên hệ shop qua điện thoại/Zalo, gửi mã đơn và ảnh để được kiểm tra và thống nhất đổi bó phù hợp hoặc hoàn phần tiền tương ứng. Liên hệ sớm trong ngày nhận để shop xác minh tình trạng hoa. Yêu cầu đổi giờ, địa chỉ hoặc hủy cần được shop xác nhận trước khi bắt đầu bó; phí phát sinh phải được khách đồng ý trước. Shop trao đổi trước mọi thay đổi hoa theo mùa; khách có thể từ chối phương án thay thế trước khi thực hiện. Khoản hoàn được xử lý qua phương thức hai bên thống nhất, rồi ghi nhận trong lịch sử đối soát; website không tự chuyển tiền.';
update public.gd_products p set slug=coalesce(nullif(gd_private.slug_name(p.name),''),'bo-hoa')||'-'||p.id where p.slug='bo-hoa-'||p.id and not exists(select 1 from public.gd_products other where other.id<>p.id and other.slug=coalesce(nullif(gd_private.slug_name(p.name),''),'bo-hoa')||'-'||p.id);
notify pgrst,'reload schema';
commit;
