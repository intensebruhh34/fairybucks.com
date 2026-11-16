# Independent Parent PIN setup

## Apply in this order

1. Run supabase/migrations/20261116150000_parent_pin_setup.sql in the SQL editor. It adds an authenticated first-PIN setup/status RPC. Existing PINs are not changed.
2. Separately run supabase/checks/parent_pin_setup.sql. It uses disposable randomly identified fixtures and rolls them back, checking no-family/no-explorer setup, PIN preservation and account/session isolation.
3. Merge/deploy this PR only after both queries pass. The new UI calls the new function, so deploy the SQL first. No consent activation is involved.

## Behavior

The Parent Portal shows Create Parent PIN when no PIN is set. The form works before adding an explorer or manually creating a Family Vault: the authenticated function initializes an empty own-family record only when saving a valid first PIN. A read-only status check creates nothing. No explorer is created. An existing PIN cannot be replaced through this function, including competing setup attempts; reset continues through the existing verified-email flow.

Reset Parent PIN is beside the PIN entry area in Parent controls and account deletion. It stays reachable during a PIN lockout. The header no longer offers reset. PIN creation from the older Parent controls fallback also hides the global creation button. If recovery is opened for a parent who has no PIN, it offers first-PIN creation instead of asking for an unnecessary recovery email or failing because the family has not been initialized.

Setup/status checks require an active auth session and an expected parent ID matching auth.uid(). The first-PIN write coordinates with deletion by locking the parent row. Existing password/PIN recovery safeguards and rate limiting are unchanged. No real PIN or account identifier belongs in SQL source or public support messages.

## Validation and remaining live check

Full automated suite passed, including rollback SQL, UI tests for setup/reset distinctions, mismatches, concurrent existing-PIN protection, stale account responses and previous recovery behavior. Local browser QA used a synthetic signed-in parent with no Family Vault/explorers and confirmed the Create Parent PIN screen opens directly. No real credential was entered or changed during this implementation.

After rollout, test with an account with no PIN: create it directly from the portal before adding an explorer, then verify the creation button disappears. Add an explorer, open Parent controls and confirm the PIN unlocks. Reset through the adjacent reset button; the operator enters the new PIN privately, then confirms the old PIN fails and the new PIN works. Confirm the existing account password is unchanged.
