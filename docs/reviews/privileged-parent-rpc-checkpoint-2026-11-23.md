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

## November 24 follow-up: destructive flows + true parallel PostgreSQL sessions

- `tests/privileged-deletion-isolated.mjs` executes the exact existing `fairybucks_delete_explorer` and `fairybucks_delete_account` bodies against fictional parent/family/explorer/session and dependency rows in disposable PGlite. Verified: PIN/confirmation/name matching, wrong-account denial, recent sign-in check, rollback when an unexpected foreign-key dependency blocks a deletion, sibling preservation on explorer deletion, complete cleanup on account deletion, revoked child sessions, and other-family isolation. **CI passed** (Permission and vault checks run 45465577683). Auth and PIN functions remain test doubles: this is not a production end-to-end PIN or JWT test.
- `tests/privileged-concurrency-postgres.mjs` runs the installed RPC SQL bodies against a temporary **real PostgreSQL 17 service** using distinct concurrent PostgreSQL connections. Verified simultaneous requests for the same tooth recording, duplicate tooth undo, approval, refund, duplicate same-item treasure submission, and two different 15-FB item submissions against a 20-FB wallet. Expected serialization, idempotence and balance ceilings all held. **CI passed** (Isolated PostgreSQL concurrency safety run 45465903481); log confirms `PASS real PostgreSQL concurrent-session safety`.
- Both new tests are run in GitHub Actions and never connect to the real Supabase host. Live application data, email/SMS calls, Edge Functions, migrations and release settings were untouched.
- Test coverage limits: this does not certify long-running race/stress behavior, actual Netlify/Supabase API JWT verification, true production operator PIN implementation, every database trigger/foreign-key in the hosted schema, or provider/COPPA compliance. Actual destructive staging rehearsals and release checklist remain pending.

## Follow-up infrastructure review checkpoint

The live Supabase database reports `pg_net` installed under `public` and `pg_cron` under `pg_catalog`. A search of routine source text found `private.fairybucks_confirmation_tick` uses `net.http_*`. Relocating `pg_net` without analyzing its dependent confirmation scheduling can disrupt permission email delivery; **do not relocate or disable it in this audit PR**. Prior Supabase advisor warnings and launch blockers around leaked password protection, CDN pinning, backups and legal/provider assurances are tracked separately.
