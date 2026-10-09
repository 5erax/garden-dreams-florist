-- Production ztzpipgptticvliotbsc only. Additive baseline 004 to 012 upgrade.
-- Apply through the project-scoped connection. Existing shop, orders and prices are preserved.
begin;
set local lock_timeout = '10s';
lock table public.gd_shop, public.gd_products, public.gd_orders in share row exclusive mode;
do $$
begin
  if to_regclass('gd_private.runtime') is not null
    or to_regclass('public.gd_product_variants') is not null
    or to_regclass('public.gd_payment_ledger') is not null
    or to_regclass('public.gd_admin_audit') is null
    or exists(select 1 from pg_attribute where attrelid='public.gd_orders'::regclass
      and attname='is_test' and not attisdropped)
    then raise exception 'PRODUCTION_UPGRADE_REQUIRES_BASELINE_004'; end if;
  if not exists(select 1 from public.gd_admins a join auth.users u on u.id=a.user_id
    where lower(u.email)='dha260803@gmail.com' and u.email_confirmed_at is not null)
    then raise exception 'PRODUCTION_UPGRADE_REQUIRES_CONFIRMED_OWNER'; end if;
end;
$$;

-- 202610090005_environment.sql
create table gd_private.runtime (
  id integer primary key check(id=1),
  environment text not null check(environment in ('production','staging','local')),
  project_ref text check(project_ref ~ '^[a-z0-9]{20}$'),
  check((environment='local' and project_ref is null) or (environment<>'local' and project_ref is not null))
);
insert into gd_private.runtime values(1,'production','ztzpipgptticvliotbsc');
revoke all on gd_private.runtime from public,anon,authenticated;

create function gd_private.freeze_environment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' or (exists(select 1 from public.gd_orders) and (new.environment,new.project_ref) is distinct from (old.environment,old.project_ref)) then raise exception 'ENVIRONMENT_LOCKED'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.freeze_environment() from public,anon,authenticated;
create trigger freeze_environment before update or delete on gd_private.runtime for each row execute function gd_private.freeze_environment();

create function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref) from gd_private.runtime where id=1;
$$;
revoke execute on function public.gd_environment() from public;
grant execute on function public.gd_environment() to anon,authenticated;

alter table public.gd_orders add column is_test boolean not null default false;
alter table public.gd_memories add column is_test boolean not null default false;

create function gd_private.classify_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    select environment<>'production' into new.is_test from gd_private.runtime where id=1;
    if new.is_test is null then raise exception 'ENVIRONMENT_REQUIRED'; end if;
  elsif new.is_test is distinct from old.is_test then raise exception 'ORDER_KIND_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.classify_order() from public,anon,authenticated;
create trigger classify_order before insert or update on public.gd_orders for each row execute function gd_private.classify_order();

create function gd_private.classify_memory() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    -- Missing orders only occur in an isolated benchmark that deliberately removes its FK.
    new.is_test := coalesce((select is_test from public.gd_orders where id=new.order_id),true);
  elsif new.is_test is distinct from old.is_test then raise exception 'MEMORY_KIND_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.classify_memory() from public,anon,authenticated;
create trigger classify_memory before insert or update on public.gd_memories for each row execute function gd_private.classify_memory();

create or replace function public.gd_public_memory(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('token',share_token,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at)
  from public.gd_memories where share_token=p_token and not revoked
    and (not is_test or (select environment from gd_private.runtime where id=1)<>'production');
$$;
create or replace function public.gd_garden(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 24) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('token',share_token,'id',id,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at) order by created_at desc,id desc),'[]'::jsonb)
  from (select * from public.gd_memories where listed and not revoked
    and (not is_test or (select environment from gd_private.runtime where id=1)<>'production')
    and (p_before is null or (created_at,id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by created_at desc,id desc limit greatest(1,least(coalesce(p_limit,24),48))) m;
$$;
create or replace function public.gd_memory_count() returns bigint language sql stable security definer set search_path='' as $$
  select count(*) from public.gd_memories where not revoked and not is_test;
$$;

-- Future finance dashboards must read this projection, excluding all test orders.
create view gd_private.real_orders as select * from public.gd_orders where not is_test;
revoke all on gd_private.real_orders from public,anon,authenticated;

-- 202610090006_product_albums.sql
alter table public.gd_products add column images text[] not null default '{}';

create function gd_private.product_album() returns trigger language plpgsql security definer set search_path='' as $$
declare photo text; ref text;
begin
  if cardinality(new.images)>8 or (cardinality(new.images)>0 and
    (array_ndims(new.images)<>1 or array_lower(new.images,1)<>1)) then
    raise exception 'INVALID_PRODUCT_IMAGES';
  end if;
  if cardinality(new.images)<>(select count(distinct p) from unnest(new.images) p) then
    raise exception 'INVALID_PRODUCT_IMAGES';
  end if;
  select project_ref into ref from gd_private.runtime where id=1;
  foreach photo in array new.images loop
    if photo is null or not (photo ~ '^/flowers/[a-zA-Z0-9_.-]+$' or
      (ref is not null and photo ~ ('^https://' || ref || '\.supabase\.co/storage/v1/object/public/gd-product-images/products/[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$'))) then
      raise exception 'INVALID_PRODUCT_IMAGES';
    end if;
  end loop;
  if cardinality(new.images)>0 then new.image := new.images[1]; end if;
  return new;
end;
$$;
revoke execute on function gd_private.product_album() from public,anon,authenticated;
create trigger product_album before insert or update on public.gd_products for each row execute function gd_private.product_album();

-- Storage is absent in the embedded PostgreSQL fixture; hosted Supabase installs this bucket.
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('gd-product-images','gd-product-images',true,2097152,array['image/webp']) on conflict(id) do nothing;
    if not exists(select 1 from storage.buckets where id='gd-product-images' and public
      and file_size_limit=2097152 and allowed_mime_types=array['image/webp']) then
      raise exception 'PRODUCT_BUCKET_CONFIG_CONFLICT';
    end if;
    execute $policy$create policy gd_product_upload on storage.objects for insert to authenticated
      with check(bucket_id='gd-product-images' and gd_private.is_admin()
        and name ~ ('^products/' || auth.uid()::text || '/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'))$policy$;
    execute $policy$create policy gd_product_images_admin_read on storage.objects for select to authenticated
      using(bucket_id='gd-product-images' and gd_private.is_admin())$policy$;
  end if;
end;
$$;

create function gd_private.product_uploads_ready() returns boolean language plpgsql stable security definer set search_path='' as $$
declare ready boolean;
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then return false; end if;
  select exists(select 1 from storage.buckets where id='gd-product-images' and public
    and file_size_limit=2097152 and allowed_mime_types=array['image/webp']) into ready;
  return ready;
end;
$$;
revoke execute on function gd_private.product_uploads_ready() from public,anon,authenticated;
create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready()))
  from gd_private.runtime where id=1;
$$;

-- 202610090007_product_variants.sql
create table public.gd_product_variants (
  id integer generated always as identity primary key,
  product_id integer not null references public.gd_products(id),
  sku text not null unique check(sku ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  size_name text not null check(length(trim(size_name)) between 2 and 60),
  price integer not null check(price between 1000 and 100000000),
  active boolean not null default true,
  version integer not null default 1
);
alter table public.gd_product_variants enable row level security;
revoke all on public.gd_product_variants from anon,authenticated;
grant select on public.gd_product_variants to anon,authenticated;
grant insert,update on public.gd_product_variants to authenticated;
create policy variant_public on public.gd_product_variants for select to anon,authenticated
  using(active and exists(select 1 from public.gd_products p where p.id=product_id and p.active));
create policy variant_admin_read on public.gd_product_variants for select to authenticated using(gd_private.is_admin());
create policy variant_admin_insert on public.gd_product_variants for insert to authenticated with check(gd_private.is_admin());
create policy variant_admin_update on public.gd_product_variants for update to authenticated
  using(gd_private.is_admin()) with check(gd_private.is_admin());
create function gd_private.variant_parent() returns trigger language plpgsql set search_path='' as $$
begin
  if new.product_id is distinct from old.product_id then raise exception 'VARIANT_PARENT_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.variant_parent() from public,anon,authenticated;
create trigger variant_parent before update on public.gd_product_variants for each row execute function gd_private.variant_parent();
create trigger variant_version before update on public.gd_product_variants for each row execute function gd_private.touch_version();
create trigger variant_audit after insert or update on public.gd_product_variants for each row execute function gd_private.audit_config();
create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),'productVariants',true))
  from gd_private.runtime where id=1;
$$;

-- 202610090008_variant_orders.sql
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

-- 202610090009_delivery_calendar.sql
create table public.gd_delivery_settings (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  version integer not null default 1
);
insert into public.gd_delivery_settings(id) values (1);

create table public.gd_delivery_rules (
  id uuid primary key default gen_random_uuid(),
  shipping_id uuid not null references public.gd_shipping(id),
  delivery_time text not null check (delivery_time in ('Sáng · 9–12h','Chiều · 13–17h','Tối · 18–20h')),
  weekdays integer[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
  capacity integer not null check (capacity between 0 and 500),
  lead_minutes integer not null check (lead_minutes between 0 and 43200),
  active boolean not null default false,
  version integer not null default 1,
  unique(shipping_id, delivery_time)
);
create table public.gd_delivery_closures (
  id uuid primary key default gen_random_uuid(),
  shipping_id uuid not null references public.gd_shipping(id),
  delivery_date date not null,
  reason text not null default '' check (length(reason) <= 200),
  active boolean not null default true,
  version integer not null default 1,
  unique(shipping_id, delivery_date)
);
alter table public.gd_orders add column delivery_rule_id uuid references public.gd_delivery_rules(id);
create index gd_delivery_usage on public.gd_orders(delivery_date,delivery_time,(shipping->>'id'))
  where status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED');

alter table public.gd_delivery_settings enable row level security;
alter table public.gd_delivery_rules enable row level security;
alter table public.gd_delivery_closures enable row level security;
revoke all on public.gd_delivery_settings, public.gd_delivery_rules, public.gd_delivery_closures from public,anon,authenticated;
grant select on public.gd_delivery_settings, public.gd_delivery_rules, public.gd_delivery_closures to authenticated;
create policy delivery_settings_admin on public.gd_delivery_settings for select to authenticated using(gd_private.is_admin());
create policy delivery_rules_admin on public.gd_delivery_rules for select to authenticated using(gd_private.is_admin());
create policy delivery_closures_admin on public.gd_delivery_closures for select to authenticated using(gd_private.is_admin());

create trigger delivery_settings_version before update on public.gd_delivery_settings for each row execute function gd_private.touch_version();
create trigger delivery_rules_version before update on public.gd_delivery_rules for each row execute function gd_private.touch_version();
create trigger delivery_closures_version before update on public.gd_delivery_closures for each row execute function gd_private.touch_version();
create trigger delivery_settings_audit after update on public.gd_delivery_settings for each row execute function gd_private.audit_config();
create trigger delivery_rules_audit after insert or update on public.gd_delivery_rules for each row execute function gd_private.audit_config();
create trigger delivery_closures_audit after insert or update on public.gd_delivery_closures for each row execute function gd_private.audit_config();

create function gd_private.delivery_used(p_shipping uuid,p_day date,p_time text) returns integer
language sql volatile security definer set search_path='' as $$
  select count(*)::integer from public.gd_orders
  where shipping->>'id'=p_shipping::text and delivery_date=p_day and delivery_time=p_time
    and status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED');
$$;
revoke execute on function gd_private.delivery_used(uuid,date,text) from public,anon,authenticated;

create function gd_private.delivery_option(p_shipping uuid,p_day date,p_time text,p_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  rule public.gd_delivery_rules;
  start_time time;
  cutoff timestamptz;
  used integer := 0;
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
revoke execute on function gd_private.delivery_option(uuid,date,text,timestamptz) from public,anon,authenticated;

create function public.gd_delivery_options(p_shipping uuid,p_day date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare enabled boolean; slots jsonb := '[]'; label text;
begin
  if p_day is null or p_day < (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
    or p_day > (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date+90 then raise exception 'INVALID_DATE'; end if;
  select s.enabled into enabled from public.gd_delivery_settings s where id=1;
  if not enabled then return jsonb_build_object('enabled',false,'slots','[]'::jsonb); end if;
  if not exists(select 1 from public.gd_shop where id=1 and accepting_orders)
    or not exists(select 1 from public.gd_shipping where id=p_shipping and active) then
    return jsonb_build_object('enabled',true,'slots','[]'::jsonb,'reason','CLOSED');
  end if;
  foreach label in array array['Sáng · 9–12h','Chiều · 13–17h','Tối · 18–20h'] loop
    slots := slots || jsonb_build_array(gd_private.delivery_option(p_shipping,p_day,label,statement_timestamp()));
  end loop;
  return jsonb_build_object('enabled',true,'slots',slots);
end;
$$;
revoke execute on function public.gd_delivery_options(uuid,date) from public;
grant execute on function public.gd_delivery_options(uuid,date) to anon,authenticated;

create function public.gd_save_delivery_rule(p_id uuid,p_version integer,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  current public.gd_delivery_rules;
  saved public.gd_delivery_rules;
  v_shipping uuid;
  label text;
  days integer[];
  v_capacity integer;
  v_lead integer;
  peak integer;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform 1 from public.gd_delivery_settings where id=1 for update;
  if jsonb_typeof(p_fields) is distinct from 'object'
    or jsonb_typeof(p_fields->'weekdays') is distinct from 'array'
    or jsonb_array_length(p_fields->'weekdays') not between 1 and 7
    or jsonb_typeof(p_fields->'active') is distinct from 'boolean'
    or jsonb_typeof(p_fields->'capacity') is distinct from 'number'
    or jsonb_typeof(p_fields->'leadMinutes') is distinct from 'number'
    or p_fields->>'capacity' !~ '^\d+$' or p_fields->>'leadMinutes' !~ '^\d+$'
    or exists(select 1 from jsonb_array_elements(p_fields->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[1-7]$')
    then raise exception 'INVALID_DELIVERY_RULE'; end if;
  v_shipping := (p_fields->>'shippingId')::uuid;
  label := p_fields->>'deliveryTime';
  select array_agg(distinct d::text::integer order by d::text::integer)
    into days from jsonb_array_elements(p_fields->'weekdays') d;
  v_capacity := (p_fields->>'capacity')::integer;
  v_lead := (p_fields->>'leadMinutes')::integer;
  if p_id is not null then
    select * into current from public.gd_delivery_rules where id=p_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if current.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
    if current.shipping_id is distinct from v_shipping or current.delivery_time is distinct from label
      then raise exception 'DELIVERY_RULE_IDENTITY_IMMUTABLE'; end if;
  end if;
  select coalesce(max(held),0) into peak from (
    select count(*)::integer held from public.gd_orders
    where shipping->>'id'=v_shipping::text and delivery_time=label
      and delivery_date >= (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
      and status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED') group by delivery_date
  ) usage;
  if v_capacity < peak then raise exception 'CAPACITY_BELOW_RESERVATIONS'; end if;
  if p_id is null then
    insert into public.gd_delivery_rules(shipping_id,delivery_time,weekdays,capacity,lead_minutes,active)
      values(v_shipping,label,days,v_capacity,v_lead,(p_fields->>'active')::boolean) returning * into saved;
  else
    update public.gd_delivery_rules set weekdays=days,capacity=v_capacity,lead_minutes=v_lead,active=(p_fields->>'active')::boolean
      where id=p_id returning * into saved;
  end if;
  return to_jsonb(saved);
end;
$$;
revoke execute on function public.gd_save_delivery_rule(uuid,integer,jsonb) from public,anon;
grant execute on function public.gd_save_delivery_rule(uuid,integer,jsonb) to authenticated;

create function public.gd_set_delivery_calendar(p_version integer,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current public.gd_delivery_settings;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform 1 from public.gd_delivery_settings where id=1 for update;
  select * into current from public.gd_delivery_settings where id=1 for update;
  if current.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_enabled is null then raise exception 'INVALID_DELIVERY_RULE'; end if;
  if p_enabled and not exists(select 1 from public.gd_delivery_rules r join public.gd_shipping s on s.id=r.shipping_id
    where r.active and r.capacity>0 and s.active) then raise exception 'DELIVERY_RULE_REQUIRED'; end if;
  update public.gd_delivery_settings set enabled=p_enabled where id=1 returning * into current;
  return to_jsonb(current);
end;
$$;
revoke execute on function public.gd_set_delivery_calendar(integer,boolean) from public,anon;
grant execute on function public.gd_set_delivery_calendar(integer,boolean) to authenticated;

create function public.gd_save_delivery_closure(p_id uuid,p_version integer,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  current public.gd_delivery_closures;
  saved public.gd_delivery_closures;
  v_shipping uuid;
  day date;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform 1 from public.gd_delivery_settings where id=1 for update;
  if jsonb_typeof(p_fields) is distinct from 'object'
    or jsonb_typeof(p_fields->'active') is distinct from 'boolean'
    or p_fields->>'date' is null or p_fields->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(p_fields->'reason') is distinct from 'string' then raise exception 'INVALID_DELIVERY_RULE'; end if;
  v_shipping := (p_fields->>'shippingId')::uuid;
  day := (p_fields->>'date')::date;
  if day < (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
    or day > (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date+365 then raise exception 'INVALID_DATE'; end if;
  if p_id is not null then
    select * into current from public.gd_delivery_closures where id=p_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if current.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
    if current.shipping_id is distinct from v_shipping or current.delivery_date is distinct from day
      then raise exception 'DELIVERY_RULE_IDENTITY_IMMUTABLE'; end if;
  end if;
  if (p_fields->>'active')::boolean and exists(select 1 from public.gd_orders where shipping->>'id'=v_shipping::text
    and delivery_date=day and status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED'))
    then raise exception 'DAY_HAS_RESERVATIONS'; end if;
  if p_id is null then
    insert into public.gd_delivery_closures(shipping_id,delivery_date,reason,active)
      values(v_shipping,day,trim(p_fields->>'reason'),(p_fields->>'active')::boolean) returning * into saved;
  else
    update public.gd_delivery_closures set reason=trim(p_fields->>'reason'),active=(p_fields->>'active')::boolean
      where id=p_id returning * into saved;
  end if;
  return to_jsonb(saved);
end;
$$;
revoke execute on function public.gd_save_delivery_closure(uuid,integer,jsonb) from public,anon;
grant execute on function public.gd_save_delivery_closure(uuid,integer,jsonb) to authenticated;

create function gd_private.guard_delivery_calendar() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  managed boolean;
  option jsonb;
  rule public.gd_delivery_rules;
  v_shipping uuid;
begin
  v_shipping := (new.shipping->>'id')::uuid;
  select enabled into managed from public.gd_delivery_settings where id=1 for share;
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
revoke execute on function gd_private.guard_delivery_calendar() from public,anon,authenticated;
create trigger guard_delivery_calendar before insert or update on public.gd_orders
  for each row execute function gd_private.guard_delivery_calendar();

create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),
      'productVariants',true,'variantOrders',true,'deliveryCalendar',true))
  from gd_private.runtime where id=1;
$$;

-- 202610090010_operations_desk.sql
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

-- 202610090011_order_requests.sql
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

-- 202610100012_payment_ledger.sql
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

notify pgrst, 'reload schema';
commit;
select public.gd_environment() as upgraded_environment;
