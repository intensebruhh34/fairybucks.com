# Approved retention periods — implementation for review

Owner approved November 20, 2026: support messages 90 days after resolution;
account inactivity 12 months, then a 30-day warning before deletion. This is an
operator-assisted process, not a new parent email-code workflow. Step 8 remains;
step 9 remains parked. The daily temporary-record cleanup is separate.

## Installation and verification

After PR review apply `supabase/migrations/20261120194032_retention_periods.sql`,
then run `supabase/checks/retention_periods.sql` in full. The check uses disposable
fixtures, simulates time and rolls everything back. Do not run fragments.

Installation sends no messages, schedules no account deletion and removes no
family data. Existing accounts get a new activity baseline at installation, so
none can be treated as having already used up their 12 months. No frontend or
API role can execute the private operator functions or access these tables.

Session creation/refresh/revocation and child-token issuance update the activity
record and cancel pending warnings. Auth timestamps are also checked. Counting
background session refreshes as use is deliberately conservative: it may defer
an otherwise eligible deletion, but protects returning parents. Reads in an
already open tab do not independently write activity; parent auth refreshes and
short-lived child tokens cover continued use. If activity evidence is uncertain,
do not send a warning or delete. Recheck access behavior when changing sessions.

The trigger on auth.sessions needs a hosted rollback check, including a genuine
sign-in/refresh, before release. Local schema fixtures cannot certify that every
future Supabase Auth version retains the same operational behavior.

## Monthly operator review and due dates

Run `supabase/operators/retention_work_queue.sql` at least monthly and check
recorded case/notice due dates before they expire. Store operational results only
in restricted support systems, never public GitHub. Review candidate accounts
individually; this report does not authorize mass deletion.

### Inactive accounts

1. For SEND WARNING, verify the parent email against the current account and
   ensure there is no recent or ongoing family use. Send to that registered
   address, using the normal support sending method. Do not send a verification
   code or ask for passwords/PINs. Use this message:

   > Your Fairy Bucks account has not shown activity for at least 12 months.
   > We plan to delete the account and its family vault no earlier than [DATE,
   > at least 30 days after this notice]. To keep it, sign in at
   > https://fairybucks.com/auth.html before that date. Signing in cancels this
   > warning. Deletion removes explorers, balances, tooth history and treasure
   > records from the active application database. Contact support@fairybucks.com
   > if you need help. Never send your password or Parent PIN.

2. Only after the provider accepts the warning for delivery, record its message
   ID or restricted case reference using the SQL below. Do not count failed
   sends, drafts, bounced or wrong-address mail as sufficient notice. Inspect
   delivery/bounce evidence again before deletion. No email is sent by this SQL.

   ```sql
   select private.fairybucks_record_inactivity_warning(
     'PARENT_UUID'::uuid, 'REGISTERED_PARENT_EMAIL', 'ACCEPTED_DELIVERY_REFERENCE');
   ```

3. A fresh warning produces a fresh notice UUID and restarts the full 30 days.
   The persisted sent_at is the time of recording; recording late extends the
   grace period rather than shortening it. Email changes require a new warning.

4. After at least 30 days, rerun the report, review the delivery evidence and
   exact target, then execute ONE account deletion in the SQL editor as postgres:

   ```sql
   select private.fairybucks_delete_inactive_account(
     'PARENT_UUID'::uuid, 'REGISTERED_PARENT_EMAIL', 'CURRENT_NOTICE_UUID'::uuid,
     'DELETE INACTIVE ACCOUNT PARENT_UUID');
   ```

5. The function locks and rechecks the parent, sessions, profiles and warning.
   It rejects insufficient inactivity, early deletion, resumed activity, wrong
   emails, replaced warnings and generic confirmations. It deletes only that
   account's active family data and auth account. Unknown dependencies roll the
   whole transaction back. Never use CASCADE or broaden filters to bypass errors.
   If the response is lost, inspect whether that exact account still exists
   before considering any retry. Provider copies follow separate policies.

No real candidate warning or deletion has been authorized by this PR. Use only
the rollback fixtures for verification; today's real test family remains intact.

### Support mailbox

The operator owns the Gmail support inbox. At case closure insert an opaque case
reference (not an email or child name), record the 90-day deadline and set a
private due-date reminder in the operator's chosen system. A database row does
not send that reminder. Do not wait until the next monthly review if the deadline
falls sooner.

```sql
insert into private.fairybucks_support_retention(case_ref)
values ('CASE_REFERENCE');
```

Before the deadline, remove the relevant received thread, related sent messages,
forwarded operator copies and locally saved attachments. Permanently delete those
specific messages from Trash. Do not empty unrelated mail. Archiving is not
removal. Do not delete unrelated authentication/permission mail as support mail.
Then record completion (never mark completion before mailbox deletion):

```sql
update private.fairybucks_support_retention set deleted_at=clock_timestamp()
where case_ref='CASE_REFERENCE' and deleted_at is null;
```

Record a specific security/legal exception with a reason and review date instead
of pretending an indefinite exception is a deletion. When its need ends, delete
copies and mark completion. Review exceptions monthly. Remove completed tracking
rows within 30 days after completion; they carry only the case reference/dates:

```sql
delete from private.fairybucks_support_retention
where deleted_at<clock_timestamp()-interval '30 days';
```

This is manual mailbox handling, not Gmail automation. Adoption requires the
owner to use the ledger and due dates; no messages were deleted in development.

## Provider evidence and remaining closure checks

- Resend tracking is recorded as off based on the owner's setup history, observed
  unsaved setup screen, and provider-documented disabled defaults; this is not an
  authenticated API settings audit. Do not enable tracking during this workflow.
- Squarespace uses Mailgun forwarding. Gmail is the operator's saved mailbox.
  Forwarders may keep delivery logs and temporary processing copies. Do not
  promise a specific Squarespace/Mailgun purge deadline from a search summary.
- Owner confirms no extra Gmail forwarding destinations and no known downloaded
  family-data exports/database backups. These are owner confirmations, not a
  forensic device audit. No new copies are created by these scripts.
- Existing daily cleanup: manual run succeeded; first cron execution is pending.
- Apply/check this migration, verify real sign-in/refresh behavior and have the
  owner adopt the mailbox procedure before marking the operations complete.
- Pilot ending sooner than 12 months needs a dated close-out roster and individual
  continuation/deletion handling; no pilot end date is assumed or auto-deletion
  scheduled. Do not represent draft 90-day pilot close-out as installed.
