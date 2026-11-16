-- OPERATOR ONLY. Do not run until the public notice/contact details, provider review,
-- retention/security procedures and signed-form verification workflow are ready.
-- Run `node tools/notice-hash.mjs` against the exact reviewed code first.
begin;
do $$
declare
 reviewed_version integer := 1;
 reviewed_hash text := ''; -- paste the helper's 64-character hash after contacts/review are complete
 operator_checks_complete boolean := false; -- change only after completing the operator checklist
begin
 if not operator_checks_complete or reviewed_hash !~ '^[0-9a-f]{64}$' then
  raise exception 'Complete the operator checklist and fill the reviewed notice hash first';end if;
 update private.fairybucks_privacy_release set notice_version=reviewed_version,notice_hash=reviewed_hash,notice_ready=true,enforcement_enabled=true where singleton;
 -- A notice activation/change always requires a fresh PIN-controlled child handoff.
 delete from private.fairybucks_child_sessions;
end $$;
commit;
