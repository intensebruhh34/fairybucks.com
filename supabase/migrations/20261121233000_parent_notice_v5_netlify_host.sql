-- STAGED FOR COORDINATED HOSTING CUTOVER. Do not apply before owner-approved deployment.
-- Browser notice, all three email Edge Function snapshots, database fingerprint, and
-- Netlify hosting disclosure must change together. Existing v4 parents must re-consent.
-- This migration NEVER activates child enrollment or public launch.
begin;
do $$begin
 if exists(select 1 from private.fairybucks_privacy_release where enforcement_enabled) then
  raise exception 'Do not upgrade a publicly enforced consent version without an approved coordinated release';
 end if;
end $$;
update private.fairybucks_privacy_release
 set notice_version=5,
 notice_hash='ff307e16eedf69d35d15ccdf66d9947d92f94067a0e592fd769e53e7c1fb0732',
 notice_ready=false,
 email_method_reviewed=false
 where singleton;
commit;
