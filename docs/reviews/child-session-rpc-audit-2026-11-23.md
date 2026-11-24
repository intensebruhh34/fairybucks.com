# Child-session RPC security checkpoint — November 23, 2026

**READ-ONLY REVIEW / DRAFT. No production changes, enrollment activation, migrations, or merges.**

## Scope and evidence

Reviewed the **live** Supabase function definitions and role EXECUTE privileges for:
- `public.fairybucks_child_action(text,text,uuid,integer,integer)`
- `private.fairybucks_child_action_core(text,text,uuid,integer,integer)`
- `private.fairybucks_child_permission(uuid)`

Also checked Supabase security advisor findings, and existing `tests/child-mode.mjs` UI regression coverage on `main`. No live child/session tokens, personal data, or credentials were retrieved.

## Confirmed properties (source review, NOT adversarial test results)

- The exposed `fairybucks_child_action` RPC is `SECURITY DEFINER`, with `search_path = ''`, and is executable by `anon` and `authenticated`. This **is intentional** for child-mode access without a parent login; do not revoke `anon` or convert the function wholesale to `SECURITY INVOKER`.
- Its wrapper checks permission for syntactically valid tokens matching a live child session; when a matching token's parent lacks permission, it returns `permission_required`.
- The core rejects null/malformed tokens, hashes 64-character lowercase hexadecimal tokens with SHA-256, and requires an unexpired matching session for `view`, `request`, or `cancel`; otherwise it returns `expired`.
- `request` dispatches to `private.fairybucks_submit_for_explorer`, and `cancel` scopes the request update to the explorer associated with the token and `status = 'pending'`. The `view` response is scoped to the token's explorer.
- `end` deletes the session matching the provided token hash, then returns `ended`. Its permission check is deliberately bypassed, permitting cleanup after permission withdrawal.
- Existing `tests/child-mode.mjs` checks UI behavior around expired/withdrawn permission, stale responses, token replacement, storage errors, and unauthenticated child RPC requests; **these are browser-code tests, not proof of database authorization**.

## Security question requiring investigation

The wrapper checks parental permission before calling the core. A full adversarial integration suite still needs to demonstrate the actual database behavior for revoked/expired tokens, cross-explorer requests, withdrawal during child mode, duplicate requests, and lifecycle operations. Token secrecy matters: possession of a valid child token authorizes access until expiration, revocation, or permission failure. Do not expose token hashes or raw tokens in logs/tests.

## Follow-up read-only server-side call-chain inspection

Inspected the **live** definitions of `public.fairybucks_start_child_session`, `private.fairybucks_start_child_session_core` and `private.fairybucks_submit_for_explorer`.

- Session startup wrapper requires `private.fairybucks_child_permission(auth.uid())`; the core separately checks the live parent Auth session in `auth.sessions`, parent unlock-token hash/expiry, and explorer family ownership. It generates 32 random bytes, exposes the 64-character hex token once, stores only its SHA-256 hash, and sets a **one-hour** expiration. Starting a new child session for an explorer replaces that explorer's previous token.
- The submit helper serializes submissions per explorer with a row lock, looks up price server-side, checks active catalog item and expected price, blocks an already-pending identical treasure, and reserves pending request prices against wallet balance. Duplicate matching request IDs return `requested`. This appears to prevent several obvious price-forgery/double-request avenues **by design**, but requires actual concurrent integration testing.
- **Verified database grants:** `anon` and `authenticated` have neither `USAGE` on schema `private` nor `EXECUTE` on `fairybucks_child_action_core`, `fairybucks_start_child_session_core`, `fairybucks_submit_for_explorer`, or `fairybucks_child_permission`. Direct calls to these private helpers are not authorized for those API roles. This is positive defense in depth; still test the public wrappers adversarially.
- These checks are **code inspection and grant inspection**, not proof against all forged claims, race conditions, RLS bypasses, or incorrect behavior through authorized public entrypoints.

## Required isolated-environment regression matrix

Use synthetic parents, explorers, treasures, requests and child tokens created in a **separate test database**; exercise the actual deployed function definitions (not rewritten mocks):

| Case | Expected behavior |
| --- | --- |
| Null, malformed, uppercase or wrong-length token with `view` | `expired`; no explorer data |
| Unknown valid-format token with `view` | `expired`; no explorer data |
| Valid unexpired token with permission | Only token-bound explorer's wallet, requests and identity |
| Token after explicit `end` | `expired` |
| Token with expired session row | `expired` |
| Token after parent withdraws permission | `permission_required` and no child data/action |
| Token for explorer A, `cancel` request for explorer B | No change to B's request |
| Token for explorer A, `request` with forged price or item | Reject/validate server-side; no balance corruption |
| Token for explorer A, repeated request ID | No duplicate record or double charge |
| Token for explorer A, `cancel` approved request | Must not change approval |
| Parent Auth session missing/revoked before starting child session | No new token issued |
| Any child RPC with parent credentials absent | Works only with a valid token + current parent permission |

Do **not** run mutation cases against the live family/test account. Transaction rollback is not a substitute for a separate test environment for email, network, or other side effects.

## CI regression implemented in this draft PR

- `tests/fixtures/child-rpc-live-2026-11-23.sql` contains the exact existing **live function definitions** for the public child entrypoint, private core, and private submit helper, captured read-only on November 23. It does not include family records or secret token values. The snapshots must be refreshed/reviewed when the production functions change.
- `tests/child-rpc-isolated.mjs` executes those definitions in disposable PGlite using synthetic parents/explorers/tokens, with deterministic stand-ins for the digest function and consent decision. It covers malformed, unknown, expired and ended tokens, scoped requests, forged prices, idempotence, withdrawal and cancellation. The test is included in `tests/package.json`.
- **Test limitations:** this is not a full Supabase/PostgREST or live-network penetration test; it does not prove pgcrypto correctness, real consent record evaluation, parent session issuance, or true simultaneous transaction races. Its consent helper is deliberately mocked, so do not describe the full consent pipeline as adversarially verified. Check the PR CI status before treating the suite as passing.

## Follow-up CI: parent-to-child session issuance

- `tests/fixtures/child-session-issue-live-2026-11-23.sql` snapshots the installed `public.fairybucks_start_child_session` wrapper and `private.fairybucks_start_child_session_core` function bodies (read-only).
- `tests/child-session-issue-isolated.mjs` exercises those exact bodies against a disposable in-memory PostgreSQL fixture. It tests: missing/mismatched/revoked parent Auth session, denied parent permission, invalid/expired PIN unlock, cross-family explorer, successful token issuance and hashed storage, and consumed unlock preventing immediate reuse.
- GitHub Actions `Permission and vault checks` **passed** at commit `65cdaf9944e37d29694e01569aba5595920bbec8` (run 45296540434). Passing CI demonstrates the synthetic fixture tests; it does **not** verify real email-plus records, JWT verification over HTTP, production network behavior, or race conditions. An actual permission-withdrawal integration remains an open launch gate.

## Open checks and next implementation

1. Inspect `private.fairybucks_submit_for_explorer`, child session creation/revocation and all call chains for price bounds, ownership, consent gating, unexpected grants, and race conditions.
2. Locate the authoritative checked-in migration/function sources and build CI integration regression against those *exact definitions* (prefer a disposable local Supabase instance or equivalently faithful PostgreSQL fixture). Avoid testing only a rewritten implementation.
3. Evaluate whether a verified weakness warrants a separate minimal migration PR, with rollback and signed-in/child-mode browser checks.
4. PR #77's parent request-listing hardening is **separate and remains draft**. Continue the remaining RPC audit, `pg_net` dependency review, leaked-password feature check, dependency pinning, backups, and provider/COPPA gates.

## Supabase advisor warnings

The advisor flags the anonymous `SECURITY DEFINER` child entrypoint and other authenticated `SECURITY DEFINER` RPCs. Their existence alone does not prove exploitable access; verify authorization and EXECUTE grants individually. The 20 private RLS-without-policy notices appear consistent with intentional deny-by-default design. Preserve those restrictions.

**Release gate: public enrollment OFF. No merge, Supabase migrations, deployment, DNS change, or release flag change without owner approval.**
