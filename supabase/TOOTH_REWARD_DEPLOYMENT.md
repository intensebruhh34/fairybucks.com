# Adjustable tooth rewards

Run `migrations/20261111230000_adjustable_tooth_rewards.sql`, then run `checks/adjustable_tooth_rewards.sql` in a separate SQL Editor query. The check uses the two existing test parent accounts and rolls back all temporary records and settings; sign into the first account beforehand if requested.

After PASS and merge: open a child vault, unlock Parent controls, and use Fairy Bucks per tooth. Whole numbers 1–100 apply to future entries for every explorer in that parent's family. The fallback remains 5 until changed. No old rewards, balances or tooth entries are modified by installation or setting changes. Corrections use the original ledger amount. A replay of a previous tooth ID stays idempotent even after the reward changes. The server selects the reward; the browser cannot supply the awarded amount.

The settings table is private. Reading or changing settings requires an active authenticated session, a valid PIN unlock and ownership of the explorer. Recording and settings updates lock the settings row to serialize concurrent changes. UI load/save failures have reload/retry controls; an uncertain recording response uses its existing request ID for retry and shows a generic success message rather than guessing the amount. Wallet history shows the actual credit.

Local validation: all migrations and regression SQL checks passed under PGlite. New checks cover default, invalid amounts, changed awards, retries after changes, original-amount corrections, repeated correction, family/expired-PIN/anonymous denial. A DOM fixture with the real wallet module and mocked RPCs passed PIN gating, loading/saving 2 FB, recording and lock clearing. Live Supabase and browser checks remain rollout steps. Catalog expansion is a separate next change.
