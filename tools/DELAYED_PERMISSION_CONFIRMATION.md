# Delayed parent-permission confirmation

This change implements a minimum one-hour delay after explicit approval. The
period is an initial product choice, not an FTC-prescribed deadline or legal
certification. Public activation still requires the outstanding method/provider
and operational review.

## After merge — keep the public release off

1. Install `supabase/migrations/20261121131939_delayed_permission_confirmation.sql`.
2. Run the complete `supabase/checks/delayed_permission_confirmation.sql`, including
   rollback. It uses synthetic fixtures and advances their timestamps only inside
   the rollback; it sends no email and grants no real parent permission.
3. Deploy the updated `parent-permission-email` and new
   `parent-permission-confirmation` Edge Functions. Both are self-contained.
   Disable the gateway's legacy JWT verification for these functions: the parent
   handler verifies Auth/session itself, while the worker requires its own long
   random bearer secret. Never remove those application checks.
4. Generate a fresh cryptographically random secret of at least 32 bytes privately.
   Store the same value as `PERMISSION_WORKER_SECRET` in Supabase Edge secrets and
   GitHub Actions repository secrets. Never paste it into source, chat, SQL, a URL
   or logs. This is not the parent link-signing secret.
5. Leave GitHub repository variable `PERMISSION_CONFIRMATION_SCHEDULER_ENABLED`
   absent/false until the functions and secrets are ready. Set it to `true` only
   for the controlled rehearsal/cutover. The workflow runs every five minutes and
   also supports Run workflow. GitHub scheduling can be delayed or disabled after
   repository inactivity; this is not an exact five-minute delivery guarantee.
6. Keep `PARENT_EMAIL_PERMISSION_ENABLED=false`, website permission flags false
   and global database release flags false. For a real test, use the existing
   account-scoped rehearsal plus `PARENT_PERMISSION_REHEARSAL_ENABLED=true`, not
   global activation. The worker derives the recipient from the queued record,
   requires an active selection and cannot turn rehearsal approval into a public
   approval.
7. Approve using a controlled test parent. Confirm no confirmation arrives before
   one hour, child access remains blocked, and the queued job completes through
   the scheduler without keeping the browser open. Confirm a separate full-notice
   email arrives. Test withdrawal before dispatch and after permission; then close
   the account rehearsal and return its secret flag to false. Record actual inbox
   receipt separately from the provider's acceptance response.

The browser can inspect status but no longer sends confirmation on approval or
refresh. Deployment must include the updated parent handler. Its old direct
confirmation endpoint is also delay-guarded by the new database wrapper.

## Security and failure behavior

The browser cannot call the dispatch RPC, read mail tables, choose the worker's
scope or supply a recipient. Only the service role can dispatch, and only the
worker with the matching secret can reach it through HTTP. Function configuration
controls public/rehearsal scope; the HTTP request body cannot enable sending.

An internal private core permits background operations without an active parent
session, while the parent-facing service wrapper still requires that session.
The private core has no application/service-role execution grants. Background
claims recheck parent existence, confirmed/current email, effective notice hash,
readiness/enforcement, rehearsal expiry, request expiry and approval state.

Claims use the existing database lease and stable Resend idempotency key. Failed
or unacknowledged sends never verify permission. Retries use that same job; they
stop after 23 hours from first attempt to stay within Resend's 24-hour idempotency
window. After that, an operator must investigate provider status before retrying
or restarting consent; never reset the clock blindly and risk duplicate mail.

Withdrawal, deletion or changed email/notice prevents a new claim or verification
by a late acknowledgement. Email already handed to the provider may still arrive
after withdrawal; it cannot regrant access. Provider acceptance is not proof of
inbox delivery. Monitor bounces and unresolved jobs separately.

## Monitoring

Inspect the Actions workflow for failures and skipped/absent scheduled runs. Use a
restricted SQL Editor query for aggregate stalled counts (no recipient data):

```sql
select count(*) as stalled_confirmations
from private.fairybucks_permission_mail m
join private.fairybucks_email_permission_requests r on r.id=m.request_id
where m.kind='confirmation' and m.accepted_at is null and r.state='approved'
 and m.first_confirmation_attempt_at<=clock_timestamp()-interval '23 hours';
```

Disabling the GitHub variable stops future scheduled calls. Turning both Edge
permission enable flags false stops this worker's sends. It does not remove the
server permission boundary or fabricate approval. Retain enforcement during a
launched-service incident; do not roll back to permissive development mode.

## Validation

Full local regression suite includes delay, logout, scope, retry leases, late
withdrawal, changed email/hash, capped retries, expired rehearsal and child gates.
Worker tests cover secret/origin/staging rejection, full-notice parity, provider
failure, idempotency and late-withdrawal responses. Hosted SQL checks and real
scheduled email rehearsal remain required after installation.
