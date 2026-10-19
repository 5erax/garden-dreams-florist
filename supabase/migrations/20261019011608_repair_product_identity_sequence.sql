begin;
set local lock_timeout='10s';
lock table public.gd_products in share row exclusive mode;
select setval(pg_get_serial_sequence('public.gd_products','id'),
  greatest(coalesce(max(id),1),coalesce(pg_sequence_last_value(pg_get_serial_sequence('public.gd_products','id')::regclass),1)),true)
from public.gd_products;
commit;
