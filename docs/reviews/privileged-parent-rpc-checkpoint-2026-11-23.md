# Privileged parent RPC security checkpoint — November 23, 2026

**DRAFT / REVIEW ONLY. No live Supabase writes, migrations, deployment, DNS changes, public enrollment, or merges.**

## Source and test method

Read-only retrieved actual installed Supabase definitions and EXECUTE grants for 10 sensitive `public.fairybucks_*` RPCs, then snapshotted their function bodies into `tests/fixtures/privileged-rpc-live-2026-11-23.sql`. The exact bodies execute in `tests/privileged-rpc-isolated.mjs` against PGlite with **fictional** parents, family rows, explorers, request IDs, wallets, and unlock values. The test replaces Auth JWT claims and cryptographic digest with controlled fixture functions; it does not provide full production JWT cryptographic verification.

## Result

GitHub Actions run **45297595964** at commit **b55379cee27fad0289719023ce0957af637e6594** completed successfully after correcting a **test expectation**: parent purchase deliberately returns `unavailable` rather than throwing for cross-family records. This is fail-closed and must not be misreported as a security defect.

| Public RPC | Deny anon, absent or foreign parent session | Cross-family behavior | Other tests |
| --- | --- | --- | --- |
| `fairybucks_record_tooth` | Pass | Denied | Missing unlock, valid credit, replay does not double-credit |
| `fairybucks_undo_tooth` | Pass | Denied | Missing unlock, valid correction, replay does not double-debit |
| `fairybucks_tooth_reward` | Pass | Denied | Missing unlock, 1–100 amount bound, valid amount update |
| `fairybucks_decide_treasure` | Pass | Denied | Missing unlock, valid approval, replay does not double-debit |
| `fairybucks_update_delivery` | Pass | Denied | Missing unlock, skip-stage rejection, valid stage and refund, replay does not double-refund |
| `fairybucks_parent_purchase` | Pass | Returns `unavailable` | Missing unlock |
| `fairybucks_delete_explorer` | Pass | Returns `unavailable` | Destructive path NOT exercised |
| `fairybucks_edit_explorer` | Pass | Returns `unavailable` | Successful edit NOT exercised |
| `fairybucks_delete_account` | Pass | N/A: account scoped to authenticated parent | Actual deletion and recent-AMR verification NOT exercised |
| `fairybucks_parent_setup` | Pass | N/A for initial Auth gate | Successful setup, email/consent lifecycle NOT exercised |

Role grant inspection: these RPCs had no `anon` EXECUTE grant and `authenticated` could execute them; explicit server-side authorization remains necessary because they are `SECURITY DEFINER`.

## Important boundaries

- This regression **does not** simulate actual Supabase Auth JWT signature validation, full PostgREST authorization, concurrent requests/races, child/parent UI flows, actual recent-login `amr` evidence, or full account/explorer deletion/cascade semantics.
- The isolated fixture has a stubbed PIN-validation helper; it checks outer RPC gates and unlock-token checks, not PIN throttling correctness. Separate earlier tests cover some deletion and PIN paths, but a full local Supabase integration suite is still needed.
- No penetration test against production was attempted. No real parent or child records were mutated. Passing fixture tests is not a claim of COPPA compliance or release readiness.
- PR #77 and #78 remain separate drafts; never merge any PR or deploy/apply migrations without owner approval.

## Remaining security tasks

1. Rehearse actual explorer/account deletion end-to-end on a disposable **full-schema** Supabase instance, including recent reauthentication, PIN throttling, atomic rollback, and session invalidation.
2. Execute concurrency tests on tooth credit, treasury purchase approval, balance reservations, and refunds using independent database sessions.
3. Confirm Auth/Edge and PostgREST role boundaries, search paths, grants, and live session invalidation across the remaining privileged functions.
4. Review `pg_net` dependencies, leaked-password protection, pinned CDN dependencies, backups/restore, provider written assurances, parental-consent suitability, and staged launch notice coordination.

**Status: protected-route checks and basic ledger invariants PASSED in isolated fixture; broader security audit remains OPEN.**
