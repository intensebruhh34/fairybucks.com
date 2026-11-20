# Security and recovery operations

Status: step 11 work in progress, reviewed against the database security-advisor output on 2026-11-20. This document is an operating checklist, not a security certification or permission to launch.

## Database review

- `public.rls_auto_enable()` is a maintenance event-trigger function. Its application-role execution grants are unnecessary. The accompanying migration revokes those grants without changing its definition, owner or event-trigger attachment. The advisor finding alone does not establish an exploitable RPC: PostgreSQL event-trigger functions are not ordinary callable application functions.
- Run the complete `supabase/checks/maintenance_function_security.sql` after installing the migration. It checks grants and the enabled trigger, creates one empty probe table to verify automatic RLS, and rolls everything back. Do not run fragments or remove the rollback. A conflicting probe-table name should be investigated, not dropped blindly.
- Private tables with RLS and no API policies can intentionally deny direct access. Do not add policies merely to remove informational advisor findings.
- The anonymous child-action function is an intentional token-gated API. Parent RPCs also intentionally use protected database functions. Review their authorization checks and regression tests; do not indiscriminately revoke required APIs to silence the advisor.
- Supabase reports leaked-password protection disabled. Its password-security documentation lists this protection as Pro-plan-and-above functionality. The project is on Free, so record this limitation rather than claim the check is enabled. A paid upgrade is not part of this change.

## Before closing step 11

Record completion privately, without passwords, tokens or recovery codes in GitHub:

- [ ] Install the maintenance-grant migration, run its rollback check and repeat the security advisor. Review remaining findings individually.
- [ ] Confirm MFA and securely stored recovery codes for the owner's GitHub, Supabase, Resend, domain-provider and support-mailbox accounts wherever supported. Confirm a recovery route that does not depend solely on the lost device.
- [ ] Verify the hosted Auth password minimum, password-change protection, recovery redirect allowlist and email rate limits. The website asks for 12 characters, but browser validation does not prove the server enforces that minimum.
- [ ] Confirm who can access each provider account and remove obsolete access.
- [ ] Establish and rehearse a backup/restore procedure on isolated test data, including how to preserve deletions and withdrawn permissions after restoration. Do not describe recovery as tested until this rehearsal succeeds.
- [ ] Rehearse a scoped account/session containment action and record the outcome privately. Existing password and PIN recovery tests do not prove every incident-response procedure.

## Parent account and PIN recovery

Use the site's existing password-reset and Parent PIN recovery flows. Parents follow the link delivered to their own email address. Never ask them to send their password, PIN or recovery link to support.

PIN recovery is distinct from password recovery. Follow the implemented verification flow; do not manually set a PIN or approve child permission because someone emails a request. Existing PIN recovery clears parent unlocks and child sessions. Confirm that behavior in the relevant regression tests and live rehearsal before relying on it for an incident.

An ordinary local sign-out is not evidence that all devices or child sessions were revoked. When containment is needed, explicitly identify and verify each affected session type.

## Incident response

1. Record the time, affected feature and a minimal case reference in private records. Preserve necessary evidence with restricted access; avoid copying family information or credentials into public issues.
2. Determine whether the incident affects one parent account or the whole service. Use only reviewed operator actions with an exact target. Revoke affected authentication sessions, child tokens and parent unlocks as applicable, then verify access is denied. Do not run broad deletion SQL as an improvised containment measure.
3. For a service-wide incident, pause affected access using the existing release controls and verify their actual effect. Rotate exposed credentials through the relevant provider dashboard and update dependent deployments. Do not print secrets, browser storage or authorization headers in logs.
4. Correct the cause and test the affected authorization boundary before restoring access. Record what was changed and what remains uncertain. Determine any notification obligations from the actual incident before contacting affected families.

## Recovery and retained data

The Free Supabase project must not be assumed to have the paid daily-backup recovery capability. Verify the actual project recovery options before selecting a procedure. Do not create real-family database dumps just to complete this checklist. Any approved future backup needs restricted access, a retention period and an owner responsible for deletion.

Restore into an isolated environment first. Before restoring service, reapply account deletions, permission withdrawals and expired-session cleanup that occurred after the restore point. Validate family isolation, balances, requests and permission gates. Keep public child-release gates off until the restored state has been verified.

## Work sequence

Step 9 remains parked at the owner's request. Step 10 still needs evidence of the scheduled cleanup run at 03:17 UTC (10:17 p.m. Eastern Standard Time), separate from its successful manual run. Step 11 can proceed while waiting for that evidence. Neither this PR nor a successful SQL check enables public parent permission or changes launch flags.

References: [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [PostgreSQL event triggers in Supabase](https://supabase.com/docs/guides/database/postgres/event-triggers), [Supabase backups](https://supabase.com/docs/guides/platform/backups).
