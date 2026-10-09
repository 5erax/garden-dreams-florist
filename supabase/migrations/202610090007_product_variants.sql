begin;
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
commit;
