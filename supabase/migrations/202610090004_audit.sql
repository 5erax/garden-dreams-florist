begin;
-- Supabase may apply default table privileges; make the intended grants explicit.
revoke all on public.gd_admins,public.gd_orders,public.gd_order_events,public.gd_memories from anon,authenticated;
grant select on public.gd_admins,public.gd_orders,public.gd_order_events,public.gd_memories to authenticated;
revoke all on public.gd_shop,public.gd_products,public.gd_shipping from anon,authenticated;
grant select on public.gd_shop,public.gd_products,public.gd_shipping to anon,authenticated;
grant update on public.gd_shop to authenticated;
grant insert,update on public.gd_products,public.gd_shipping to authenticated;

create table public.gd_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  entity text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.gd_admin_audit enable row level security;
revoke all on public.gd_admin_audit from anon,authenticated;
grant select on public.gd_admin_audit to authenticated;
create policy audit_admin on public.gd_admin_audit for select to authenticated using(gd_private.is_admin());
create function gd_private.audit_config() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.gd_admin_audit(actor_id,entity,entity_id,action,before_data,after_data)
    values(auth.uid(),tg_table_name,new.id::text,tg_op,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
  return new;
end;
$$;
revoke execute on function gd_private.audit_config() from public,anon,authenticated;
create trigger shop_audit after update on public.gd_shop for each row execute function gd_private.audit_config();
create trigger product_audit after insert or update on public.gd_products for each row execute function gd_private.audit_config();
create trigger shipping_audit after insert or update on public.gd_shipping for each row execute function gd_private.audit_config();
commit;
