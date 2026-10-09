begin;
create table gd_private.runtime (
  id integer primary key check(id=1),
  environment text not null check(environment in ('production','staging','local')),
  project_ref text check(project_ref ~ '^[a-z0-9]{20}$'),
  check((environment='local' and project_ref is null) or (environment<>'local' and project_ref is not null))
);
insert into gd_private.runtime values(1,'production','ztzpipgptticvliotbsc');
revoke all on gd_private.runtime from public,anon,authenticated;

create function gd_private.freeze_environment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' or (exists(select 1 from public.gd_orders) and (new.environment,new.project_ref) is distinct from (old.environment,old.project_ref)) then raise exception 'ENVIRONMENT_LOCKED'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.freeze_environment() from public,anon,authenticated;
create trigger freeze_environment before update or delete on gd_private.runtime for each row execute function gd_private.freeze_environment();

create function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref) from gd_private.runtime where id=1;
$$;
revoke execute on function public.gd_environment() from public;
grant execute on function public.gd_environment() to anon,authenticated;

alter table public.gd_orders add column is_test boolean not null default false;
alter table public.gd_memories add column is_test boolean not null default false;

create function gd_private.classify_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    select environment<>'production' into new.is_test from gd_private.runtime where id=1;
    if new.is_test is null then raise exception 'ENVIRONMENT_REQUIRED'; end if;
  elsif new.is_test is distinct from old.is_test then raise exception 'ORDER_KIND_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.classify_order() from public,anon,authenticated;
create trigger classify_order before insert or update on public.gd_orders for each row execute function gd_private.classify_order();

create function gd_private.classify_memory() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    -- Missing orders only occur in an isolated benchmark that deliberately removes its FK.
    new.is_test := coalesce((select is_test from public.gd_orders where id=new.order_id),true);
  elsif new.is_test is distinct from old.is_test then raise exception 'MEMORY_KIND_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke execute on function gd_private.classify_memory() from public,anon,authenticated;
create trigger classify_memory before insert or update on public.gd_memories for each row execute function gd_private.classify_memory();

create or replace function public.gd_public_memory(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('token',share_token,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at)
  from public.gd_memories where share_token=p_token and not revoked
    and (not is_test or (select environment from gd_private.runtime where id=1)<>'production');
$$;
create or replace function public.gd_garden(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 24) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('token',share_token,'id',id,'message',message,'signature',signature,'flowerName',flower_name,'flowerImage',flower_image,'createdAt',created_at) order by created_at desc,id desc),'[]'::jsonb)
  from (select * from public.gd_memories where listed and not revoked
    and (not is_test or (select environment from gd_private.runtime where id=1)<>'production')
    and (p_before is null or (created_at,id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by created_at desc,id desc limit greatest(1,least(coalesce(p_limit,24),48))) m;
$$;
create or replace function public.gd_memory_count() returns bigint language sql stable security definer set search_path='' as $$
  select count(*) from public.gd_memories where not revoked and not is_test;
$$;

-- Future finance dashboards must read this projection, excluding all test orders.
create view gd_private.real_orders as select * from public.gd_orders where not is_test;
revoke all on gd_private.real_orders from public,anon,authenticated;
commit;
