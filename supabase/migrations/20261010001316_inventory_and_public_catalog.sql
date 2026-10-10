begin;
set local lock_timeout='10s';
do $$ begin
  if public.gd_environment()->>'projectRef' not in ('ztzpipgptticvliotbsc','tgvozhrkolcpszyyrgth')
    or to_regclass('public.gd_payment_ledger') is null then raise exception 'INVENTORY_REQUIRES_KNOWN_SCHEMA_012'; end if;
end; $$;
alter table public.gd_products add column slug text generated always as ('bo-hoa-' || id::text) stored;
create unique index gd_products_slug on public.gd_products(slug);

create table public.gd_inventory_settings (
  id integer primary key check(id=1), enabled boolean not null default false
);
insert into public.gd_inventory_settings(id) values(1);
create table public.gd_ingredients (
  id integer generated always as identity primary key,
  name text not null check(length(trim(name)) between 2 and 120),
  unit text not null check(unit in ('STEM','UNIT')), active boolean not null default true
);
create unique index gd_ingredient_name_unit on public.gd_ingredients(lower(name),unit);
create table public.gd_stock_batches (
  id uuid primary key, ingredient_id integer not null references public.gd_ingredients(id),
  code text not null check(length(code) between 1 and 80), supplier text not null default '' check(length(supplier)<=120),
  arrived_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  expires_on date not null, unit_cost integer not null check(unit_cost between 0 and 100000000),
  on_hand integer not null check(on_hand>=0), reserved integer not null default 0 check(reserved>=0 and reserved<=on_hand),
  created_at timestamptz not null default now(), check(expires_on>=arrived_on)
);
create index gd_stock_fefo on public.gd_stock_batches(ingredient_id,expires_on,arrived_on,id);
create table public.gd_recipes (
  id uuid primary key, product_id integer not null references public.gd_products(id),
  variant_id integer references public.gd_product_variants(id), revision integer not null check(revision>0),
  active boolean not null default true, actor_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create unique index gd_recipe_active on public.gd_recipes(product_id,coalesce(variant_id,0)) where active;
create table public.gd_recipe_lines (
  recipe_id uuid not null references public.gd_recipes(id), ingredient_id integer not null references public.gd_ingredients(id),
  quantity integer not null check(quantity between 1 and 10000), primary key(recipe_id,ingredient_id)
);
create table public.gd_stock_allocations (
  order_id uuid not null references public.gd_orders(id), recipe_id uuid not null references public.gd_recipes(id),
  batch_id uuid not null references public.gd_stock_batches(id), quantity integer not null check(quantity>0),
  status text not null default 'HELD' check(status in ('HELD','CONSUMED','RELEASED')),
  unit_cost integer not null check(unit_cost>=0), primary key(order_id,recipe_id,batch_id)
);
create index gd_allocations_held_batch on public.gd_stock_allocations(batch_id) where status='HELD';
create table public.gd_stock_movements (
  id bigint generated always as identity primary key, batch_id uuid not null references public.gd_stock_batches(id),
  order_id uuid references public.gd_orders(id), operation_id uuid,
  kind text not null check(kind in ('RECEIVE','WASTE','CONSUME')), delta integer not null check(delta<>0),
  unit_cost integer not null check(unit_cost>=0), reason text not null default '' check(length(reason)<=500),
  actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check((kind='RECEIVE' and delta>0) or (kind in ('WASTE','CONSUME') and delta<0))
);
create unique index gd_consume_once on public.gd_stock_movements(order_id,batch_id) where kind='CONSUME';
create table public.gd_inventory_operations (
  id uuid primary key, actor_id uuid not null references auth.users(id), hash text not null, result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.gd_orders add column inventory_managed boolean not null default false;

do $$ declare tab text; begin
  foreach tab in array array['gd_inventory_settings','gd_ingredients','gd_stock_batches','gd_recipes','gd_recipe_lines','gd_stock_allocations','gd_stock_movements','gd_inventory_operations'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated',tab);
    execute format('grant select on public.%I to authenticated',tab);
    execute format('create policy inventory_admin on public.%I for select to authenticated using(gd_private.is_admin())',tab);
  end loop;
end; $$;

create function public.gd_inventory_command(p_id uuid,p_action text,p_body jsonb) returns jsonb
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
    if p_body->>'name' is null or length(trim(p_body->>'name')) not between 2 and 120 or p_body->>'unit' is null or p_body->>'unit' not in ('STEM','UNIT') then raise exception 'INVALID_INVENTORY'; end if;
    insert into public.gd_ingredients(name,unit) values(trim(p_body->>'name'),p_body->>'unit') returning id into ingredient;
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
    update public.gd_inventory_settings set enabled=target_enabled where id=1;
    answer:=jsonb_build_object('enabled',target_enabled);
  end if;
  insert into public.gd_inventory_operations(id,actor_id,hash,result) values(p_id,auth.uid(),digest,answer);
  insert into public.gd_admin_audit(actor_id,entity,entity_id,action,after_data) values(auth.uid(),'inventory',p_id::text,p_action,jsonb_build_object('result',answer));
  return answer;
end; $$;
revoke execute on function public.gd_inventory_command(uuid,text,jsonb) from public,anon;
grant execute on function public.gd_inventory_command(uuid,text,jsonb) to authenticated;

create function gd_private.mark_inventory_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('garden-dreams-inventory',0));
    new.inventory_managed:=(select enabled from public.gd_inventory_settings where id=1);
  elsif new.inventory_managed is distinct from old.inventory_managed then raise exception 'INVENTORY_SNAPSHOT_IMMUTABLE'; end if;
  return new;
end; $$;
revoke execute on function gd_private.mark_inventory_order() from public,anon,authenticated;
create trigger mark_inventory_order before insert or update on public.gd_orders for each row execute function gd_private.mark_inventory_order();

create function gd_private.allocate_inventory() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; recipe public.gd_recipes; ingredient record; batch public.gd_stock_batches; needed integer; take integer;
begin
  if not new.inventory_managed then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('garden-dreams-inventory',0));
  for item in select value from jsonb_array_elements(new.items) order by (value->>'id')::integer, coalesce((value->>'variantId')::integer,0) loop
    select * into recipe from public.gd_recipes where active and product_id=(item->>'id')::integer and variant_id is not distinct from (item->>'variantId')::integer;
    if not found then raise exception 'RECIPE_REQUIRED'; end if;
    for ingredient in select * from public.gd_recipe_lines where recipe_id=recipe.id order by ingredient_id loop
      needed:=ingredient.quantity*(item->>'quantity')::integer;
      for batch in select * from public.gd_stock_batches where ingredient_id=ingredient.ingredient_id and arrived_on<=new.delivery_date and expires_on>=new.delivery_date and on_hand>reserved order by expires_on,arrived_on,id for update loop
        take:=least(needed,batch.on_hand-batch.reserved);
        update public.gd_stock_batches set reserved=reserved+take where id=batch.id;
        insert into public.gd_stock_allocations(order_id,recipe_id,batch_id,quantity,unit_cost) values(new.id,recipe.id,batch.id,take,batch.unit_cost);
        needed:=needed-take; exit when needed=0;
      end loop;
      if needed>0 then raise exception 'STOCK_SHORTAGE'; end if;
    end loop;
  end loop;
  return new;
end; $$;
revoke execute on function gd_private.allocate_inventory() from public,anon,authenticated;
create trigger reserve_order_inventory after insert on public.gd_orders for each row execute function gd_private.allocate_inventory();

create function gd_private.finish_inventory() returns trigger language plpgsql security definer set search_path='' as $$
declare allocation record;
begin
  if not old.inventory_managed or new.status=old.status or new.status not in ('PREPARING','CANCELLED') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('garden-dreams-inventory',0));
  for allocation in select batch_id,sum(quantity)::integer quantity,max(unit_cost) unit_cost from public.gd_stock_allocations where order_id=new.id and status='HELD' group by batch_id order by batch_id loop
    if new.status='PREPARING' and exists(select 1 from public.gd_stock_batches where id=allocation.batch_id and expires_on<(now() at time zone 'Asia/Ho_Chi_Minh')::date) then raise exception 'STOCK_EXPIRED'; end if;
    update public.gd_stock_batches set reserved=reserved-allocation.quantity,on_hand=on_hand-case when new.status='PREPARING' then allocation.quantity else 0 end where id=allocation.batch_id;
    if new.status='PREPARING' then insert into public.gd_stock_movements(batch_id,order_id,kind,delta,unit_cost,actor_id) values(allocation.batch_id,new.id,'CONSUME',-allocation.quantity,allocation.unit_cost,auth.uid()); end if;
  end loop;
  update public.gd_stock_allocations set status=case when new.status='PREPARING' then 'CONSUMED' else 'RELEASED' end where order_id=new.id and status='HELD';
  return new;
end; $$;
revoke execute on function gd_private.finish_inventory() from public,anon,authenticated;
create trigger finish_order_inventory after update on public.gd_orders for each row execute function gd_private.finish_inventory();

create function public.gd_inventory_state() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return jsonb_build_object('enabled',(select enabled from public.gd_inventory_settings where id=1),
    'ingredients',coalesce((select jsonb_agg(to_jsonb(i) order by name) from public.gd_ingredients i),'[]'::jsonb),
    'batches',coalesce((select jsonb_agg(to_jsonb(b)) from (select * from public.gd_stock_batches order by created_at desc,id limit 200) b),'[]'::jsonb),
    'recipes',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('lines',(select jsonb_agg(to_jsonb(l)) from public.gd_recipe_lines l where recipe_id=r.id))) from public.gd_recipes r where active),'[]'::jsonb),
    'movements',coalesce((select jsonb_agg(to_jsonb(m)) from (select * from public.gd_stock_movements order by id desc limit 50) m),'[]'::jsonb));
end; $$;
revoke execute on function public.gd_inventory_state() from public,anon;
grant execute on function public.gd_inventory_state() to authenticated;

create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),
      'productVariants',true,'variantOrders',true,'deliveryCalendar',true,'operationsDesk',true,'orderRequests',true,'reconciliationLedger',true,'inventory',true,'productPages',true)) from gd_private.runtime where id=1;
$$;
notify pgrst,'reload schema';
commit;
