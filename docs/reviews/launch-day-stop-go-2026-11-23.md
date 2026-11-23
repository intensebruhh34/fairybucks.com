# Fairybucks — launch-day operator runbook and stop/go ledger
**Prepared:** November 23, 2026 · **State:** STAGING ONLY / NOT A RELEASE APPROVAL

This runbook assembles the already staged site and technical checks so that **a later authorized launch** is predictable. Do not store children’s identifiers, real parent email addresses, secrets, approval screenshots, case logs or signed agreements in this public repository. Keep private evidence in an access-restricted operator location.

## 0. Explicit release boundaries
- Every repository change requires owner review and merge of a PR. **No automatic merge**, deploy, permission enablement or DNS changes are authorized by this document.
- Parent/child public enrollment remains OFF until the actual vendor replies, a qualified determination about COPPA parental-consent eligibility, operator procedures, and user release approval exist.
- A friendly vendor email is **not** a legal conclusion; each reply must explain actual data uses, logs/persistent identifiers, retention and subprocessors.
- No production child data collection or invitation blast in a Netlify branch/preview or at the old GitHub Pages address while the host/notice is inconsistent.
- Free-tier backup/restore is deferred by operator choice: **this is a remaining risk**, not a completed safeguard. Resolve acceptability before placing real family records at risk.

## 1. Evidence required BEFORE releasing
| Gate | Evidence to retain privately | Stop if |
| --- | --- | --- |
| Netlify | Actual account/DPA applicability, visitor IP/log purposes, retention, subprocessors and independent uses; approved domain/certificate | Vague or unanswered child request processing |
| Supabase | Actual account/DPA/security terms, Auth and child-RPC request identifiers/logs, retention and subprocessor use | Unknown independent use or missing assurances |
| Resend | DPA applicability, recipient/content usage, retention/deletion, subprocessors, bounce and confirmation failure handling | Delivery failures unmonitorable or unanswered uses |
| Other providers | jsDelivr parent-only exposure, Squarespace forwarding, Google support inbox and GitHub code hosting, with suitable operational safeguards | Material child-facing disclosure is unexplained |
| COPPA review | Documented written consent-method determination from qualified counsel or recognized safe-harbor guidance based on actual facts; if email-plus not eligible, implement stronger verifiable parental-consent method and retest | Consent eligibility unresolved |
| Written operator program | Designated owner, dated approval, restricted support/deletion case tracker, incident response, account access/MFA roster, vendor assurance records, annual risk review date | Nobody owns obligations or response process |
| Existing tests | Explicit handling of any pre-launch child records; no silent retroactive consent or unintended automatic deletion | Existing test data treatment undecided |
| Continuity | Owner's signed-off residual risk from deferred backup/recovery plan and realistic data-loss disclosures | Risk not consciously considered |
| Parent rights | Secure record-access/copy, correction, individual-explorer deletion, account deletion and withdrawal rehearsal; support identity verification | Parent review/deletion cannot be delivered safely |

**Status today:** These are outstanding gates. No section can be marked complete merely because this file or PR exists.

## 2. Prepared components already present
- PR #71 (DRAFT): <https://github.com/intensebruhh34/fairybucks.com/pull/71> — Netlify-host notice v5, three permission Edge Function source snapshots, SQL migration, parent/privacy copy and DNS transition instructions. **Do not merge or deploy yet.** Source: `docs/reviews/netlify-v5-notice-cutover.md` *in that branch*.
- PR #72 (DRAFT): <https://github.com/intensebruhh34/fairybucks.com/pull/72> — draft vendor assurance / security program for owner adoption; needs actual vendor answers.
- PR #73 (DRAFT): <https://github.com/intensebruhh34/fairybucks.com/pull/73> — technical security checkpoint.
- This PR: staging-only automated preflight test, plus this runbook. The preflight will deliberately fail if website public flags are prematurely enabled; the eventual **separate launch activation PR must intentionally replace the staging assertions with verified release-specific checks** and explain the change.
- Existing CI: `tests/package.json` `npm test` and GitHub Actions permission checks, Netlify build allowlist and report-only CSP.

## 3. Dry run now (no public release)
1. Review this PR; check green GitHub Actions. Test requires direct notice ↔ operator contact ↔ SQL fingerprint ↔ all three Edge Function snapshots to agree and guards child-facing Fairy Buck-only content.
2. On Netlify staging test that `/child.html`, `/auth.html`, privacy, help, static files and printables render and that `/permission-test.html`, `/docs/`, `/supabase/`, `/tests/` and hidden configuration do not serve source. Production GitHub Pages may behave differently; do not confuse the hosts.
3. Use Chrome/Edge DevTools **Network** tab with *Preserve log* and repeat parent login then child mode; record destination domain, request type, cookies/identifiers, and unexpected external loads **without exporting tokens or child record payloads**.
4. Check a synthetic parent account only: login, reset, notice, guardian checkbox, request email, approval link and confirmation, deny/withdrawal, PIN, tooth counter, balance, parent-only conversion, child-only Fairy Bucks, treasure request/approve/cancel/delivery, child exit, support, deletion. Preserve no real child data in screenshots.
5. Verify no staging origin or preview unintentionally enables public registration; do not disable server safeguards to make the dry run pass.
6. Review scheduled cleanup execution, failure alerting, outstanding support cases and email confirmation delivery/bounce status. Rehearsals do not replace production monitoring.

## 4. Controlled Netlify/notice v5 cutover — ONLY AFTER GATES PASS
**This is deliberately a manual sequence. Stop on a mismatch.**
1. Owner records a GO decision with date, reviewer, exact approved GitHub commit and domain cutover window; freeze new site edits during the window.
2. Back up **DNS record configuration only** (not family data): copy exact Squarespace A/AAAA/CNAME/MX/TXT records, including Resend verification and business mail forwarding. Do not overwrite mail records when editing web records.
3. Owner explicitly approves/merges PR #71 with the same notice hash as its v5 SQL and three Edge snapshots; ensure the approved main commit is the only Netlify production deploy source.
4. Deploy/verify the three reviewed v5 permission Edge Functions with their original gateway JWT/security settings. Keep parent email public enable switches OFF, and avoid exposing Edge function secrets in logs/repository.
5. Apply only the reviewed v5 SQL migration; **do not** activate public enrollment. Query the private release singleton: version 5 and expected hash, `notice_ready=false`, `email_method_reviewed=false`, `enforcement_enabled=false`. Existing v4 approvals must be renewed where required; never silently carry them forward.
6. Confirm Netlify domain ownership, target and HTTPS issuance. Change **only** the reviewed website DNS records to Netlify's actual recommended targets, not guessed IPs. Verify apex and `www`, privacy page text, mail delivery, login and reset redirect allowlist. Retire GitHub Pages custom-domain routing only once Netlify is validated.
7. Repeat complete parent/child signed-in and refused/withdrawn tests on the exact final domain, and verify all network destinations.
8. Only with the actual provider/legal signoff and owner release decision, create and review a **separate public activation PR**, and then coordinate server-side readiness, consent method, mail-function enablement and website flags. Never set a public flag true independently of matching database and Edge enforcement.
9. Re-verify no-consent, withdrawn, expired-token, cross-family, deleted-account and delivery-failure restrictions using non-real/synthetic accounts before announcing invitations.
10. Public announcement/invitations come **last**, after the real release configuration works.

## 5. Rollback and incident response
- **Before public activation:** revert static hosting/DNS carefully to the previously validated host if necessary, but keep backend child mode fail-closed if the notices differ. Revoke exposed test tokens, fix redirects and send no public invitations.
- **After public activation:** never roll server child enforcement back to permissive development mode; instead block new enrollment, revoke impacted child sessions, contain the issue, retain evidence privately, notify affected users when required, and follow written incident procedures.
- A release cannot claim data recovery without a tested backup/restore process. A source-code rollback does not restore database data.

## 6. Sign-off form — maintain privately, not in repository with personal data
- [ ] Netlify written answers reviewed
- [ ] Supabase written answers reviewed
- [ ] Resend written answers reviewed
- [ ] Remaining provider exposures evaluated
- [ ] Qualified consent-method determination completed
- [ ] Owner has adopted security, retention, deletion, incident and support procedures
- [ ] Existing test child data decision recorded
- [ ] Deferred backup risk explicitly accepted or mitigated
- [ ] CI and Netlify static-asset tests pass
- [ ] v5 fingerprint, Edge snapshots, SQL, actual domain and privacy copy match
- [ ] Final two-parent and child-browser flow passes
- [ ] Explicit owner approval of activation PR and launch time

**Final rule:** If a material checkbox is not verified, remain in staging. This document is an execution plan, not evidence of compliance or successful live release.
