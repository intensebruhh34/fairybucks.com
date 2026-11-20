# Step 10 — retention and cleanup (prepared November 20, 2026)

Step 9's manual email rehearsal is parked at the owner's request. Step 8 stays.
This change is operational cleanup, not a launch approval or legal sign-off.

## Retention implemented by this change

| Records | Rule and purpose |
| --- | --- |
| Uncompleted permission requests + dependent mail jobs | Delete on a successful daily run after link expiry + 30 days. Grace window supports delivery troubleshooting. |
| Withdrawn email requests + dependent mail jobs | Delete after recorded withdrawal + 30 days. Keep the separate decision record so withdrawal remains effective. |
| Child tokens / parent unlocks | Delete expired rows on next successful run. Existing access checks reject expiry immediately. |
| Email rate limits | Delete after 30 days without an attempt/window change; never reset a live counter. |
| Cleanup monitoring | One latest-success row with aggregate counts; no family identifiers or email content. |
| Verified email requests / permission decisions / history | Retained for access enforcement pending the broader purpose-end policy; verified transport rows are currently required by child-access checks. |
| PIN recovery proofs / rehearsal rows | Preserved: deleting these blindly could change replay protection or cause expired testers to fall back to development access. |
| Family vault and parent login | Unchanged; owner can delete the whole account. No automatic inactive-family deletion in this change. |

No expiry exception or legal hold is implemented for temporary transport records;
any need for one requires a separately reviewed, scoped design before deployment.

## Installation after PR review

1. Run `supabase/migrations/20261120124552_retention_cleanup.sql` in the SQL editor.
2. Run `supabase/checks/retention_cleanup.sql`. It rolls back all fixture and cleanup changes, including any real expired rows touched during that test.
3. Run `supabase/operators/schedule_retention_cleanup.sql` as postgres. Enables pg_cron and installs/replaces the named daily 03:17 UTC job.
4. Inspect `cron.job_run_details` for that job after its first scheduled run and `private.fairybucks_cleanup_status` for a fresh successful completion. Installation alone is not proof it ran.
5. If failures occur, investigate before claiming cleanup is active. Disable only this job with `select cron.unschedule('fairybucks-retention-cleanup');` if necessary; do not disable the shared extension.

The scheduler cannot run in the PGlite test environment. Tests exercise the actual
cleanup function and transaction rollback; hosted scheduler installation/execution
must be verified separately. Nothing in this PR applies itself to production.

## Provider evidence checked November 20, 2026

- [Supabase backups](https://supabase.com/docs/guides/platform/backups): automatic daily backups on paid plans; Free does not provide that feature. This does not prove absence of infrastructure copies.
- [Supabase logs](https://supabase.com/docs/guides/observability/logs): advertised accessible retention depends on plan (Free one day); query availability is not a universal deletion guarantee.
- [Supabase residency/retention](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq): request exact use-case retention from provider where needed; do not invent a purge deadline.
- [Resend GDPR](https://resend.com/security/gdpr): standard Free/Pro/Scale email/log retention 30 days, backups seven days; no individual-email delete API; early sent-email removal requires contacting Resend with message IDs. This is published policy, not verified project configuration.
- [Cron installation](https://supabase.com/docs/guides/cron/install) and [Cron](https://supabase.com/docs/guides/cron): SQL scheduling/monitoring.

## Still needed to close step 10

- Confirm actual Supabase/Resend plans, backup/PITR settings, log drains and any operator-created copies. Do not paste keys or message contents into tickets.
- Confirm the support forwarding provider, Gmail handling, mailbox retention and email tracking settings. Support sending as support@fairybucks.com also remains an open launch task.
- Finalize inactivity/pilot-end removal and permission-history purpose-end rules; implement/verify them. Proposed 90-day pilot/support periods are not installed automation.
- Establish support-mail deletion handling including forwarded, sent and trash copies; document provider-specific limitations.
- Install the reviewed migration/scheduler, observe successful execution, and then update the draft notice's deployment wording.

Public permission flags remain false. Privacy notice stays a draft. Do not mark
step 10 complete merely because this PR or the rollback tests pass.

## Deployment and provider update — November 20, 2026

- PR #49 merged. Owner reports install, rollback verification and scheduler scripts all passed.
- Database inspection confirms active `fairybucks-retention-cleanup` schedule (`17 3 * * *`). At the latest inspection there were no runs and no last-success row. First scheduled success is still pending; do not rerun installation.
- Supabase organization API confirms Free; owner confirms Resend Free.
- Owner confirms Squarespace configured support@fairybucks.com forwarding to Gmail. This identifies the route, not an independently verified retention guarantee for every forwarding subprocessor.
- No family export was requested or delivered during the parked step 9 rehearsal. Owner's statement about local downloads was interpreted as no known exports, not a device audit; confirm if any copies are discovered.

### Support mailbox procedure to adopt before invitations

Use the dedicated support inbox for family support. Avoid unnecessary attachments,
full child names and copies in personal inboxes, downloads or public issues.
Record the case closure date in a restricted support log (case reference and dates,
not message contents). Review open and closed cases at least monthly. Flag cases
approaching 90 days after closure and permanently delete the support thread and
related sent/forwarded copies by that deadline. The monthly review alone is not a
90-day guarantee: set a due date when closing each case and act before it expires.
Review only relevant messages in Trash; never indiscriminately empty an unrelated
mailbox. Gmail archiving is not deletion; Trash has its own up-to-30-day period.
For a documented security/legal exception, record the specific reason, minimal
records required, responsible owner and next review date. End the exception and
delete the copies when the need ends. This procedure is prepared, not yet an
observed routine or automation. No mailbox messages were deleted in this review.

### Outstanding configuration evidence

1. Resend domain Configuration: confirm both open and click tracking are off for
   account/permission mail. Do not infer this from plain-text source or a missing
   custom tracking domain. [Resend's guidance](https://github.com/resend/resend-skills/blob/main/skills/resend/references/sending/overview.md)
   places the settings at domain level.
2. Squarespace forwarding: determine its forwarding processing/retention terms
   (including any delivery subcontractor), rather than claiming zero storage.
   [Squarespace forwarding documentation](https://support.squarespace.com/hc/en-us/articles/19000909092237-Email-forwarding-with-a-Squarespace-domain).
3. Gmail: confirm no additional forwarding, mailbox export or support attachment
   copies; adopt the closure/deletion procedure above.
   [Google's deletion instructions](https://support.google.com/mail/answer/7401)
   explain Trash and permanent deletion, not universal infrastructure-copy erasure.
4. Supabase: confirm extra log drains/operator backups separately from Free-plan
   availability. Do not collect secrets to check these settings.
5. Finalize and execute pilot-end/inactive-account and permission-purpose-end
   policies. No family deletion is authorized just by adopting a schedule.

Step 10 remains open. Step 9 remains parked and step 8 stays unchanged.
