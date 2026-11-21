-- Align the versioned direct notice with email-link approval; do not enable public launch.
-- Because the notice fingerprint changes, existing v3 consents must be renewed.
begin;
do $$begin
 if exists(select 1 from private.fairybucks_privacy_release where enforcement_enabled) then
  raise exception 'Coordinate notice upgrade before public enforcement';
 end if;
end $$;
update private.fairybucks_privacy_release
 set notice_version=4,
 notice_hash='121eaeaebaeceecf2aef80f83665b4b3b897beb4b8c85ae462dd15e91658bd2e',
 notice_ready=false,email_method_reviewed=false
 where singleton;
commit;
