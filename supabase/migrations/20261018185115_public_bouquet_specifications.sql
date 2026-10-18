begin;
alter table public.gd_products add column specification text not null default '' check(char_length(specification)<=1200);
alter table public.gd_product_variants add column specification text not null default '' check(char_length(specification)<=1200);
create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),
      'productVariants',true,'variantOrders',true,'deliveryCalendar',true,'operationsDesk',true,'orderRequests',true,'reconciliationLedger',true,'inventory',true,'productPages',true,'bouquetSpecifications',true)) from gd_private.runtime where id=1;
$$;
notify pgrst,'reload schema';
commit;
