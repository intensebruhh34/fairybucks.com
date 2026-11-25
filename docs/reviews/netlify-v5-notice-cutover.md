# Fairybucks Netlify notice v5 coordination runbook (staged; do not apply yet)

## Operator decision required
**This branch is not ready to merge or deploy yet.** **Updated 2026-11-24:** the connected Netlify project `fairybucks-com` now reports `fairybucks.com` as its primary website and an active ready deploy. The earlier GitHub Pages-to-Netlify DNS cutover assumptions in this runbook are stale. Before release, independently check the actual public domain's HTTPS routing, DNS records, custom-domain certificate and matching deployed branch; do not change DNS simply because this notice PR is merged. Public family enrollment is still off. This runbook does not determine COPPA compliance.

Changing the direct notice from **v4** to **v5** is a material provider change. The prior v4 recorded permission does not satisfy a v5 fingerprint check; request new approval from the private test parent after the coordinated migration. Do not silently reclassify previous consent.

## Prepared artifacts
- `parent-notice.js`: version 5, identifies Netlify as the host.
- `privacy.html`: updated hosting/network log disclosure and GitHub's limited source-control role after cutover.
- All 3 `parent-permission-*` Edge Function snapshots updated in source; canonical emailed approval links still return to `https://fairybucks.com`.
- `supabase/migrations/20261121233000_parent_notice_v5_netlify_host.sql`: staged version/fingerprint update with public launch still off.
- Tests lock the snapshot/fingerprint parity.

Expected v5 fingerprint: `ff307e16eedf69d35d15ccdf66d9947d92f94067a0e592fd769e53e7c1fb0732`. Current live v4 fingerprint is `121eaeaebaeceecf2aef80f83665b4b3b897beb4b8c85ae462dd15e91658bd2e`.

## Before any merge or database/Edge deployment
1. **Netlify provider evidence collected:** self-serve DPA last updated 2026-11-13, 19 pages, and 2026-11-24 subprocessor list identifying 26 companies. DPA §§1.6/1.24 exclude end-user CDN/access/function logs from independently controlled Service Data and classify them as Customer Data. §4.1 restricts advertising use. Exhibit II specifies retention up to 13 months for archived CDN/access logs, 1 year for general platform logs and 6 years for security/abuse archives. See `docs/reviews/privacy-notice-v5-evidence-gates-2026-11-24.md`. These materials do **not** determine the exact data sent to each subprocessor, children's privacy legal eligibility, or provider account settings. Review other arrangements: Supabase, Resend, jsDelivr, Squarespace forwarding and Gmail.
2. Confirm which site Netlify shows as the production target and that GitHub PRs must still be reviewed before merging; unreviewed preview deploys must never enable real family access. Keep netlify.app out of Auth redirects unless specifically reviewed.
3. Decide on the Supabase Free backup/recovery gap and adopt written security, vendor, incident-response, deletion, support-case, and mail-delivery monitoring procedures. Confirm test-family data treatment. Do not put real identifiers in this repository.
4. Read-only verify DNS, HTTPS and deployed-domain routing as it exists today. Capture a rollback state; **do not plan an unnecessary DNS migration**. If anything is inconsistent, prepare a separate owner-reviewed remediation instead of assuming GitHub Pages is still active.

## Coordinated notice-version and permission release after approval
1. Approve the change window and merge this PR **only** after provider/legal review, risk acceptance, and owner approval. Netlify is already the current host. Because merging `main` triggers a Netlify deploy, synchronize the v5 website, database and three Edge Function snapshots deliberately. A pre-release maintenance/deny state must prevent users relying on inconsistent versions.
2. Deploy *all three* matching v5 Supabase Edge Function snapshots while keeping public permission enrollment off. Preserve the `parent-permission-email` exact production and Netlify-staging origin allowlist; preserve existing `verify_jwt` settings. Verify each deployed source matches the v5 snapshot before proceeding.
3. Apply only the reviewed `parent_notice_v5_netlify_host` SQL migration. Verify `notice_version=5`, exact fingerprint, `notice_ready=false`, `email_method_reviewed=false`, `enforcement_enabled=false`, and unapproved parents fail closed. The v4 account will need a new email approval.
4. Verify current `fairybucks.com` DNS and HTTPS configuration, plus Supabase Auth Site URL/redirect allowlist; keep DNS untouched if current routing is correct. Test the updated site against the production host.
5. Confirm on a real browser: privacy page correctly lists Netlify, account recovery redirects, v5 parent email request / unique link approval / delayed confirmation, denial and withdrawal, PIN checks, explorer session handoff, vault, requests, history, safe parent-only purchases and child-only Fairy Bucks.
6. Separately confirm whether any old GitHub Pages custom-domain publishing or temporary Netlify staging-origin allowance remains; retire it only in an owner-reviewed change after routing and auth tests.
7. **Only after explicit legal, operator and user release approval** prepare a separate server-enforcement/website enrollment activation. Never make `enforcement_enabled=false` a rollback from a real public release; fail closed while recovering.

No live DNS, Netlify, Supabase, or public-enrollment settings are changed by this PR. Current v4 permission is not silently upgraded. This runbook is a release preparation artifact, not a release authorization.
