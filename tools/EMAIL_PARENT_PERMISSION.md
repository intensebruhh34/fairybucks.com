# Email parent permission — staged implementation

**Current checkpoint:** see [the November 20 launch review](../docs/reviews/pilot-launch-2026-11-20.md). Installation and initial rehearsal instructions below describe the implementation history; they are not a request to reinstall or repeat completed tests. The original version-1 activation SQL is retired and must not be used for this flow.

This replaces the signed-form process. It is not a legal-compliance certification. Email-plus eligibility depends on the actual service and provider practices. The implementation sends a distinct confirmation after explicit consent; it does not treat account verification as consent.

## Merge-safe state

- site-contact.js retains privacyNoticeReviewed=false and parentPermissionEnabled=false.
- The migration refuses an already-enforced release, updates the draft notice to version 2, keeps enforcement disabled and leaves email_method_reviewed=false.
- The Edge Function sends nothing unless its private PARENT_EMAIL_PERMISSION_ENABLED secret is exactly true.
- The authenticated portal shows a static preview; it does not request/approve consent or send email.
- No live Supabase changes or email deliveries were performed while preparing this PR.

## Install and test — not activation

1. In Supabase SQL Editor, run supabase/migrations/20261117010000_email_parent_consent.sql once, after the existing parent-consent foundation. This does not enable gates or email.
2. Run supabase/checks/email_parent_consent.sql. It uses new random example.test fixtures, sends no email and rolls back every change. Expect PASS. Keep the full result private if any unrelated account information is visible.
3. Create a Supabase Edge Function named parent-permission-email. Paste supabase/functions/parent-permission-email/index.ts into the Dashboard editor and deploy. It is self-contained and needs no npm imports.
4. For this function only, turn OFF the gateway's legacy JWT verification setting. The function itself verifies the bearer token with Supabase Auth, then the service-only RPC validates that same active parent session. Never remove these checks. With CLI deployment use: supabase functions deploy parent-permission-email --no-verify-jwt
5. Configure private function secrets in Supabase, never browser files or this repository:
   - RESEND_API_KEY: the existing verified sending service's API key.
   - PERMISSION_LINK_SECRET: a newly generated, cryptographically random secret of at least 32 bytes, kept stable while links are outstanding. A password manager can generate it; an operator with OpenSSL can use openssl rand -hex 32 locally. Do not share the value in chat or GitHub.
   - PARENT_EMAIL_PERMISSION_ENABLED: leave false until the controlled delivery rehearsal.
   Supabase supplies SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to the function environment. Confirm they exist; do not copy service credentials into the website.
6. Confirm Resend can send as no-reply@fairybucks.com and reply_to goes to support@fairybucks.com. Disable open/click tracking for this sending domain/flow. Review provider logs and access controls.
7. Use an isolated Supabase test project and private/locally served website for real email rehearsal. The hosted production release stays staged. The function currently allows browser Origin https://fairybucks.com only; a reviewed test deployment must configure its own exact origin and URL in a separate test build, not broaden CORS to arbitrary origins.
8. In that isolated test release only, set notice_ready=true and email_method_reviewed=true after review, enable the function and website test flags, and enable database enforcement. Use operator-controlled test accounts; do not invite families or add real children's information. Never turn on these flags in production just to make a test pass.

The public repository contains only the code/checklist, never secrets or filled parent evidence. Changing contact or notice content requires matching the notice fingerprint in the migration and Edge snapshot; tests enforce this relationship.

## End-to-end email rehearsal

- Request permission from a confirmed parent account. Confirm notice receipt, full notice text, expiry, privacy/support links and no tracking redirect.
- Opening the link alone must not grant permission. Sign in to the same account, read the notice, check the guardian/consent statement and select I give permission.
- Confirm a different parent account, wrong/expired token, unchecked checkbox and an expired sign-in cannot approve.
- Confirm the separate confirmation email arrives and explains withdrawal. Provider API acceptance is recorded; it does not prove inbox receipt. Check spam and provider bounce reports.
- Simulate a failed confirmation send: permission stays pending. Restore delivery and select Check again on the link page or Refresh permission status in the portal. Retry uses the same mail job/idempotency key; there is no background worker or automatic retry scheduler in this PR.
- Request another notice only after five minutes. Limits persist across withdrawal/restart and allow at most six new notice jobs per rolling daily window.
- Withdraw while a send is in flight. A late acknowledgement cannot restore permission. Confirm child sessions end and parent records/deletion remain accessible.
- Confirm old notice versions, changed parent email, sign-out and late browser replies cannot grant access.
- Delete the test account and check removal of active permission requests, jobs and limiter rows. Confirm broader provider/mailbox retention separately.
- Record results privately, then remove test messages/data according to the reviewed retention procedure.

## Delivery and security notes

- The approval token is derived with HMAC using a private function secret. URLs keep it in the fragment, not the query. The approval page immediately removes the fragment and holds the token only in memory. Reloading requires reopening the email.
- The database stores only a token hash, bound to request, parent email and notice. Approval also requires that parent's active sign-in and explicit consent.
- No approval happens on GET, page load, email scan or general terms acceptance.
- Private mail jobs lease sends for 60 seconds. Resend receives a stable idempotency key per job. A failed/lost acknowledgement never verifies permission by itself.
- Confirmation is a distinct email sent after consent, not an extra checkbox or an account-confirmation email. This implementation submits it immediately after consent. Review the timing against the chosen email-plus procedure before launch; if a delayed confirmation is selected, implement a durable scheduled sender before activation rather than claiming one exists.
- Provider acceptance is not delivered status. Rehearse bounce/non-delivery handling and establish who monitors the inbox/provider reports. No webhook is installed in this PR.
- Link expiry is automatic. Broader removal of expired/withdrawn records is an operational retention task; no automatic cleanup scheduler is claimed.
- Legacy signed-form functions remain operator-only for migration/history compatibility. The website no longer prints forms or tells parents to return them.

## Production activation — separate reviewed action

Complete method/provider eligibility, notice, security/retention procedures and the controlled rehearsal first. Resolve development child data before invitations. Then coordinate the exact notice version/hash, database notice_ready/email_method_reviewed/enforcement_enabled settings, the function enable secret and both website flags in a separately reviewed release.

Do not activate on SQL PASS alone. Rolling back the website while keeping database enforcement enabled must fail closed; restoring old development flags is not an appropriate launch rollback plan.

## Validation

Run npm ci and npm test from tests/. This includes PostgreSQL rollback checks using PGlite, portal permission checks and a stubbed Edge handler test with no real email. The PR workflow uses no production secrets.

References:
- https://www.govinfo.gov/content/pkg/FR-2025-04-22/html/2025-05904.htm (312.2, 312.4 and 312.5(b)(2)(viii))
- https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- https://supabase.com/docs/guides/functions/auth
- https://resend.com/docs/api-reference/emails/send-email
