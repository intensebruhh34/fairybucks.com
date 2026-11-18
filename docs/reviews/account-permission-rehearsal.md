# Private permission rehearsal on the existing site

This change enables an account-scoped rehearsal without another Supabase project.
It does not complete step 8, activate public permission, or certify privacy compliance.

## Scope and safeguards

- The migration creates an empty private selection table. Installing it selects nobody.
- Only privileged operator SQL can select a confirmed parent, with a time limit.
- Authenticated discovery returns only the caller's own selection status and requires a live session.
- The Edge Function requires either the existing public enable switch or the new
  `PARENT_PERMISSION_REHEARSAL_ENABLED=true` switch plus a positive, same-account
  server check. Request bodies cannot choose the permitted account.
- Database email operations and child gates use the selected parent's effective
  release configuration. Global release settings remain unchanged.
- An expired selected account remains blocked until its rehearsal is renewed or
  explicitly closed. Expiry never returns it to permissive development access.
- Verification events are labelled `permission-email-rehearsal`. The child gate
  rejects such evidence outside an active selection during an enforced release.
- UI labels the private rehearsal; server checks still enforce it if UI is altered.

## Deployment order after PR review and merge

1. Install the new `account_permission_rehearsal` migration.
2. Deploy the updated `parent-permission-email` function. Keep
   `PARENT_EMAIL_PERMISSION_ENABLED=false` and all global release switches false.
3. Set `PARENT_PERMISSION_REHEARSAL_ENABLED=true` for the function. Existing Resend
   and link-signing secrets stay server-only; do not copy them into source or chat.
4. Choose the existing confirmed parent account. Run the start operator script
   with that email. It selects only that account for 24 hours and ends its old child sessions.
5. Refresh the Parent Portal. The selected account shows a private rehearsal,
   with new explorer creation and child handoff paused until explicit permission.

## Remaining live checkpoint (do not mark passed until observed)

- Request the notice email; confirm child handoff remains blocked.
- Open its real link; confirm opening alone grants nothing.
- Refuse by leaving it unapproved or withdrawing the pending request; confirm no child access.
- Request again after rate limits permit. The user explicitly approves using their
  own account; receive the separate confirmation and open child mode.
- Withdraw permission. Confirm that the old child page cannot refresh, request
  or cancel treasures; a fresh handoff and new explorer creation must be blocked.
- Verify an unselected development account retains its existing behavior.
- Run the end script for the selected account; it withdraws the test approval,
  revokes child sessions and removes the selection. Set the rehearsal secret false.
- Recheck that global release flags are false. Record results and any failures.

Use dummy explorer data only. No new child information is needed for the rehearsal.
The account selection stays in the database, not public JavaScript or GitHub.

## Automated validation

The full email/access rollback test is also run with global switches false and
only a private tester selected. It checks other-account isolation, authenticated
discovery, private-table denial, expiry, approval/confirmation, withdrawal and
child read/write gates. Handler and UI tests cover selected/unselected accounts.
These tests do not substitute for the live checkpoint above.
