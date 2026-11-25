# Fairybucks security audit — technical checkpoint (November 21, 2026)

**Scope:** read-only live inspection of Supabase PostgreSQL permissions/functions and security advisors; repository CI, published asset build, Netlify config and status; previous user-reported browser testing. **Result: meaningful foundational protections, but NOT certified / not cleared for public family enrollment.** No penetration test, live cross-account attack rehearsal, code-wide secret scanner, or account-provider administrative audit was completed here.

## Verified findings
| Component | Evidence observed | Assessment |
| --- | --- | --- |
| DB RLS | 8/8 `public` app tables, 20/20 `private` app tables RLS enabled. All eight public tables have policies; owner predicates in family, child, wallet, tooth, wishlist and request read policies. | Positive, **not proof all privileged RPCs are safe** |
| Private DB data | All 20 private application tables deny direct `SELECT` for `anon` and `authenticated`. Security advisor's 20 missing-private-RLS-policy informational alerts correspond to intentionally API-closed private data. | Positive; no need to add direct policies |
| Public treasure read | `treasures` permits `anon` read of active rows; contains Fairy Bucks and public catalog metadata, no parent-dollar purchase fields in inspected schema. | Intended public catalog; review additions before release |
| Anon child RPC | `public.fairybucks_child_action` is executable by `anon` and uses `SECURITY DEFINER`; entry point checks exact 64-hex token pattern, resolves a hashed unexpired session, consults parent permission, then calls private core. Core scopes requests and cancellations to child_id. | Deliberate token-only API, **security-sensitive**; repeat malicious-token/withdrawal/cross-child tests before launch |
| Parent RPCs | 20 `SECURITY DEFINER` RPCs are executable by signed-in users, with `search_path=''`. Static screening found `auth.uid()` in 19 of the 20 (anonymous child RPC excepted). 17 of 20 text bodies directly mention session IDs/auth.sessions; `fairybucks_start_child_session` delegates to private core and `fairybucks_list_treasure_requests` checks family ownership via `auth.uid()` without a direct live-session check. | No confirmed exploit, but manually verify transitive session checks/role grants and session revocation. Never revoke all these RPCs blindly |
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


## Follow-up checkpoint — November 23, 2026 (read-only)

This addendum supersedes the dated *status* of earlier P2 items only; the earlier observations remain historical. PR #74 has since merged the **public allowlist exclusion for `permission-test.html` / `permission-test.js`** and **report-only dynamic CSP**. The report-only policy does not establish that enforcing CSP will work in all browsers. The dependency still uses the jsDelivr major-version URL.

### Current evidence
- GitHub Actions on current `main`: latest permission/vault workflow **completed successfully**, run [45264708930](https://github.com/intensebruhh34/fairybucks.com/actions/runs/45264708930). Automated code tests do not constitute a two-account live browser trial.
- Supabase `private.fairybucks_privacy_release` read-only snapshot: **notice v4** (hash starts `121eaeaebaec`); `notice_ready=false`, `email_method_reviewed=false`, `enforcement_enabled=false`. Public child enrollment remains shut down.
- `pg_tables` inspection: **8 public and 20 private tables all have RLS enabled**. Private tables with RLS and no policies are expected to deny public roles; a missing policy warning is not itself an exposure finding. RLS enablement does not independently verify every privileged function.
- Fresh Supabase security advisor flags: `pg_net` extension in `public` (WARN), a callable `SECURITY DEFINER` child-action RPC for `anon` (WARN), other authenticated privileged RPCs (WARN), and unavailable leaked-password detection (WARN). Prior synthetic token/ownership tests were reported passing; **the publicly callable child RPC remains an intended token-authenticated entrypoint requiring focused threat review**, not a risk-free finding. No privilege changes were made.
- Supabase `cron.job`: `fairybucks-permission-confirmation` and `fairybucks-retention-cleanup` both active. Confirmation job runs at one-minute intervals and recent cron executions reported **succeeded** through 22:20 UTC November 23. Daily cleanup succeeded at 03:17 UTC November 21, 22 and 23. A successful cron run does not alone prove third-party email delivery or correctness of all cleanup decisions.
- Netlify project reports its current deploy is **ready**, but the static URL cannot be interactively exercised by this connector. The real-browser network, PIN, sign-up, notice, family-isolation and deletion journey remains **not tested in this checkpoint**.

### Remaining launch tests, with evidence boundary
1. On actual final host, complete two separate parent/browser accounts and verify no cross-family read, request, edit, or child handoff. Do not use actual child identifying information in test screenshots.
2. Verify real Resend request/approval/delayed-confirmation delivery, bounced-delivery handling and withdrawal with the correct v5 parent notice and email method after authorized migration.
3. Verify unauthorized, revoked, malformed and expired child-session API tokens are denied against the **actual deployed** RPCs; synthetic SQL rollback checks are supportive but not enough alone.
4. Check anonymous child page and parent page in browser Network tab; record provider hostnames without storing session tokens or personal data.
5. Confirm Netlify public build denies source-directory paths, redirects keep exact permitted origins, privacy page matches host and certificates, and both parent and child copy remain appropriate.
6. Re-run GitHub suite and Supabase advisors after any release changes. Evaluate each remaining advisor warning, and document accepted architecture-specific limitations with reviewer/date.

**Decision remains NO-GO for public child enrollment**, irrespective of the success of the checks above, until provider facts, consent-method eligibility and operator security obligations are resolved and explicitly approved.


## Operator browser rehearsal completed — November 23, 2026

The operator reports testing Netlify staging using the private, email-verified test parent account. On both laptop and phone, unverified public child handoff displayed “Review and verify parent permission before opening child mode.” The operator subsequently used the authorized private rehearsal, signed in, handed over the magic, entered Child Mode, requested three treasures, declined one, approved two, advanced them to different delivery stages, and verified the displayed Fairy Bucks balance and tooth count. These are **operator-reported browser results**, not independent automated browser recordings; the detailed delivery transitions, email timestamps, network destinations, child content inspection, and second-family isolation were not captured in this test report.

Immediately after the test, the existing operator rehearsal-close SQL was executed for the selected account: test approval withdrawn, pending permission requests withdrawn and tokens cleared, child sessions deleted, and rehearsal selection removed. Read-only SQL verification returned **0 rehearsal rows, 0 child sessions, 0 non-withdrawn consents, and 0 non-withdrawn email requests** for the selected account. The global release settings remained `enforcement_enabled=false`, `notice_ready=false`, and `email_method_reviewed=false`.

**Status:** Core shopping/rewards walkthrough is operator-accepted; test cleanup verified. The production launch decision remains **NO-GO** until the outstanding provider/legal/COPPA method, security warning disposition, and final-host testing gates are resolved. This addendum does not authorize a DNS change, Edge deployment, live SQL migration, public switch, or merge.
