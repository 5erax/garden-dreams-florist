-- Apply after deploying the five clearly labelled placeholder assets.
-- Replace only unchanged duplicate demo covers; preserve owner-uploaded albums and historical orders.
begin;
update public.gd_products set image='/flowers/bouquet_'||id||'-pending.svg'
  where id between 16 and 20 and image='/flowers/bouquet_'||id||'.webp' and cardinality(images)=0;
commit;
