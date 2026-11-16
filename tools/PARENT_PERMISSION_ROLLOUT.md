# Parent-permission foundation — not a compliance certification

This stage builds toward treating COPPA as applicable. It does not claim that the site is compliant, that an arbitrary PO box qualifies, or that a checkbox/login/PIN is verified parental consent. Operator contact details, final notice, provider assurances, retention/security operations and the actual verification process still need review before family invitations.

## What is implemented

A versioned parent notice with a SHA-256 fingerprint of its text plus the public operator contact details. The database stores requested/verified/withdrawn status, notice version/hash, timestamps and restricted operator evidence references; an event history preserves changes. Request retries do not duplicate an event. Parents cannot write or self-verify these records.

The pilot verification method is a signed parent consent form returned electronically to support@fairybucks.com. Section 312.5(b)(2)(i) lists returned signed forms among possible methods. The operator must actually review the current form and make reasonable efforts to verify the parent before using the private verification function. This code does not certify that an operator's review meets the legal standard. No new paid verification service, account or live message was created by this change.

After explicit activation, child-profile inserts by API users are blocked without the family's current verified permission. Child-session creation and every child view/request/cancellation enforce the same check. Notice changes invalidate old permission. Withdrawal ends child sessions and pauses new profiles; parents retain existing-record review and account deletion. Ending a child session remains allowed. No real family's existing data is silently erased or grandfathered into verified permission.

Child mode now calls the same narrowly scoped public RPC directly through fetch, with a publishable API key, no cookies and no referrer. It no longer downloads the Supabase SDK from jsDelivr. GitHub hosting and Supabase network/data processing remain; this does not eliminate provider privacy duties. Parent authentication still uses the SDK.

## Staged development — merging does not activate restrictions

The frontend defaults `siteContact.parentPermissionEnabled=false`. It hides the inactive permission panel and preserves explorer creation and PIN-controlled child handoff without calling the new consent RPC. Thus the frontend can merge before the new migration is applied. This is development access, not verified consent and not a family launch.

The database migration defaults both `notice_ready=false` and `enforcement_enabled=false`. Applying the foundation does not require a signed form or pause existing child sessions. Existing authentication, PIN, ownership, wallet and request checks remain in the core functions. No consent is fabricated or granted. Only the privileged activation script turns server enforcement on; browsers cannot change that setting. Once enabled, a frontend flag cannot bypass server enforcement.

Previous privacy/deletion migration/check results do not need repeating unless their SQL changes. Apply the new parent_consent migration and separately run its rollback-only check to stage the database foundation. Do not run the operator activation or verification scripts yet. Keep public family invitations on hold until the checklist is complete.

## Operator checklist before activation

1. Confirm the operator identity, legitimate mailing address, phone and monitored support email. Add approved public details in site-contact.js. Do not publish personal contact details without the operator's choice. Confirm whether a proposed mailing-address arrangement satisfies the applicable requirement before relying on it.
2. Finalize Privacy, the direct parent notice and the exact signed form. Identify every relevant provider, including the incoming-support mail provider, and the exact data/purposes. Review which disclosures are integral, and avoid optional/unrelated disclosures or ads. Review any further consent choices required by the actual processing arrangement.
3. Confirm and retain appropriate written provider security assurances and processing terms. Inspect real project log/backup settings; document actual retention periods instead of guessing. Minimize request-body/error logging and restrict who can access logs.
4. Adopt the written security/retention procedures in SECURITY_PRIVACY_OPERATIONS.md, assign a responsible operator and test restore/deletion handling. These are draft procedures, not evidence they have already been performed.
5. Set siteContact.privacyNoticeReviewed=true only after that review. This hides the public draft banner; it does not activate permission enforcement.
6. Run `node tools/notice-hash.mjs` using the exact reviewed source. It must report contacts_complete=true and privacy_reviewed=true. Material changes require a new notice version and renewed verified permission. Retain the old notice text privately or in repository history so its fingerprint remains explainable.
7. Apply supabase/migrations/20261115010000_parent_consent.sql, then separately run supabase/checks/parent_consent.sql. The check creates temporary-in-lifetime random test users and rolls all changes back; it does not approve existing parents.
8. Fill and run supabase/operators/activate_parent_notice.sql ONLY after the checklist. It deliberately fails with blank placeholders. This sets server enforcement on and revokes old child sessions; it does not verify any parent by itself. Deploy siteContact.parentPermissionEnabled=true at the same reviewed cutover so parents see the verification workflow. After activation, keep enforcement enabled; do not use the development setting as a consent-withdrawal bypass.

## Manual pilot verification

- Parent signs in and reads the welcome guide and Parent permission notice. They confirm guardian status and request verification. This stores requested, not verified.
- They print/sign the form and return a readable scan/photo from their registered parent email to support. Phone users can use their browser Share → Print menu if the print button does not open a print service. No child photo/full name, government ID, password or PIN is requested.
- The form contains the parent account reference, registered email, notice version/hash, request timestamp, operator contacts, notice text and signature/date blanks. Check the FULL form against the exact current template, not just the printed hash label. Check the signature/date and sender/account email. Resolve suspicious/mismatched requests before approval.
- Store the returned form in restricted consent storage. Use an internal evidence reference, not the signature/file contents or unnecessary child information, in SQL. Limit inbox/storage access to the responsible operator. Do not commit actual forms, user emails or account UUIDs to public GitHub files.
- Fill and run supabase/operators/verify_parent_consent.sql after review. The function requires a matching pending request and current ready notice. It rejects approval after withdrawal without a new request, and only privileged database operators can call it.
- Parent refreshes status, adds an explorer and starts child mode through the PIN-controlled handoff. The signed form describes account-level permission for the children whose profiles the parent creates; any different scope or new material use needs review and a notice/consent update.

## Withdrawal, deletion and retention

Parents may withdraw permission in the portal; that ends child sessions immediately and stops new profile creation. Existing records stay available for parent review/deletion. A deletion request when locked out requires ownership verification via the support procedure. Existing account deletion cascades to private consent records and event history. It does not erase external signed forms/emails automatically.

Keep signed consent evidence only for the documented purpose of proving active permission. Review it for deletion within 30 days after withdrawal/account deletion unless a specific documented legal preservation need applies. Treat this as a manual operator obligation, not an automated promise. Other support-message and pilot-data retention follow the finalized policy. Document what was removed and any limited hold without creating unnecessary child profiles or permanent identity records. Pending requests without returned forms should be reviewed for expiry/removal promptly; do not retain unnecessary pending records indefinitely.

## Validation

Local database checks cover usable staged development without fabricated consent, retained PIN/family checks, activation blocking existing unverified sessions, draft readiness, wrong version/hash, guardian assertion, request idempotency, privileged verification, direct-write/core-function denial, authenticated profile enforcement, wrong-family inserts, child-session access, changed notices, withdrawal, re-request and deletion cascades. Legacy fixture approvals exist only in the local PGlite harness; no real account is approved by migration. UI tests cover requested versus verified state, version/contact hash, print availability, stale responses, account switches and failures. Direct child API transport was checked read-only with a synthetic invalid token; no real child token or account credential was used.

Final release checks still include real signed-form review, real parent/child flows with the live schema, provider assurances/settings, actual phone printing, public contacts and legal review. Never label this PR or a successful SQL check as COPPA certification.
