begin;
set local lock_timeout='10s';
create table gd_private.order_notifications(
 order_id uuid primary key references public.gd_orders(id),
 state text not null default 'PENDING' check(state in ('PENDING','SENDING','SENT','FAILED','UNKNOWN')),
 attempts integer not null default 0,lease uuid,leased_at timestamptz,
 next_attempt_at timestamptz not null default now(),sent_at timestamptz,error_code text not null default '',created_at timestamptz not null default now()
);
revoke all on gd_private.order_notifications from public,anon,authenticated;
create function gd_private.enqueue_order_notification() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not new.is_test then insert into gd_private.order_notifications(order_id) values(new.id) on conflict do nothing;end if;return new;end;$$;
revoke execute on function gd_private.enqueue_order_notification() from public,anon,authenticated;
create trigger order_notification after insert on public.gd_orders for each row execute function gd_private.enqueue_order_notification();
create function public.gd_claim_order_notifications() returns jsonb language plpgsql security definer set search_path='' as $$declare answer jsonb;begin
 update gd_private.order_notifications set state='UNKNOWN',error_code='LEASE_EXPIRED' where state='SENDING' and leased_at<now()-interval '2 minutes';
 with jobs as(select n.order_id from gd_private.order_notifications n where (n.state='PENDING' or (n.state='FAILED' and n.attempts<5)) and next_attempt_at<=now() order by created_at limit 5 for update skip locked),
 leased as(update gd_private.order_notifications n set state='SENDING',attempts=attempts+1,lease=gen_random_uuid(),leased_at=now() from jobs where n.order_id=jobs.order_id returning n.order_id,n.lease)
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'reference',o.reference,'total',o.total,'delivery_date',o.delivery_date,'delivery_time',o.delivery_time,'lease',l.lease)),'[]'::jsonb) into answer from leased l join public.gd_orders o on o.id=l.order_id;return answer;end;$$;
create function public.gd_finish_order_notification(p_order uuid,p_lease uuid,p_state text,p_error text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_state not in ('SENT','FAILED','UNKNOWN') or p_state is null or length(coalesce(p_error,''))>60 then raise exception 'INVALID_NOTIFICATION';end if;
 update gd_private.order_notifications set state=p_state,error_code=coalesce(p_error,''),sent_at=case when p_state='SENT' then now() else null end,next_attempt_at=now()+interval '1 minute'*least(60,power(2,attempts)::int) where order_id=p_order and lease=p_lease and state='SENDING';
 if not found then raise exception 'NOTIFICATION_LEASE_CONFLICT';end if;end;$$;
revoke execute on function public.gd_claim_order_notifications(),public.gd_finish_order_notification(uuid,uuid,text,text) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.gd_claim_order_notifications(),public.gd_finish_order_notification(uuid,uuid,text,text) to service_role;end if;end;$$;
create function public.gd_order_notification_status() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gd_private.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 return(select jsonb_build_object('pending',count(*) filter(where state in ('PENDING','SENDING') or state='FAILED' and attempts<5),'attention',count(*) filter(where state='UNKNOWN' or state='FAILED' and attempts>=5),'lastSentAt',max(sent_at)) from gd_private.order_notifications);end;$$;
revoke execute on function public.gd_order_notification_status() from public,anon;grant execute on function public.gd_order_notification_status() to authenticated;
notify pgrst,'reload schema';commit;
