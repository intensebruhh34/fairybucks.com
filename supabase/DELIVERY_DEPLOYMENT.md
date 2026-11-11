# Delivery and FB returns

Before merging, run `migrations/20261111220000_delivery_refunds.sql`, then run `checks/delivery_refunds.sql` in a separate SQL Editor query. The check uses the existing two test parents, temporarily creates test requests and unlocks, and rolls everything back. Sign into the first test parent beforehand if the query reports no session.

After merging, approve a disposable request and unlock parent controls. Mark each next stage manually after confirming the real order progress. The child sees workshop, packaging, in the air, arriving soon, then package landed. Marking landed completes the request. There is no retailer integration or automatic tracking.

Before landing, Cancel treasure and return FB restores the captured original request price atomically, records the credit, and cancels the request. Retries cannot credit it again. This does not cancel a retailer order or issue a cash refund. Completed requests are protected against refunds in this release. Stale tabs must refresh before changing the current stage. Existing approved requests display workshop; no existing balances or stages are advanced by installation.

Validation: all migrations and rollback checks passed in a local PGlite fixture, including scope/PIN denial, sequential stages, stale updates, terminal completion, repeated refund, exact wallet/ledger amounts, and child payloads. A DOM harness exercised real parent UI actions with mocked RPCs. Live Supabase and full browser validation remain rollout steps.
