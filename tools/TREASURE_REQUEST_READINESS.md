# Treasure request readiness (step 4)

## Review findings

Code review found the existing approval and delivery/refund functions lock the request row before changing its status or balance. A repeat approval returns the existing decision; a repeat refund returns the recorded refund result. Pending requests reserve availability without deducting the displayed balance. Approvals and refunds use price_at_request, so later catalog prices do not change the captured cost.

This PR adds verification coverage; it does not change application behavior, database functions, catalog prices, parent permission flags or the deployment configuration.

## Run before marking step 4 complete

1. Open supabase/checks/treasure_request_readiness.sql from this branch.
2. Run the entire file as one separate Supabase SQL Editor query. Expect a PASS result.
3. Merge the verification PR after the query passes.
4. Do the short live test below on a test explorer.

No new database migration is required. The query creates random disposable accounts, families, explorers, catalog items, requests and unlock/session fixtures inside a transaction, then rolls back. It does not depend on existing test emails or a particular catalog price. When staged consent tables are present, it prepares only a synthetic-account permission fixture and temporarily readies the notice inside the same rollback transaction; it does not enable enforcement or persist a consent change.

## Coverage

- Stale-price rejection and duplicate request IDs/pending items.
- Pending reservations without a balance debit; reserved funds cannot be requested twice.
- Child cancellation and repeated cancellation release the reservation.
- Decline and repeated decline do not debit the balance; a declined request cannot later be approved.
- Approval requires a parent PIN unlock and debits the captured cost once.
- A child cannot cancel an approved request or a sibling's request.
- Changed catalog prices do not change the approved cost or original refund.
- Stale-stage and missing/expired-PIN refund attempts are rejected.
- Repeated refund returns Fairy Bucks once; refunded requests cannot be re-approved.
- Sibling balances stay separate.
- Delivery cannot skip steps; landing completes the request and prevents a later refund.
- Insufficient funds and inactive items do not create a pending request.
- Another family cannot request, cancel, approve or refund this family's treasure.
- An ended parent sign-in cannot submit a request.
- Child payload excludes retailer/purchase details and sibling requests.

These are sequential replay/isolation checks. They do not execute simultaneous database transactions or replace a phone/browser test.

## Live test

Use a test explorer with enough Fairy Bucks. Request a treasure and confirm the balance stays unchanged while pending. Cancel it and request it again. Decline it, then make one more request and approve it: only that approval should debit the balance. Cancel the approved treasure with the parent refund button and confirm its original Fairy Bucks return once. Check the other explorer's balance stays unchanged. This does not require placing or paying for a retailer order.

## Validation status

The application code and existing SQL contracts were reviewed. The new SQL is wired into both the full migration harness and its no-consent-table variant. This session had no executor or browser, so the new SQL, full Node/PGlite suite and live UI were NOT executed here. Do not mark this step passed until the verification query and live test succeed.
