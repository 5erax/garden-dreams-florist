-- Read-only operational checks, run as database owner after retention.sql.
-- Do not expose this output through a public RPC or include contact details.
select jobid, jobname, schedule, active,
       command = 'select public.gd_expire_contacts();' as expected_command
from cron.job
where jobname = 'garden-dreams-expire-contacts';

select r.runid, r.status, r.start_time, r.end_time,
       r.end_time - r.start_time as duration
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'garden-dreams-expire-contacts'
order by r.start_time desc
limit 10;

select count(*) as overdue_contacts
from public.gd_orders
where status in ('DELIVERED','CANCELLED')
  and updated_at < now() - interval '90 days'
  and contacts_erased_at is null;

select count(*) as erased_rows_still_containing_contacts
from public.gd_orders
where contacts_erased_at is not null
  and (recipient_name is not null or recipient_phone is not null or address is not null);

select current_setting('cron.timezone', true) as cron_timezone;
