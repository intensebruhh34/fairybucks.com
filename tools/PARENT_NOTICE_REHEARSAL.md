# Parent notice and signed-form rehearsal

This is a test of paperwork and email handling. It does not create a consent request, verify a real parent, enable child mode or finalize legal compliance.

## What to use

After this PR is published, sign in to the Parent Portal, finish/open the welcome guide if prompted, and expand **Parent permission rehearsal (test only)**. Select **Preview test notice email**. The draft uses the current notice content, approved public operator contacts and the same version/reference as the printable test form. It deliberately uses synthetic account details, not the signed-in parent's email or account ID.

Select/copy the draft manually into your own email app. No email is sent by the website. The draft includes the full current notice rather than only a privacy-policy link, plus an explicit review item for the unfinished no-response deadline/deletion procedure and provider details. Do not use it for pilot invitations.

## Rehearsal checklist

Use only your own existing test email account and the support inbox. Do not include child names/photos or credentials. Do not post mailbox screenshots, returned forms or inbox/account identifiers in GitHub.

1. Open the preview while signed in. Confirm the subject and body say REHEARSAL and list ITS Security, the approved public contact details, notice version/reference and the Privacy link.
2. Send that copied draft manually from your support mailbox to your own test inbox. If you cannot send with support@fairybucks.com as From/Reply-To, record that as unfinished email setup; forwarding incoming mail does not prove outbound sending is configured.
3. Confirm receipt, whether it went to inbox/spam, and that Reply goes to the support address. Record results privately.
4. In the portal, select **Print test consent form**. Check the print/PDF preview before printing. Confirm REHEARSAL ONLY, the synthetic account reference, and the exact same notice version/reference as the email.
5. For testing, fill the form with "Test Parent — REHEARSAL", a test signature and date. Its prefilled example.test email is a fixture, not a deliverable address. Do not replace the synthetic account reference with a real parent ID.
6. From your own test inbox, reply to support with a readable scan/photo. Keep REHEARSAL in the subject and form. Confirm it arrives through forwarding in the operator's Gmail inbox.
7. As operator, compare the draft and form version/reference, legibility and test signature/date. A missing signature, mismatched notice or missing pages must not be treated as approval. Mark it REHEARSAL RECEIVED only.
8. Reply manually from support with the test receipt below. Confirm receipt at the test inbox. Do not call the real consent-verification function with rehearsal paperwork.
9. Sign out of the website. Confirm the draft and form disappear. Sign in again: prepare a new preview; old paperwork must not remain.
10. Delete rehearsal messages/attachments from the working mailbox and trash, and remove test PDFs/photos from devices when no longer needed. Record the forwarding/storage paths and any copies that cannot be immediately erased for the retention review.

## Test receipt draft

Subject: REHEARSAL received — Fairy Bucks permission paperwork

We received your test form. This was a rehearsal only. No real account permission has been requested or verified, and this message does not confirm completion of the privacy launch review.

We compared the notice version/reference, test signature and date. If any item did not match or could not be read, we recorded it as needing correction rather than approval.

For the future live process, a parent can ask questions, refuse permission, request review/deletion or withdraw permission through the reviewed Parent Portal/support process. That live process is still staged.

Fairy Bucks is operated by ITS Security.
support@fairybucks.com

## Keep a private rehearsal record

Record the date, notice version/reference, support sender/Reply-To behavior, inbox/spam result, forwarding receipt, print/PDF result, form-match result, correction/rejection scenario and cleanup result. This repository must contain the checklist only, never the filled evidence or signatures.

The existing parent_consent.sql rollback test already exercises request, privileged verification, withdrawal, version changes and account deletion using synthetic database fixtures. The operator reported that check passed after installing the foundation. The paperwork/email rehearsal covers separate operational steps that a SQL check cannot prove.

## Before live use

Resolve the actual email-forwarding/outbound settings, provider retention/backup practices, written security/deletion procedures and response deadline/cleanup for uncompleted permission requests. Finalize the notice and signed-form review process. If the reviewed notice/contact information changes, compute and coordinate the notice version/hash with the database before activation.

Do not remove draft markings or enable launch flags merely because this rehearsal succeeds.

## Validation

Isolated JavaScript tests passed against the actual module: full notice/contact/reference, synthetic test form, no consent RPCs in rehearsal, sign-out/account mismatch, duplicate/late preview replies and separation from activated mode. The full Node/PGlite suite, real browser print view and email delivery/receipt were not run in this session because the executor/browser were unavailable.

Sources used for drafting: FTC compliance FAQ (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) and amended Rule (https://www.govinfo.gov/content/pkg/FR-2025-04-22/html/2025-05904.htm). The live notice/process still requires review against the actual service practices.
