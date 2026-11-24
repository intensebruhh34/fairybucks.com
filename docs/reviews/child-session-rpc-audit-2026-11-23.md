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

## Open checks and next implementation

1. Inspect `private.fairybucks_submit_for_explorer`, child session creation/revocation and all call chains for price bounds, ownership, consent gating, unexpected grants, and race conditions.
2. Locate the authoritative checked-in migration/function sources and build CI integration regression against those *exact definitions* (prefer a disposable local Supabase instance or equivalently faithful PostgreSQL fixture). Avoid testing only a rewritten implementation.
3. Evaluate whether a verified weakness warrants a separate minimal migration PR, with rollback and signed-in/child-mode browser checks.
4. PR #77's parent request-listing hardening is **separate and remains draft**. Continue the remaining RPC audit, `pg_net` dependency review, leaked-password feature check, dependency pinning, backups, and provider/COPPA gates.

## Supabase advisor warnings

The advisor flags the anonymous `SECURITY DEFINER` child entrypoint and other authenticated `SECURITY DEFINER` RPCs. Their existence alone does not prove exploitable access; verify authorization and EXECUTE grants individually. The 20 private RLS-without-policy notices appear consistent with intentional deny-by-default design. Preserve those restrictions.

**Release gate: public enrollment OFF. No merge, Supabase migrations, deployment, DNS change, or release flag change without owner approval.**
