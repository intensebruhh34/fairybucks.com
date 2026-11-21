-- Rollback-only checks: no real HTTP request is enqueued by this hosted-safe check.
begin;
do $$declare value text;begin
 select decrypted_secret into value from vault.decrypted_secrets where id=(
  select secret_id from private.fairybucks_confirmation_worker where singleton);
 if value is null or not public.fairybucks_check_confirmation_worker(value) then raise exception 'Worker credential mismatch';end if;
 if public.fairybucks_check_confirmation_worker(repeat('0',64)) or public.fairybucks_check_confirmation_worker(null) then raise exception 'Wrong worker key accepted';end if;
 if has_function_privilege('anon','public.fairybucks_check_confirmation_worker(text)','execute')
  or has_function_privilege('authenticated','public.fairybucks_check_confirmation_worker(text)','execute')
  or not has_function_privilege('service_role','public.fairybucks_check_confirmation_worker(text)','execute') then raise exception 'Worker authentication grants incorrect';end if;
 if has_function_privilege('service_role','private.fairybucks_confirmation_tick()','execute')
  or has_function_privilege('authenticated','private.fairybucks_confirmation_tick()','execute')
  or has_table_privilege('authenticated','private.fairybucks_confirmation_worker','select') then raise exception 'Scheduler state exposed';end if;
end $$;
select 'PASS Vault worker credential, wrong/null key rejection, service-only validation and private scheduler grants' as result;
rollback;
