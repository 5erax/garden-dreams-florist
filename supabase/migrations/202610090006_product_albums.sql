begin;
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
commit;
