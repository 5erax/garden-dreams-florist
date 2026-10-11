begin;
set local lock_timeout='10s';
do $$ begin if public.gd_environment()->>'projectRef' not in ('ztzpipgptticvliotbsc','tgvozhrkolcpszyyrgth') or to_regclass('public.gd_recipes') is null then raise exception 'AUDIT_REQUIRES_KNOWN_SCHEMA'; end if; end $$;
alter table public.gd_shop add column opens_at time not null default '08:00', add column closes_at time not null default '17:00', add column closed_message text not null default '' check(length(closed_message)<=500), add column reopens_on date, add column returns_policy text not null default 'Nếu giao sai mẫu, thiếu hoa hoặc hoa hỏng khi nhận, hãy liên hệ shop qua điện thoại/Zalo, gửi mã đơn và ảnh để được kiểm tra và thống nhất đổi bó phù hợp hoặc hoàn phần tiền tương ứng. Liên hệ sớm trong ngày nhận để shop xác minh tình trạng hoa. Yêu cầu đổi giờ, địa chỉ hoặc hủy cần được shop xác nhận trước khi bắt đầu bó; phí phát sinh phải được khách đồng ý trước. Shop trao đổi trước mọi thay đổi hoa theo mùa; khách có thể từ chối phương án thay thế trước khi thực hiện. Khoản hoàn được xử lý qua phương thức hai bên thống nhất, rồi ghi nhận trong lịch sử đối soát; website không tự chuyển tiền.' check(length(returns_policy)<=4000), add column legal_name text not null default '' check(length(legal_name)<=200), add column registration_number text not null default '' check(length(registration_number)<=80), add check(closes_at>opens_at);
alter table public.gd_ingredients add column minimum_stock integer not null default 0 check(minimum_stock between 0 and 9999999);
alter table public.gd_ingredients drop constraint gd_ingredients_unit_check;
alter table public.gd_ingredients add constraint gd_ingredients_unit_check check(unit in ('STEM','UNIT','ROLL','GRAM'));
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
    update public.gd_inventory_settings set enabled=target_enabled where id=1;
    answer:=jsonb_build_object('enabled',target_enabled);
  end if;
  insert into public.gd_inventory_operations(id,actor_id,hash,result) values(p_id,auth.uid(),digest,answer);
  insert into public.gd_admin_audit(actor_id,entity,entity_id,action,after_data) values(auth.uid(),'inventory',p_id::text,p_action,jsonb_build_object('result',answer));
  return answer;
end; $$;
alter table public.gd_products alter column slug drop expression;
alter table public.gd_products add constraint gd_product_slug_format check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 100);
alter table public.gd_products add column occasions text[] not null default '{}', add column image_alts jsonb not null default '{}' check(jsonb_typeof(image_alts)='object' and length(image_alts::text)<=4000), add column sort_order integer not null default 0;
alter table public.gd_products add constraint gd_product_occasions check(cardinality(occasions)<=9 and occasions <@ array['Sinh nhật','Tình yêu','Chúc mừng','Cưới hỏi','20/10','8/3','20/11','Khai trương','Chia buồn']::text[]);
alter table public.gd_products add column recipe_managed boolean not null default false;
create function gd_private.recipe_catalog_text() returns trigger language plpgsql security definer set search_path='' as $$ declare composition text; begin
 select string_agg(i.name||' × '||l.quantity::text,'; ' order by i.id) into composition from public.gd_recipes r join public.gd_recipe_lines l on l.recipe_id=r.id join public.gd_ingredients i on i.id=l.ingredient_id where r.product_id=new.id and r.variant_id is null and r.active;
 new.recipe_managed:=composition is not null;
 if new.recipe_managed then new.stems:=case when length(composition)>200 then left(composition,197)||'…' else composition end;end if;
 return new;
end $$;
revoke execute on function gd_private.recipe_catalog_text() from public,anon,authenticated;
create trigger gd_recipe_catalog_text before insert or update on public.gd_products for each row execute function gd_private.recipe_catalog_text();
create function gd_private.product_slug_default() returns trigger language plpgsql set search_path='' as $$ begin if new.slug is null or new.slug='' then new.slug:='bo-hoa-'||new.id; end if; return new; end $$;
revoke execute on function gd_private.product_slug_default() from public,anon,authenticated;
create trigger gd_product_slug_default before insert on public.gd_products for each row execute function gd_private.product_slug_default();
create function public.gd_reorder_products(p_ids integer[]) returns void language plpgsql security definer set search_path='' as $$ begin
 if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-order',0));
 if p_ids is null or cardinality(p_ids)<>(select count(*) from public.gd_products) or cardinality(p_ids)<>(select count(distinct value) from unnest(p_ids) value) or exists(select 1 from unnest(p_ids) value where not exists(select 1 from public.gd_products where id=value)) then raise exception 'INVALID_ITEMS'; end if;
 update public.gd_products p set sort_order=ids.position from unnest(p_ids) with ordinality ids(id,position) where p.id=ids.id;
end $$;
revoke execute on function public.gd_reorder_products(integer[]) from public,anon;grant execute on function public.gd_reorder_products(integer[]) to authenticated;
alter table public.gd_memories add column moderation_removed boolean not null default false, add column moderation_version integer not null default 1;
create function public.gd_admin_memories() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (select id,flower_name,flower_image,message,signature,created_at,moderation_removed,moderation_version from public.gd_memories where (listed or moderation_removed) and not revoked and (not is_test or (select environment from gd_private.runtime where id=1)<>'production') order by created_at desc,id desc limit 100) m);
end $$;
create function public.gd_moderate_memory(p_id uuid,p_version integer,p_remove boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$ declare old public.gd_memories; begin
 if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_remove is null or length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'INVALID_NOTE'; end if;
 select * into old from public.gd_memories where id=p_id and (listed or moderation_removed) for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if old.moderation_version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
 update public.gd_memories set moderation_removed=p_remove,moderation_version=moderation_version+1 where id=p_id;
 insert into public.gd_order_events(order_id,actor_id,event,note) values(old.order_id,auth.uid(),case when p_remove then 'Shop gỡ lời nhắn khỏi khu vườn' else 'Shop duyệt lại lời nhắn trong khu vườn' end,trim(p_reason));
end $$;
revoke execute on function public.gd_admin_memories() from public,anon;grant execute on function public.gd_admin_memories() to authenticated;
revoke execute on function public.gd_moderate_memory(uuid,integer,boolean,text) from public,anon;grant execute on function public.gd_moderate_memory(uuid,integer,boolean,text) to authenticated;
create or replace function public.gd_public_memory(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('token',share_token,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at)
  from public.gd_memories where share_token=p_token and not revoked and not moderation_removed
    and (not is_test or (select environment from gd_private.runtime where id=1)<>'production');
$$;
create or replace function public.gd_garden(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 24) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('token',share_token,'id',id,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at) order by created_at desc,id desc),'[]'::jsonb)
  from (select * from public.gd_memories where listed and not revoked and not moderation_removed
    and (not is_test or (select environment from gd_private.runtime where id=1)<>'production')
    and (p_before is null or (created_at,id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by created_at desc,id desc limit greatest(1,least(coalesce(p_limit,24),48))) m;
$$;
create or replace function public.gd_memory_count() returns bigint language sql stable security definer set search_path='' as $$ select count(*) from public.gd_memories where listed and not revoked and not moderation_removed and (not is_test or (select environment from gd_private.runtime where id=1)<>'production'); $$;
create function public.gd_close_delivery_range(p_from date,p_to date,p_shipping uuid,p_reason text) returns integer language plpgsql security definer set search_path='' as $$ declare target uuid; day date; existing public.gd_delivery_closures; count integer:=0; begin
 if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>30 or length(trim(coalesce(p_reason,''))) not between 5 and 200 then raise exception 'INVALID_DELIVERY_RULE'; end if;
 perform 1 from public.gd_delivery_settings where id=1 for update;
 for target in select id from public.gd_shipping where p_shipping is null or id=p_shipping order by id loop
  for day in select d::date from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d loop
   select * into existing from public.gd_delivery_closures where shipping_id=target and delivery_date=day;
   perform public.gd_save_delivery_closure(existing.id,existing.version,jsonb_build_object('shippingId',target,'date',day,'reason',p_reason,'active',true));count:=count+1;
  end loop;
 end loop;
 if count=0 then raise exception 'SHIPPING_UNAVAILABLE'; end if;
 return count;
end $$;
revoke execute on function public.gd_close_delivery_range(date,date,uuid,text) from public,anon;grant execute on function public.gd_close_delivery_range(date,date,uuid,text) to authenticated;

alter table public.gd_orders add column buyer_name text check(buyer_name is null or length(buyer_name) between 2 and 80), add column buyer_phone text check(buyer_phone is null or buyer_phone ~ '^(0|\+84)[35789][0-9]{8}$');
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
  insert into public.gd_orders(id,owner_id,reference,request_body,recipient_name,recipient_phone,address,card_message,delivery_date,delivery_time,items,subtotal,shipping,total,payment_method,bank,buyer_name,buyer_phone)
  values(rid,uid,'GD-'||upper(substr(replace(rid::text,'-',''),1,16)),jsonb_build_object('hash',body_hash),name,phone,address,message,day,p_request->>'deliveryTime',lines,amount,
    jsonb_build_object('id',delivery.id,'name',delivery.name,'area',delivery.area,'fee',delivery.fee),amount+delivery.fee,pay,
    case when pay='VIETQR' then jsonb_build_object('bin',cfg.bank_bin,'account',cfg.bank_account,'bankName',cfg.bank_name,'accountName',cfg.account_name) end,nullif(trim(p_request->>'buyerName'),''),nullif(regexp_replace(p_request->>'buyerPhone','[\s().-]','','g'),''))
  returning * into result;
  insert into public.gd_order_events(order_id,actor_id,event) values(rid,uid,'Đã tạo yêu cầu đặt hoa');
  return to_jsonb(result) - 'request_body';
end;
$$;
create function gd_private.erase_buyer_contact() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.contacts_erased_at is not null then new.buyer_name:=null;new.buyer_phone:=null;end if;return new;end $$;
revoke execute on function gd_private.erase_buyer_contact() from public,anon,authenticated;
create trigger gd_erase_buyer_contact before update on public.gd_orders for each row execute function gd_private.erase_buyer_contact();
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
      and (p_queue='ALL' or status=p_queue or (p_queue='OVERDUE' and delivery_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date and status in ('PENDING','CONFIRMED','PREPARING','SHIPPING')) or (p_queue='PACKING' and status in ('CONFIRMED','PREPARING')) or (p_queue='COLLECTION' and payment_status='UNPAID' and status<>'CANCELLED'))
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
    'receivableNow',(select coalesce(sum(total),0) from orders where payment_status='UNPAID' and status<>'CANCELLED'),
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
  return report || jsonb_build_object('previous',(select jsonb_build_object('orders',count(*),'bookedValue',coalesce(sum(total) filter(where status<>'CANCELLED'),0)) from public.gd_orders where (not is_test or staging) and created_at>=((p_from-(p_to-p_from+1))::timestamp at time zone 'Asia/Ho_Chi_Minh') and created_at<start_at),'overdueNow',(select count(*) from public.gd_orders where (not is_test or staging) and status in ('PENDING','CONFIRMED','PREPARING','SHIPPING') and delivery_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date));
end;
$$;
notify pgrst,'reload schema';commit;
