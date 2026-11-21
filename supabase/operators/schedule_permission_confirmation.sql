-- Run AFTER installing the five-minute migration and deploying its updated worker.
-- No public permission or email-sending flags are enabled by this schedule.
begin;
create extension if not exists pg_net;
select cron.schedule('fairybucks-permission-confirmation','* * * * *',
 'select private.fairybucks_confirmation_tick();');
commit;
