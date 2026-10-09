begin;

create table public.gd_delivery_settings (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  version integer not null default 1
);
insert into public.gd_delivery_settings(id) values (1);

create table public.gd_delivery_rules (
  id uuid primary key default gen_random_uuid(),
  shipping_id uuid not null references public.gd_shipping(id),
  delivery_time text not null check (delivery_time in ('Sáng · 9–12h','Chiều · 13–17h','Tối · 18–20h')),
  weekdays integer[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
  capacity integer not null check (capacity between 0 and 500),
  lead_minutes integer not null check (lead_minutes between 0 and 43200),
  active boolean not null default false,
  version integer not null default 1,
  unique(shipping_id, delivery_time)
);
create table public.gd_delivery_closures (
  id uuid primary key default gen_random_uuid(),
  shipping_id uuid not null references public.gd_shipping(id),
  delivery_date date not null,
  reason text not null default '' check (length(reason) <= 200),
  active boolean not null default true,
  version integer not null default 1,
  unique(shipping_id, delivery_date)
);
alter table public.gd_orders add column delivery_rule_id uuid references public.gd_delivery_rules(id);
create index gd_delivery_usage on public.gd_orders(delivery_date,delivery_time,(shipping->>'id'))
  where status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED');

alter table public.gd_delivery_settings enable row level security;
alter table public.gd_delivery_rules enable row level security;
alter table public.gd_delivery_closures enable row level security;
revoke all on public.gd_delivery_settings, public.gd_delivery_rules, public.gd_delivery_closures from public,anon,authenticated;
grant select on public.gd_delivery_settings, public.gd_delivery_rules, public.gd_delivery_closures to authenticated;
create policy delivery_settings_admin on public.gd_delivery_settings for select to authenticated using(gd_private.is_admin());
create policy delivery_rules_admin on public.gd_delivery_rules for select to authenticated using(gd_private.is_admin());
create policy delivery_closures_admin on public.gd_delivery_closures for select to authenticated using(gd_private.is_admin());

create trigger delivery_settings_version before update on public.gd_delivery_settings for each row execute function gd_private.touch_version();
create trigger delivery_rules_version before update on public.gd_delivery_rules for each row execute function gd_private.touch_version();
create trigger delivery_closures_version before update on public.gd_delivery_closures for each row execute function gd_private.touch_version();
create trigger delivery_settings_audit after update on public.gd_delivery_settings for each row execute function gd_private.audit_config();
create trigger delivery_rules_audit after insert or update on public.gd_delivery_rules for each row execute function gd_private.audit_config();
create trigger delivery_closures_audit after insert or update on public.gd_delivery_closures for each row execute function gd_private.audit_config();

create function gd_private.delivery_used(p_shipping uuid,p_day date,p_time text) returns integer
language sql volatile security definer set search_path='' as $$
  select count(*)::integer from public.gd_orders
  where shipping->>'id'=p_shipping::text and delivery_date=p_day and delivery_time=p_time
    and status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED');
$$;
revoke execute on function gd_private.delivery_used(uuid,date,text) from public,anon,authenticated;

create function gd_private.delivery_option(p_shipping uuid,p_day date,p_time text,p_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  rule public.gd_delivery_rules;
  start_time time;
  cutoff timestamptz;
  used integer := 0;
  reason text := '';
begin
  select * into rule from public.gd_delivery_rules
    where shipping_id=p_shipping and delivery_time=p_time;
  if not found then
    return jsonb_build_object('time',p_time,'available',false,'reason','NO_SLOT','remaining',0);
  end if;
  used := gd_private.delivery_used(p_shipping,p_day,p_time);
  start_time := case p_time when 'Sáng · 9–12h' then time '09:00'
    when 'Chiều · 13–17h' then time '13:00' else time '18:00' end;
  cutoff := ((p_day + start_time) at time zone 'Asia/Ho_Chi_Minh') - make_interval(mins=>rule.lead_minutes);
  if not rule.active then reason := 'NO_SLOT';
  elsif exists(select 1 from public.gd_delivery_closures where shipping_id=p_shipping and delivery_date=p_day and active)
    or not (extract(isodow from p_day)::integer=any(rule.weekdays)) then reason := 'DAY_CLOSED';
  elsif p_at >= cutoff then reason := 'CUTOFF';
  elsif used >= rule.capacity then reason := 'FULL';
  end if;
  return jsonb_build_object('id',rule.id,'time',p_time,'available',reason='',
    'reason',reason,'remaining',greatest(0,rule.capacity-used),'cutoffAt',cutoff,'version',rule.version);
end;
$$;
revoke execute on function gd_private.delivery_option(uuid,date,text,timestamptz) from public,anon,authenticated;

create function public.gd_delivery_options(p_shipping uuid,p_day date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare enabled boolean; slots jsonb := '[]'; label text;
begin
  if p_day is null or p_day < (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
    or p_day > (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date+90 then raise exception 'INVALID_DATE'; end if;
  select s.enabled into enabled from public.gd_delivery_settings s where id=1;
  if not enabled then return jsonb_build_object('enabled',false,'slots','[]'::jsonb); end if;
  if not exists(select 1 from public.gd_shop where id=1 and accepting_orders)
    or not exists(select 1 from public.gd_shipping where id=p_shipping and active) then
    return jsonb_build_object('enabled',true,'slots','[]'::jsonb,'reason','CLOSED');
  end if;
  foreach label in array array['Sáng · 9–12h','Chiều · 13–17h','Tối · 18–20h'] loop
    slots := slots || jsonb_build_array(gd_private.delivery_option(p_shipping,p_day,label,statement_timestamp()));
  end loop;
  return jsonb_build_object('enabled',true,'slots',slots);
end;
$$;
revoke execute on function public.gd_delivery_options(uuid,date) from public;
grant execute on function public.gd_delivery_options(uuid,date) to anon,authenticated;

create function public.gd_save_delivery_rule(p_id uuid,p_version integer,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  current public.gd_delivery_rules;
  saved public.gd_delivery_rules;
  v_shipping uuid;
  label text;
  days integer[];
  v_capacity integer;
  v_lead integer;
  peak integer;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform 1 from public.gd_delivery_settings where id=1 for update;
  if jsonb_typeof(p_fields) is distinct from 'object'
    or jsonb_typeof(p_fields->'weekdays') is distinct from 'array'
    or jsonb_array_length(p_fields->'weekdays') not between 1 and 7
    or jsonb_typeof(p_fields->'active') is distinct from 'boolean'
    or jsonb_typeof(p_fields->'capacity') is distinct from 'number'
    or jsonb_typeof(p_fields->'leadMinutes') is distinct from 'number'
    or p_fields->>'capacity' !~ '^\d+$' or p_fields->>'leadMinutes' !~ '^\d+$'
    or exists(select 1 from jsonb_array_elements(p_fields->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[1-7]$')
    then raise exception 'INVALID_DELIVERY_RULE'; end if;
  v_shipping := (p_fields->>'shippingId')::uuid;
  label := p_fields->>'deliveryTime';
  select array_agg(distinct d::text::integer order by d::text::integer)
    into days from jsonb_array_elements(p_fields->'weekdays') d;
  v_capacity := (p_fields->>'capacity')::integer;
  v_lead := (p_fields->>'leadMinutes')::integer;
  if p_id is not null then
    select * into current from public.gd_delivery_rules where id=p_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if current.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
    if current.shipping_id is distinct from v_shipping or current.delivery_time is distinct from label
      then raise exception 'DELIVERY_RULE_IDENTITY_IMMUTABLE'; end if;
  end if;
  select coalesce(max(held),0) into peak from (
    select count(*)::integer held from public.gd_orders
    where shipping->>'id'=v_shipping::text and delivery_time=label
      and delivery_date >= (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
      and status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED') group by delivery_date
  ) usage;
  if v_capacity < peak then raise exception 'CAPACITY_BELOW_RESERVATIONS'; end if;
  if p_id is null then
    insert into public.gd_delivery_rules(shipping_id,delivery_time,weekdays,capacity,lead_minutes,active)
      values(v_shipping,label,days,v_capacity,v_lead,(p_fields->>'active')::boolean) returning * into saved;
  else
    update public.gd_delivery_rules set weekdays=days,capacity=v_capacity,lead_minutes=v_lead,active=(p_fields->>'active')::boolean
      where id=p_id returning * into saved;
  end if;
  return to_jsonb(saved);
end;
$$;
revoke execute on function public.gd_save_delivery_rule(uuid,integer,jsonb) from public,anon;
grant execute on function public.gd_save_delivery_rule(uuid,integer,jsonb) to authenticated;

create function public.gd_set_delivery_calendar(p_version integer,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current public.gd_delivery_settings;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform 1 from public.gd_delivery_settings where id=1 for update;
  select * into current from public.gd_delivery_settings where id=1 for update;
  if current.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_enabled is null then raise exception 'INVALID_DELIVERY_RULE'; end if;
  if p_enabled and not exists(select 1 from public.gd_delivery_rules r join public.gd_shipping s on s.id=r.shipping_id
    where r.active and r.capacity>0 and s.active) then raise exception 'DELIVERY_RULE_REQUIRED'; end if;
  update public.gd_delivery_settings set enabled=p_enabled where id=1 returning * into current;
  return to_jsonb(current);
end;
$$;
revoke execute on function public.gd_set_delivery_calendar(integer,boolean) from public,anon;
grant execute on function public.gd_set_delivery_calendar(integer,boolean) to authenticated;

create function public.gd_save_delivery_closure(p_id uuid,p_version integer,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  current public.gd_delivery_closures;
  saved public.gd_delivery_closures;
  v_shipping uuid;
  day date;
begin
  if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform 1 from public.gd_delivery_settings where id=1 for update;
  if jsonb_typeof(p_fields) is distinct from 'object'
    or jsonb_typeof(p_fields->'active') is distinct from 'boolean'
    or p_fields->>'date' is null or p_fields->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(p_fields->'reason') is distinct from 'string' then raise exception 'INVALID_DELIVERY_RULE'; end if;
  v_shipping := (p_fields->>'shippingId')::uuid;
  day := (p_fields->>'date')::date;
  if day < (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
    or day > (statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date+365 then raise exception 'INVALID_DATE'; end if;
  if p_id is not null then
    select * into current from public.gd_delivery_closures where id=p_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if current.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
    if current.shipping_id is distinct from v_shipping or current.delivery_date is distinct from day
      then raise exception 'DELIVERY_RULE_IDENTITY_IMMUTABLE'; end if;
  end if;
  if (p_fields->>'active')::boolean and exists(select 1 from public.gd_orders where shipping->>'id'=v_shipping::text
    and delivery_date=day and status in ('CONFIRMED','PREPARING','SHIPPING','DELIVERED'))
    then raise exception 'DAY_HAS_RESERVATIONS'; end if;
  if p_id is null then
    insert into public.gd_delivery_closures(shipping_id,delivery_date,reason,active)
      values(v_shipping,day,trim(p_fields->>'reason'),(p_fields->>'active')::boolean) returning * into saved;
  else
    update public.gd_delivery_closures set reason=trim(p_fields->>'reason'),active=(p_fields->>'active')::boolean
      where id=p_id returning * into saved;
  end if;
  return to_jsonb(saved);
end;
$$;
revoke execute on function public.gd_save_delivery_closure(uuid,integer,jsonb) from public,anon;
grant execute on function public.gd_save_delivery_closure(uuid,integer,jsonb) to authenticated;

create function gd_private.guard_delivery_calendar() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  managed boolean;
  option jsonb;
  rule public.gd_delivery_rules;
  v_shipping uuid;
begin
  v_shipping := (new.shipping->>'id')::uuid;
  select enabled into managed from public.gd_delivery_settings where id=1 for share;
  if tg_op='UPDATE' then
    if new.delivery_rule_id is distinct from old.delivery_rule_id
      or new.shipping->'calendar' is distinct from old.shipping->'calendar'
      or new.delivery_date is distinct from old.delivery_date
      or new.delivery_time is distinct from old.delivery_time then raise exception 'CALENDAR_SNAPSHOT_IMMUTABLE'; end if;
    if new.status=old.status or not managed then return new; end if;
    if new.status='CANCELLED' then
      perform pg_advisory_xact_lock(hashtextextended('delivery:'||v_shipping::text||':'||new.delivery_date::text||':'||new.delivery_time,0));
      return new;
    end if;
    if new.status<>'CONFIRMED' then return new; end if;
  elsif not managed then
    return new;
  end if;
  select * into rule from public.gd_delivery_rules where shipping_id=v_shipping and delivery_time=new.delivery_time for share;
  if not found then raise exception 'DELIVERY_UNAVAILABLE'; end if;
  -- The order state itself owns a seat; this also counts legacy confirmed orders.
  perform pg_advisory_xact_lock(hashtextextended('delivery:'||v_shipping::text||':'||new.delivery_date::text||':'||new.delivery_time,0));
  option := gd_private.delivery_option(v_shipping,new.delivery_date,new.delivery_time,statement_timestamp());
  if not (option->>'available')::boolean then raise exception 'DELIVERY_UNAVAILABLE:%',option->>'reason'; end if;
  if tg_op='INSERT' then
    new.delivery_rule_id := rule.id;
    new.shipping := new.shipping || jsonb_build_object('calendar',jsonb_build_object(
      'ruleId',rule.id,'ruleVersion',rule.version,'capacity',rule.capacity,'leadMinutes',rule.lead_minutes,
      'weekdays',rule.weekdays,'cutoffAt',option->'cutoffAt'));
  end if;
  return new;
end;
$$;
revoke execute on function gd_private.guard_delivery_calendar() from public,anon,authenticated;
create trigger guard_delivery_calendar before insert or update on public.gd_orders
  for each row execute function gd_private.guard_delivery_calendar();

create or replace function public.gd_environment() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('environment',environment,'projectRef',project_ref,
    'features',jsonb_build_object('productAlbum',true,'productImageUpload',gd_private.product_uploads_ready(),
      'productVariants',true,'variantOrders',true,'deliveryCalendar',true))
  from gd_private.runtime where id=1;
$$;
commit;
