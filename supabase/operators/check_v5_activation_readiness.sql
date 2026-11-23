-- READ ONLY: inspect release flags and the exact v5 notice hash.
-- Safe before signoff; a READY report here is not a COPPA determination.
select
  case
    when notice_version=5
      and notice_hash='ff307e16eedf69d35d15ccdf66d9947d92f94067a0e592fd769e53e7c1fb0732'
      and notice_ready=false
      and email_method_reviewed=false
      and enforcement_enabled=false then 'V5_STAGED_FAIL_CLOSED'
    when enforcement_enabled=true then 'STOP_PUBLIC_ENFORCEMENT_ACTIVE'
    else 'STOP_UNEXPECTED_RELEASE_STATE'
  end as staging_status,
  notice_version,
  notice_ready,
  email_method_reviewed,
  enforcement_enabled
from private.fairybucks_privacy_release
where singleton;
