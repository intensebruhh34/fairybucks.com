-- RETIRED version-1 paper-consent activation entry point.
-- It cannot safely coordinate the current version-2 email release.
-- See docs/reviews/pilot-launch-2026-11-20.md and tools/EMAIL_PARENT_PERMISSION.md.
-- Intentionally changes no release settings and revokes no sessions.
do $$
begin
 raise exception 'Retired activation script: use a separately reviewed email-permission cutover after completing the launch checklist';
end $$;
