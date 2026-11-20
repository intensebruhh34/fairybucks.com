-- Run AFTER the reviewed retention_cleanup migration. No family/account deletion.
-- Re-running replaces this named schedule; does not add duplicate jobs.
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('fairybucks-retention-cleanup','17 3 * * *',
 'select private.fairybucks_retention_cleanup();');
commit;
-- Check installation (not proof of a successful job execution):
select jobname,schedule,active from cron.job where jobname='fairybucks-retention-cleanup';
