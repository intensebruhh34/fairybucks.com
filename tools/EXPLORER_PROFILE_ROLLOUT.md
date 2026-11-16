# Explorer profile management rollout

Parents can select **Edit explorer** in their explorer list, change a nickname or optional age/gender, save, or cancel. The same explorer ID keeps its balance, tooth records and treasure requests. The Parent PIN reset button now has space beneath Unlock.

## Deployment order

1. Run `supabase/migrations/20261116170000_edit_explorer.sql` in the Supabase SQL Editor.
2. Separately run `supabase/checks/edit_explorer.sql`. It creates random fixtures inside a transaction, checks edits, access controls, conflicts and two explorers’ separate child-mode data, and rolls back. Expect PASS. It supports both older development databases without consent tables and newer consent-enabled installations; it does not require enabling the staged privacy workflow.
3. Merge this PR to publish the portal and FAQ changes.

The new RPC requires the current parent account and a live sign-in session. Only explorers in that parent’s family can be edited. A stale snapshot returns the current details for review instead of overwriting a newer edit. The update touches only nickname, age and gender; it does not move or delete an explorer or change financial/history records. It does not change the staged parent-permission launch flags.

## Verify after publishing

- Edit an existing explorer’s nickname; confirm it appears in the list and vault.
- Cancel another edit; confirm the saved details remain.
- Set and clear optional age; choose Rather not say for an omitted gender preference.
- With two explorers, open each vault and confirm its own balance, tooth count and requests. Rename one and check both again.
- At the locked Parent controls, confirm space between Unlock and Reset Parent PIN.

Local validation: full Node/PGlite suite, including rollback SQL and profile-editor UI behavior. No production data or consent settings are changed by local tests.
