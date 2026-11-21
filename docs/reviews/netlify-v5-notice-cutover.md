# Fairybucks Netlify host + notice v5 cutover runbook (staged; do not apply yet)

## Operator decision required
**This branch is not ready to merge or deploy yet.** Current production domain `fairybucks.com` uses GitHub Pages; the Netlify site `https://fairybucks-com.netlify.app` is a working test. Public family enrollment is still off. This runbook does not determine COPPA compliance.

Changing the direct notice from **v4** to **v5** is a material provider change. The prior v4 recorded permission does not satisfy a v5 fingerprint check; request new approval from the private test parent after the coordinated migration. Do not silently reclassify previous consent.

## Prepared artifacts
- `parent-notice.js`: version 5, identifies Netlify as the host.
- `privacy.html`: updated hosting/network log disclosure and GitHub's limited source-control role after cutover.
- All 3 `parent-permission-*` Edge Function snapshots updated in source; canonical emailed approval links still return to `https://fairybucks.com`.
- `supabase/migrations/20261121233000_parent_notice_v5_netlify_host.sql`: staged version/fingerprint update with public launch still off.
- Tests lock the snapshot/fingerprint parity.

Expected v5 fingerprint: `ff307e16eedf69d35d15ccdf66d9947d92f94067a0e592fd769e53e7c1fb0732`. Current live v4 fingerprint is `121eaeaebaeceecf2aef80f83665b4b3b897beb4b8c85ae462dd15e91658bd2e`.

## Before any merge or DNS change
1. Review **actual** Netlify account agreement, privacy/DPA, applicable security assurances, and child-facing IP/log processing. Verify provider internal-operations eligibility with a qualified COPPA reviewer. Review other provider arrangements: Supabase, Resend, jsDelivr, Squarespace forwarding and Gmail. No conclusion has been certified yet.
2. Confirm which site Netlify shows as the production target and that GitHub PRs must still be reviewed before merging; unreviewed preview deploys must never enable real family access. Keep netlify.app out of Auth redirects unless specifically reviewed.
3. Decide on the Supabase Free backup/recovery gap and adopt written security, vendor, incident-response, deletion, support-case, and mail-delivery monitoring procedures. Confirm test-family data treatment. Do not put real identifiers in this repository.
4. Save current Squarespace DNS settings; identify old GitHub Pages A/AAAA/CNAME records and Netlify's **actual** recommended DNS values for this site. Do not guess IP addresses.

## Coordinated staging / cutover after approval
1. Approve the release window and merge this PR only after vendor/legal review and final approval. The merged static website will publish on **both** hosts; the public privacy page will describe the **intended** new host, so coordinate promptly.
2. Deploy *all three* matching v5 Supabase Edge Function snapshots while keeping public permission enrollment off. Preserve the `parent-permission-email` exact production and Netlify-staging origin allowlist; preserve existing `verify_jwt` settings. Verify each deployed source matches the v5 snapshot before proceeding.
3. Apply only the reviewed `parent_notice_v5_netlify_host` SQL migration. Verify `notice_version=5`, exact fingerprint, `notice_ready=false`, `email_method_reviewed=false`, `enforcement_enabled=false`, and unapproved parents fail closed. The v4 account will need a new email approval.
4. Update DNS/Netlify custom domain only once domain verification and the HTTPS certificate are ready. Review Supabase Auth Site URL/redirect allowlist. Do not remove working DNS until the new host has been validated.
5. Confirm on a real browser: privacy page correctly lists Netlify, account recovery redirects, v5 parent email request / unique link approval / delayed confirmation, denial and withdrawal, PIN checks, explorer session handoff, vault, requests, history, safe parent-only purchases and child-only Fairy Bucks.
6. Once DNS is stable, retire the GitHub Pages custom-domain publishing and temporary Netlify staging-origin access in separately reviewed changes as appropriate.
7. **Only after explicit legal, operator and user release approval** prepare a separate server-enforcement/website enrollment activation. Never make `enforcement_enabled=false` a rollback from a real public release; fail closed while recovering.

No live DNS or Supabase settings are changed by this PR.
