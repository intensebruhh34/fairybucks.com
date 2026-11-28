-- TEMPLATE ONLY: public release activation. Never paste/execute this file as-is.
-- This intentionally FAILS until an operator removes the fail-closed guard after
-- ALL documented provider/COPPA decisions, v5 migration, hosting and browser tests.
-- Keeping public access off is the default even when this PR is merged.
begin;
do $$
declare r private.fairybucks_privacy_release%rowtype;
begin
  -- HARD STOP: removal is a separate, explicit authorized launch operation.
  raise exception 'NOT AUTHORIZED: activation template only. Do not run without final launch signoff';
  select * into r from private.fairybucks_privacy_release where singleton for update;
  if not found then raise exception 'Release row missing'; end if;
  if r.notice_version <> 5
     or r.notice_hash <> 'ff307e16eedf69d35d15ccdf66d9947d92f94067a0e592fd769e53e7c1fb0732'
     then raise exception 'Unexpected notice version or hash: cutover v5 first'; end if;
  if r.enforcement_enabled or r.notice_ready or r.email_method_reviewed then
    raise exception 'Release state already modified: investigate before changing'; end if;
  -- This decision MUST be established independently and recorded privately.
  -- Only a determination that the actual approved parental-consent method is
  -- legally appropriate for the actual service/providers permits activation.
  update private.fairybucks_privacy_release
     set notice_ready=true,
         email_method_reviewed=true,
         enforcement_enabled=true
   where singleton;
  if not found then raise exception 'No release row updated'; end if;
end $$;
-- Deliberately ROLLBACK in checked-in template; a second explicit operator
-- decision would be required to replace ROLLBACK with COMMIT.
rollback;
