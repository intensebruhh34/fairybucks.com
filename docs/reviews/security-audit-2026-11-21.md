# Fairybucks security audit — technical checkpoint (November 21, 2026)

**Scope:** read-only live inspection of Supabase PostgreSQL permissions/functions and security advisors; repository CI, published asset build, Netlify config and status; previous user-reported browser testing. **Result: meaningful foundational protections, but NOT certified / not cleared for public family enrollment.** No penetration test, live cross-account attack rehearsal, code-wide secret scanner, or account-provider administrative audit was completed here.

## Verified findings
| Component | Evidence observed | Assessment |
| --- | --- | --- |
| DB RLS | 8/8 `public` app tables, 20/20 `private` app tables RLS enabled. All eight public tables have policies; owner predicates in family, child, wallet, tooth, wishlist and request read policies. | Positive, **not proof all privileged RPCs are safe** |
| Private DB data | All 20 private application tables deny direct `SELECT` for `anon` and `authenticated`. Security advisor's 20 missing-private-RLS-policy informational alerts correspond to intentionally API-closed private data. | Positive; no need to add direct policies |
| Public treasure read | `treasures` permits `anon` read of active rows; contains Fairy Bucks and public catalog metadata, no parent-dollar purchase fields in inspected schema. | Intended public catalog; review additions before release |
| Anon child RPC | `public.fairybucks_child_action` is executable by `anon` and uses `SECURITY DEFINER`; entry point checks exact 64-hex token pattern, resolves a hashed unexpired session, consults parent permission, then calls private core. Core scopes requests and cancellations to child_id. | Deliberate token-only API, **security-sensitive**; repeat malicious-token/withdrawal/cross-child tests before launch |
| Parent RPCs | 20 `SECURITY DEFINER` RPCs are executable by signed-in users, with `search_path=''`. Static screening found `auth.uid()` in 19 of the 20 (anonymous child RPC excepted). 18 of 20 text bodies directly mention session IDs/auth.sessions; `fairybucks_start_child_session` delegates to private core and `fairybucks_list_treasure_requests` checks family ownership via `auth.uid()` without a direct live-session check. | No confirmed exploit, but manually verify transitive session checks/role grants and session revocation. Never revoke all these RPCs blindly |
| Supabase advisors | Informational private-table policy alerts (20); public `pg_net` extension placement (1 warning); deliberately callable anon child RPC (1 warning); 20 signed-in privileged RPC warnings. | Not an all-clear, but no separate unprotected-table lint observed; record exception justifications |
| Edge functions | `parent-verify` checks JWT at gateway. Three permission functions have gateway `verify_jwt=false` and perform custom application authentication/scope checks; function versions and status active. | Must confirm every action path enforces server-side bearer verification; don't turn gateway checks on without adapting cron/callback flows |
| Site delivery | Netlify site's current deploy reports ready; `netlify.toml` contains X-Content-Type-Options, Referrer-Policy, X-Frame-Options and Permissions-Policy headers; HTML no-cache specified. | Positive; custom-domain HTTPS not yet active pending DNS |
| Public asset build | Explicit allowlist excludes `docs/`, `tests/`, `tools/`, `supabase/`, SQL, repository files, and source maps. Browser `auth-config.js` uses a **publishable** Supabase key, not a service-role key. | Positive, subject to further code/secret scan |
| GitHub CI | PR checks install locked test dependencies and run tests; repository workflow grants `contents:read`; user requires owner-approved PR merge. | Positive; GitHub branch-protection REST endpoint returned 403 to this integration, so cannot confirm enforced protection rules |
| Public launch | Live consent release settings intentionally not ready; parent release/public registration flags kept disabled. Netlify domain added but Squarespace DNS still points to GitHub. | Important risk containment |

## Prioritized issues before live family enrollment

### P1 — resolve before publishing a public family service
1. **Backup/restore untested.** Supabase Free has no project backup in operator's checked settings. Design secure offsite backup/restore that respects deletions and withdrawn consents, exercise on separate test database, or choose an appropriate managed recovery tier. Do not silently export real family data or store backups in GitHub.
2. **Privileged RPC review / adversarial tests.** Run an actual browser/API rehearsal with two disposable families; ensure child requests, parent PIN, consent withdrawal, expired child tokens, cross-family IDs and post-revocation/session deletion fail closed. Particular review: child token entry point and transitive session checks for `fairybucks_start_child_session`; `fairybucks_list_treasure_requests` intentionally uses ownership but no directly visible session check. Do not equate absence of direct session check with proven unauthorized access.
3. **Permission method and provider assurances.** Qualified review of COPPA email-plus scope, logged IP/persistent identifiers, Netlify, Supabase, Resend, jsDelivr, Squarespace/Mailgun forwarding, Google; operator adopts actual written security program/retention and incident procedures. This is outside an automated security scan.
4. **Custom domain + TLS.** Keep DNS unchanged until v5 notice/migration is coordinated. After cutover verify valid certificate, HTTPS redirect/HSTS as appropriate, auth callbacks, signup/recovery, child handoff and permission revocation.
5. **PR controls.** Verify in GitHub Settings → Branches / Rulesets that `main` restricts merges to reviewed PRs and passing CI. Operator approval convention alone is not enforceable protection; integration could not read the admin endpoint.

### P2 — low-risk hardening PRs to prepare now
1. **Remove rehearsal pages from production build.** The public Netlify allowlist currently includes `permission-test.html` and `permission-test.js`. The backend separately enforces a private inbox allowlist, but this testing UI should not be published on the actual public host. Coordinate with remaining private email tests before removal; keep the main `permission.html` approval page.
2. **Introduce and test Content-Security-Policy.** Netlify headers currently omit CSP. Restrict script origins to required first-party paths and pinned Supabase jsDelivr module (or self-host), connect to project Supabase and the minimal hosts needed. Don't deploy an untested CSP: it could break sign-in, printables or consent links.
3. **Review dependency sourcing.** Browser currently imports `@supabase/supabase-js@2/+esm` from jsDelivr, allowing a floating major version. Evaluate pinning exact version and self-hosting to reduce supply-chain, CDN and children-data concerns.
4. **Validate network boundaries & secret inventory.** CI static checks exclude sensitive directories, but run a private secret scan/history review, enumerate Netlify/Resend/Supabase secret env keys without copying values into GitHub, and rotate exposed credentials if discovered.
5. **Review Netlify preview access.** Netlify app project reports visitor access control requiring SSO team login, but observed preview site loads in operator browser. Confirm how this applies to unreviewed PR deploy previews and whether any include authenticated browser flows; do not treat preview deploys as public-release approval.

### P3 — ongoing operations
- Adopt daily mail bounce/support checks, weekly security lints and dependency review, annual documented risks, incident and deletion practice. Retain evidence privately.
- Confirm GitHub admin, Supabase, Netlify, Resend, Gmail and Squarespace MFA, recovery-code custody, and least-privilege access roster.
- Re-test all controls after Netlify cutover and v5 notice reapproval.

## Non-destructive procedure and limitations

Audit queries were metadata-only; no family information was returned or changed, and no destructive probes were performed. No DNS, public-launch flags, Edge Functions, GitHub main, RLS policies or Netlify site settings were modified by this review.

Supabase security lint resources: [database linter](https://supabase.com/docs/guides/database/database-linter), [privileged function guidance](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker). This document is a **snapshot** requiring follow-up tests, not a certificate or legal conclusion.

**Operator release decision: OPEN.** Any code changes proposed to address this report require separate owner-reviewed pull requests.
