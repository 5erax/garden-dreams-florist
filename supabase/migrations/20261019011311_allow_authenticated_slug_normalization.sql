begin;
-- Pure text normalization is called by the invoker product trigger; product writes still require admin RLS.
grant execute on function gd_private.slug_name(text) to authenticated;
commit;
