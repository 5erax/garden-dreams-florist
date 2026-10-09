-- Only on the new staging project tgvozhrkolcpszyyrgth, after migrations 001–005.
begin;
do $$
begin
  if exists(select 1 from gd_private.runtime where environment='staging' and project_ref='tgvozhrkolcpszyyrgth') then return; end if;
  if exists(select 1 from public.gd_orders) or exists(select 1 from public.gd_admins) or exists(select 1 from auth.users) then raise exception 'STAGING_REQUIRES_EMPTY_PROJECT'; end if;
  update gd_private.runtime set environment='staging',project_ref='tgvozhrkolcpszyyrgth' where id=1;
  update public.gd_shop set accepting_orders=false;
end;
$$;
select public.gd_environment() as runtime;
commit;
