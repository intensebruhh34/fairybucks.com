# Step 8: combined permission/access verification

## Completed

The extended `supabase/checks/email_parent_consent.sql` passed both in the local
PGlite suite and on the configured Supabase database on November 18, 2026.
The hosted check used random synthetic parents/explorers inside one transaction
ending in `rollback`; it sent no email and verified no real parent account.

The combined check now covers:

- Leaving a permission request unapproved blocks child view, treasure request,
  cancellation, new handoff and new explorer insertion.
- Explicit refusal via withdrawal of a pending request leaves it withdrawn.
- Approval before confirmation acceptance still blocks the child vault.
- After simulated provider acceptance of the separate confirmation, the real
  handoff wrapper opens a child vault and permits a new explorer.
- Withdrawal invalidates the active child token for reads and writes, blocks
  fresh handoffs and explorer inserts, and preserves existing vault records.
- Existing expiry, account binding, role grants, retries, late confirmation,
  rate limits and account-deletion assertions remain in place.

Full `npm test` and `git diff --check` passed. The SQL is already exercised by
`tests/catalog.mjs`, so no workflow or migration change is required.

## Release state after the hosted rollback

A separate read confirmed `notice_version=2`, `notice_ready=false`,
`enforcement_enabled=false`, and `email_method_reviewed=false`.
No function secret, deployment or browser release setting was changed.

## Evidence limits and next checkpoint

The SQL test simulates provider acknowledgement; it does not send real consent
emails. The earlier inbox rehearsal demonstrated delivery of notice and
confirmation emails without writing real permission records. Existing UI tests
exercise permission/approval rendering and stale-account/failure handling with
controlled responses. These are distinct checks, not a completed live browser
journey through real consent approval and withdrawal.

Step 8 is **not fully closed** until that browser/email/database journey has
been rehearsed in a controlled environment. Public activation is not an
appropriate shortcut: provider/privacy review and retention work are still
pending. Preserve this checkpoint rather than marking live rehearsal complete
or enabling production permission merely to make the test accessible.

There is no new approval state or changed consent language in this PR. No SQL
installation is needed. Parents who do not approve can leave the notice alone
or withdraw a pending request; this review does not add a separate Decline button.
