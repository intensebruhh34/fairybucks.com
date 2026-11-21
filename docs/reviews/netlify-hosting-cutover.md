# Hosting move — launch checkpoint (November 2026)

Fairybucks is planned as a family-facing service. GitHub's [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) restrict using GitHub Pages as free hosting for commercial or SaaS operations. The repository and pull-request approvals stay on GitHub; the static web host can move separately.

## Before connecting the real domain

1. Have the operator create a Netlify account and import **intensebruhh34/fairybucks.com**, selecting **main** with the checked-in `netlify.toml`. Do **not** change the domain DNS yet.
2. Run a Netlify deploy preview and confirm that HTML, JS, styling, PDF printables and SVG load. The build uses an explicit allowlist; it does not serve migrations, support documentation, tests, configuration for CI, or Git metadata. Site `auth-config.js` contains only the public publishable key, never service-role credentials.
3. Verify a malicious or accidental request for `/supabase/migrations/...`, `/docs/...`, `/tests/...` or `/.github/...` does not deliver repository file content (a catch-all 404 page is fine). `/permission-test.html` remains published because private rehearsal currently links to it; its server-side rehearsal remains account-scoped.
4. Before moving **fairybucks.com**, **update the notice and Privacy page**: replace GitHub Pages with Netlify, describe Netlify's processing purposes, and review host security/privacy terms. This is a material direct-notice change; coordinate a new version/hash with all three Edge Function notice snapshots and the database, and re-consent where required. Do not use the current v4 notice unmodified after changing hosting.
5. Review the FTC's COPPA email-plus eligibility and the actual provider terms (Supabase, Netlify, Resend, jsDelivr, Squarespace and Gmail). Independent legal review remains pending and is **not** satisfied by a hosting PR.
6. Recheck Supabase Auth Site URL and allowlisted redirect URLs for the intended final host/domain. Staging Netlify URLs should not be treated as approved login redirects unless explicitly reviewed.
7. Disable GitHub Pages custom-domain publishing **only at the coordinated DNS cutover**. In Netlify, configure and verify the custom domain and HTTPS certificate. Back up the exact Squarespace DNS records before editing; remove conflicting old Pages DNS records only when ready.
8. Test the **same release settings** on the new host: sign up, approval, delayed confirmation, rejected/withdrawn approval, parent session isolation, PIN, child handoff, vault, requests, purchases as parent-only, records and deletion. Record a rollback path using hosting/DNS restoration while keeping server permission enforcement **fail-closed**.
9. Publish only after explicit operator approval of both the privacy release and the hosting/DNS change. This preparation PR does not modify DNS, deploy Supabase functions, or enable public permission flags.

## Other release caveats

- The Supabase Free plan's lack of project backups remains a risk the operator previously deferred; code history is **not** a family-data backup.
- Privacy/support case tracking, actual provider agreement verification, bounce monitoring, annual security review, and handling of pre-pilot test child records require operator decisions.
- Pull requests are approval gated. Do not auto-publish unreviewed branches; Netlify's connection should deploy the approved `main` branch only, and previews must not grant family access.
