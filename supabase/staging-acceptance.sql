-- Staging-only purchase/payment/privacy rehearsal. All synthetic rows roll back.
begin;
set local lock_timeout = '10s';
do $$
declare actor uuid;
begin
  if public.gd_environment()->>'projectRef' <> 'tgvozhrkolcpszyyrgth'
    or public.gd_environment()->>'environment' <> 'staging' then
    raise exception 'ACCEPTANCE_REQUIRES_STAGING'; end if;
  select u.id into actor from auth.users u where u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous,false)
    and not exists(select 1 from public.gd_admins a where a.user_id=u.id)
    and not exists(select 1 from public.gd_orders o where o.owner_id=u.id)
    limit 1;
  if actor is null then raise exception 'ACCEPTANCE_REQUIRES_UNUSED_CONFIRMED_CUSTOMER'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
  update public.gd_shop set accepting_orders=true,cod_enabled=true,transfer_enabled=true,
    bank_bin='970422',bank_account='0832345780',bank_name='MB Bank',account_name='Hà Văn Phước' where id=1;
  update public.gd_delivery_settings set enabled=false where id=1;
  insert into public.gd_shipping(name,area,fee,active) values
    ('QA giao miễn phí','Địa chỉ giả trong Long Thành',0,true),
    ('QA ngoài khu vực','Địa chỉ giả ngoài khu vực',30000,true),
    ('QA giao xa','Địa chỉ giả giao xa',50000,true);
end;
$$;
set local role authenticated;
do $$
declare product record; delivery record; request jsonb; saved jsonb; bank_order jsonb;
  replay jsonb; receipt_id uuid:=gen_random_uuid();
begin
  select id,price into product from public.gd_products where active order by id limit 1;
  if product.id is null then raise exception 'ACCEPTANCE_REQUIRES_PRODUCT'; end if;
  for delivery in select id,fee from public.gd_shipping where name like 'QA %' order by fee loop
    request := jsonb_build_object('requestId',gen_random_uuid(),'name','Khách kiểm thử','phone','0900000000',
      'address','Địa chỉ giả trong giao dịch kiểm thử','message','Thông điệp kiểm thử riêng tư','consent',true,
      'deliveryDate',((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::text,'deliveryTime','Chiều · 13–17h',
      'items',jsonb_build_array(jsonb_build_object('id',product.id,'quantity',1)),
      'shippingId',delivery.id,'paymentMethod','COD','expectedTotal',product.price+delivery.fee);
    saved := public.gd_create_order(request);
    replay := public.gd_create_order(request);
    if saved->>'id' <> replay->>'id' or (saved->>'total')::bigint <> product.price+delivery.fee
      or saved->>'payment_status' <> 'UNPAID' or not (saved->>'is_test')::boolean then
      raise exception 'COD_OR_RETRY_ACCEPTANCE_FAILED'; end if;
  end loop;
  request := jsonb_set(request,array['requestId'],to_jsonb(gen_random_uuid()));
  request := jsonb_set(request,array['paymentMethod'],'"VIETQR"');
  bank_order := public.gd_create_order(request);
  if bank_order->'bank'->>'account' <> '0832345780' or bank_order->'bank'->>'bin' <> '970422'
    or bank_order->>'payment_status' <> 'UNPAID' then raise exception 'VIETQR_ACCEPTANCE_FAILED'; end if;
  begin
    perform public.gd_reconcile_payment(receipt_id,(bank_order->>'id')::uuid,(bank_order->>'version')::integer,'RECEIPT','QA-REFERENCE','Synthetic rehearsal only');
    raise exception 'CUSTOMER_PAYMENT_AUTHORIZATION_FAILED';
  exception when others then
    if sqlerrm not like '%ADMIN_REQUIRED%' then raise; end if;
  end;
  perform set_config('gd.acceptance_order',bank_order->>'id',true);
end;
$$;
reset role;
insert into public.gd_admins(user_id) values (auth.uid());
set local role authenticated;
do $$
declare saved jsonb; state text; target_order uuid:=current_setting('gd.acceptance_order')::uuid;
  request_id uuid:=gen_random_uuid(); replay jsonb; memory_id uuid;
begin
  select to_jsonb(o) into saved from public.gd_orders o where id=target_order;
  saved := public.gd_reconcile_payment(request_id,target_order,(saved->>'version')::integer,'RECEIPT','QA-REFERENCE','Synthetic rehearsal only')->'order';
  replay := public.gd_reconcile_payment(request_id,target_order,(saved->>'version')::integer-1,'RECEIPT','QA-REFERENCE','Synthetic rehearsal only')->'order';
  if saved->>'version' <> replay->>'version' or saved->>'payment_status' <> 'PAID' then
    raise exception 'PAYMENT_RETRY_ACCEPTANCE_FAILED'; end if;
  foreach state in array array['CONFIRMED','PREPARING','SHIPPING','DELIVERED'] loop
    saved := public.gd_update_order(target_order,(saved->>'version')::integer,state,'PAID','Synthetic fulfillment rehearsal');
  end loop;
  select id into memory_id from public.gd_memories where order_id=target_order and owner_id=auth.uid();
  if memory_id is null then raise exception 'MEMORY_CREATION_FAILED'; end if;
  if exists(select 1 from jsonb_array_elements(public.gd_garden()) m where m->>'id'=memory_id::text) then raise exception 'TEST_MEMORY_PUBLIC_TOO_EARLY'; end if;
  perform public.gd_share_memory(memory_id,'GARDEN','');
  if not exists(select 1 from jsonb_array_elements(public.gd_garden()) m where m->>'message'='Thông điệp kiểm thử riêng tư') then
    raise exception 'OPT_IN_MEMORY_ACCEPTANCE_FAILED'; end if;
  perform public.gd_share_memory(memory_id,'PRIVATE','');
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated')::text,true);
  if exists(select 1 from public.gd_orders where id=target_order) then raise exception 'ORDER_PRIVACY_FAILED'; end if;
end;
$$;
reset role;
rollback;
select 'passed: COD fees, VietQR unpaid, retries, admin-only payment, fulfillment, optional memories, owner RLS; rolled back' as acceptance;
