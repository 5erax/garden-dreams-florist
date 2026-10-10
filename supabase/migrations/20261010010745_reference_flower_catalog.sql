begin;
do $$ begin
  if not exists(select 1 from gd_private.runtime where project_ref in ('ztzpipgptticvliotbsc','tgvozhrkolcpszyyrgth'))
    or to_regclass('public.gd_inventory_settings') is null then raise exception 'REFERENCE_CATALOG_REQUIRES_SCHEMA_013'; end if;
end $$;
alter table public.gd_products add column reference_only boolean not null default false;
alter table public.gd_products add constraint reference_not_for_sale check(not(active and reference_only));
alter policy product_read on public.gd_products using(active or reference_only or gd_private.is_admin());
create function gd_private.approve_reference_product() returns trigger language plpgsql set search_path='' as $$
begin
  if new.active then new.reference_only:=false; end if;
  return new;
end; $$;
revoke execute on function gd_private.approve_reference_product() from public,anon,authenticated;
create trigger approve_reference_product before insert or update of active,reference_only on public.gd_products
  for each row execute function gd_private.approve_reference_product();
notify pgrst,'reload schema';
commit;
