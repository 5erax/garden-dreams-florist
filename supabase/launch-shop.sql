-- Garden Dreams production ONLY: ztzpipgptticvliotbsc.
-- Owner-approved shop/payment/delivery configuration, 09/10/2026.
-- Does not open sales: retain accepting_orders until customer email/checkout is verified.
-- MB BIN source: https://api.vietqr.io/v2/banks (code MB, bin 970422).
begin;
do $$
declare runtime jsonb;
begin
  if to_regprocedure('public.gd_environment()') is not null then
    execute 'select public.gd_environment()' into runtime;
    if runtime->>'projectRef' is distinct from 'ztzpipgptticvliotbsc'
       or runtime->>'environment' is distinct from 'production' then
      raise exception 'WRONG_ENVIRONMENT';
    end if;
  end if;
  -- Legacy production has no environment RPC; require its confirmed owner/admin.
  if not exists (select 1 from public.gd_admins a join auth.users u on u.id=a.user_id
    where lower(u.email)='dha260803@gmail.com' and u.email_confirmed_at is not null)
    or not exists (select 1 from public.gd_shop where id=1 and name='Garden Dreams' and phone='0832345780') then
    raise exception 'SHOP_OWNER_NOT_CONFIRMED';
  end if;
end;
$$;

alter table public.gd_shop add column if not exists address text not null default ''
  check (char_length(address)<=300);
update public.gd_shop set
  address='665L, xã Long Phước, huyện Long Thành, tỉnh Đồng Nai',
  cod_enabled=true, transfer_enabled=true,
  bank_name='MB Bank', bank_bin='970422', bank_account='0832345780', account_name='Hà Văn Phước'
where id=1;

insert into public.gd_shipping(id,name,area,fee,active) values
  ('749904cb-2e29-46ee-b154-ac2e8892b100','Giao trong Long Thành','Địa chỉ trong khu vực Long Thành, Đồng Nai.',0,true),
  ('749904cb-2e29-46ee-b154-ac2e8892b101','Giao ngoài Long Thành','Ngoài Long Thành. Shop kiểm tra địa chỉ và xác nhận mức phí 30.000đ trước khi nhận giao.',30000,true),
  ('749904cb-2e29-46ee-b154-ac2e8892b102','Giao khu vực xa','Khu vực xa hơn. Shop kiểm tra địa chỉ và xác nhận phạm vi, mức phí 50.000đ trước khi nhận giao.',50000,true)
on conflict(id) do update set name=excluded.name,area=excluded.area,fee=excluded.fee,active=excluded.active;

-- Preserve catalog prices, existing orders, payment evidence and memory privacy.
commit;
select name,address,cod_enabled,transfer_enabled,accepting_orders from public.gd_shop where id=1;
