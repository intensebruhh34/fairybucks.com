# Tooth reward readiness

## Fixes

- Switching away while a tooth/reward save is pending now resets the next explorer’s save/reload/amount controls. The original response remains scoped to its original view.
- An older failed reward reload cannot replace the status from a newer successful reload.

## Verification

`npm test --prefix tests` passes. The wallet UI regression test first reproduced both failures before the fixes. It also covers uncertain-save retries using the same request ID after reopening, duplicate clicks, invalid amounts, correction messages and PIN expiry.

`supabase/checks/tooth_reward_readiness.sql` uses random account/explorer fixtures, then rolls everything back. It checks new explorer balances, default reward 5, limits 1 and 100, rejected out-of-range amounts, family-wide settings with separate child balances, retry protection, original-amount corrections, repeated correction, spent-reward rejection, ownership, wrong/expired PIN unlocks and ended sign-in sessions. Local SQL checks pass with and without the staged consent migration. This query has no dependency on privacy tables.

A local browser preview with synthetic accounts and mocked RPCs verified switching from a delayed tooth save to another explorer: the second vault showed its own balance/count and its reward controls stayed usable. This is browser UI validation, not a production database test.

## Deployment

No new database migration is needed. Run `supabase/checks/tooth_reward_readiness.sql` as one separate Supabase SQL Editor query. Expect PASS, then merge the PR to publish the JavaScript fix.

After publishing, use a test explorer: record a tooth, confirm the balance and count; change the reward to a small amount, record another tooth, and confirm only the new award uses that amount. Correct each test entry and confirm each reverses its original amount. Restore your preferred reward setting. Check another explorer’s balance stays separate.

This verifies the tooth/reward portion of readiness. Production checks and the remaining launch/privacy work still need their own verification.
