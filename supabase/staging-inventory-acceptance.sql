-- Staging-only stock/BOM acceptance. All sample recipes, stock, orders and temporary admin roll back.
begin;
set local lock_timeout='10s';
do $$ declare actor uuid; begin
  if public.gd_environment()->>'projectRef' is distinct from 'tgvozhrkolcpszyyrgth' or public.gd_environment()->>'environment' is distinct from 'staging'
    then raise exception 'ACCEPTANCE_REQUIRES_STAGING'; end if;
  if exists(select 1 from public.gd_stock_batches) or exists(select 1 from public.gd_recipes)
    then raise exception 'INVENTORY_ACCEPTANCE_REQUIRES_EMPTY_INVENTORY'; end if;
  select id into actor from auth.users u where email_confirmed_at is not null and not coalesce(is_anonymous,false)
    and not exists(select 1 from public.gd_admins a where a.user_id=u.id) and not exists(select 1 from public.gd_orders o where o.owner_id=u.id) limit 1;
  if actor is null then raise exception 'ACCEPTANCE_REQUIRES_UNUSED_CONFIRMED_CUSTOMER'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
  insert into public.gd_admins(user_id) values(actor);
  update public.gd_shop set accepting_orders=true,cod_enabled=true;
  update public.gd_delivery_settings set enabled=false where id=1;
  insert into public.gd_shipping(name,area,fee,active) values('QA inventory shipping','Synthetic address',0,true);
end; $$;
set local role authenticated;
do $$
declare ingredient integer; batch_a uuid:=gen_random_uuid(); batch_b uuid:=gen_random_uuid(); waste_id uuid:=gen_random_uuid();
  sample record; product record; shipping_id uuid; request jsonb; first_order jsonb; second_order jsonb; received jsonb; state jsonb; day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date+2;
begin
  ingredient:=(public.gd_inventory_command(gen_random_uuid(),'INGREDIENT',jsonb_build_object('name','QA inventory stems','unit','STEM'))->>'ingredientId')::integer;
  for sample in select id product_id,null::integer variant_id from public.gd_products where active union all select v.product_id,v.id from public.gd_product_variants v join public.gd_products p on p.id=v.product_id where v.active and p.active loop
    perform public.gd_inventory_command(gen_random_uuid(),'RECIPE',jsonb_build_object('productId',sample.product_id,'variantId',sample.variant_id,'lines',jsonb_build_array(jsonb_build_object('ingredientId',ingredient,'quantity',3))));
  end loop;
  perform public.gd_inventory_command(batch_a,'RECEIVE',jsonb_build_object('ingredientId',ingredient,'quantity',4,'unitCost',10000,'code','QA FEFO A','expiresOn',day::text));
  received:=jsonb_build_object('ingredientId',ingredient,'quantity',3,'unitCost',12000,'code','QA FEFO B','expiresOn',(day+3)::text);
  perform public.gd_inventory_command(batch_b,'RECEIVE',received);
  perform public.gd_inventory_command(batch_b,'RECEIVE',received);
  if (select count(*) from public.gd_stock_movements where operation_id=batch_b)<>1 then raise exception 'RECEIVE_DUPLICATED'; end if;
  perform public.gd_inventory_command(gen_random_uuid(),'ENABLE','{"enabled":true}');
  select id,price into product from public.gd_products where active order by id limit 1;
  select id into shipping_id from public.gd_shipping where name='QA inventory shipping';
  request:=jsonb_build_object('requestId',gen_random_uuid(),'name','Fixture recipient','phone','0900000000','address','Synthetic QA address only',
    'message','','consent',true,'deliveryDate',day::text,'deliveryTime','Chiều · 13–17h','items',jsonb_build_array(jsonb_build_object('id',product.id,'quantity',1)),
    'shippingId',shipping_id,'paymentMethod','COD','expectedTotal',product.price);
  first_order:=public.gd_create_order(request);
  if public.gd_create_order(request)->>'id'<>first_order->>'id' or (select reserved from public.gd_stock_batches where id=batch_a)<>3 then raise exception 'FEFO_OR_ORDER_RETRY_FAILED'; end if;
  request:=jsonb_set(request,array['requestId'],to_jsonb(gen_random_uuid()::text));
  second_order:=public.gd_create_order(request);
  if (select count(*) from public.gd_stock_allocations where order_id=(second_order->>'id')::uuid)<>2 then raise exception 'PARTIAL_ALLOCATION_FAILED'; end if;
  begin
    perform public.gd_create_order(jsonb_set(request,array['requestId'],to_jsonb(gen_random_uuid()::text)));
    raise exception 'SHORTAGE_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'STOCK_SHORTAGE' then raise; end if; end;
  if (select sum(reserved) from public.gd_stock_batches)<>6 then raise exception 'SHORTAGE_DID_NOT_ROLL_BACK'; end if;
  begin
    perform public.gd_inventory_command(gen_random_uuid(),'WASTE',jsonb_build_object('batchId',batch_a,'quantity',1,'reason','QA damaged held stem'));
    raise exception 'HELD_STOCK_WASTED';
  exception when raise_exception then if sqlerrm<>'STOCK_RESERVED_OR_INSUFFICIENT' then raise; end if; end;
  perform public.gd_update_order((second_order->>'id')::uuid,(second_order->>'version')::integer,'CANCELLED','UNPAID','');
  if (select sum(reserved) from public.gd_stock_batches)<>3 then raise exception 'CANCEL_RELEASE_FAILED'; end if;
  first_order:=public.gd_update_order((first_order->>'id')::uuid,(first_order->>'version')::integer,'CONFIRMED','UNPAID','');
  first_order:=public.gd_update_order((first_order->>'id')::uuid,(first_order->>'version')::integer,'PREPARING','UNPAID','');
  perform public.gd_update_order((first_order->>'id')::uuid,(first_order->>'version')::integer,'SHIPPING','UNPAID','');
  if (select sum(reserved) from public.gd_stock_batches)<>0 or (select count(*) from public.gd_stock_movements where kind='CONSUME')<>1 then raise exception 'CONSUME_ONCE_FAILED'; end if;
  perform public.gd_inventory_command(waste_id,'WASTE',jsonb_build_object('batchId',batch_b,'quantity',1,'reason','QA damaged free stem'));
  perform public.gd_inventory_command(waste_id,'WASTE',jsonb_build_object('batchId',batch_b,'quantity',1,'reason','QA damaged free stem'));
  if exists(select 1 from public.gd_stock_batches b where on_hand<>(select sum(delta) from public.gd_stock_movements m where batch_id=b.id)) then raise exception 'MOVEMENTS_DO_NOT_RECONCILE'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.gd_stock_batches) then raise exception 'PRIVATE_STOCK_EXPOSED'; end if;
  begin perform public.gd_inventory_state(); raise exception 'NON_ADMIN_READ_STOCK';
  exception when raise_exception then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
end; $$;
reset role;
rollback;
select 'passed: hosted FEFO, shortage rollback, reservation release, consume once, receive/waste deduplication, stock ledger and private access; rolled back' as acceptance;
