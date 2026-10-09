-- Run once after setup.sql in the Supabase SQL Editor as project owner.
-- Re-running updates the same named job instead of creating another job.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'garden-dreams-expire-contacts',
  '0 20 * * *',
  'select public.gd_expire_contacts();'
);

-- Default Supabase Cron timezone is GMT: 20:00 UTC = 03:00 in Vietnam.
select jobname, schedule, command, active
from cron.job where jobname='garden-dreams-expire-contacts';
select current_setting('cron.timezone', true) as cron_timezone;
