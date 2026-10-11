-- Run only after the production worker passes SMTP verification and its token is in Vault.
select cron.schedule('garden-dreams-order-email','* * * * *',$job$
 select net.http_post(
  url:='https://garden-dreams-florist.vercel.app/api/order-email',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='garden_dreams_notification_secret')),
  body:='{"mode":"dispatch"}'::jsonb,timeout_milliseconds:=120000)
 where exists(select 1 from gd_private.order_notifications where state='PENDING' or state='FAILED' and attempts<5 and next_attempt_at<=now());
$job$);
