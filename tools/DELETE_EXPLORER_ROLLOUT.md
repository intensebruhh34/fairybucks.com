# PIN-confirmed explorer deletion

After merge:

1. Install `supabase/migrations/20261120212823_delete_explorer.sql` once.
2. Run the complete `supabase/checks/delete_explorer.sql`, including its rollback.
   It creates random synthetic parents/explorers, temporarily changes fixture
   permission settings inside that transaction and rolls everything back. It does
   not delete an existing family's explorer or grant real parent permission.
3. Use a dummy explorer in the Parent Portal: choose Delete explorer on its card,
   review the named target and effects, check Cancel, wrong PIN and successful
   deletion with the correct PIN plus typed DELETE. Verify another explorer and
   the parent account remain. Never run the successful manual test on a profile
   whose history you want to keep.

No new Edge Function, secret, release flag or download/export UI is required.
The card may be visible before the migration is installed; its review fails
closed until the RPC is available.

## Behavior

- The server checks the current parent ID, live Auth session and exact ownership.
- It always requires a fresh PIN for deletion, even if Parent controls are already
  unlocked. PIN setup is required when none exists. Existing PIN throttling is
  reused; a normal failed-PIN response preserves the attempt counter.
- Review requests return only the parent's selected ID/nickname and readiness;
  they never delete anything. Changed nicknames require another review.
- The confirmed transaction deletes the selected profile, wallet, transactions,
  teeth, wishlist, requests/delivery history and child sessions. Parent unlocks
  are cleared so stale protected screens ask again. The parent account, settings,
  permission history and sibling explorers remain. Sibling child sessions remain.
- Separate retailer purchases, external logs/backups/support messages and saved
  device copies are outside this transaction. The warning explains that limit.
- Known deletes use exact explorer filters. Unexpected restrictive dependencies
  roll back the transaction; never add CASCADE or widen filters to force deletion.
- UI clears the entered PIN, prevents duplicate submission, ignores late replies
  after navigation/sign-out and requires reloading after an uncertain response.

Automated validation: full `npm test --prefix tests`, SQL fixture checks and UI
failure/race checks. The hosted SQL rollback check and real phone test are still
needed after installation. Step 9's support-assisted data-copy workflow remains
separate; omitting a download button does not claim that workflow was rehearsed.
