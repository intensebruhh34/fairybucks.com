# Pilot privacy, support and deletion

## Scope and public contact

Public Privacy and Parent Help pages link from home/shop, child vault and parent account/profile screens. The operator confirmed support@fairybucks.com is live; it is configured centrally in site-contact.js. No secret keys or credentials are needed. The operator name, business mailing address and phone are intentionally blank pending the operator's decision; never invent a legal entity or publish personal contact information without that decision. The operator has chosen email-only public contact for now. Unset operator/address/phone fields are hidden, not fabricated. The privacy notice remains visibly marked as a draft pending applicability, notice/consent and retention review; hiding contact fields does not waive any legal obligation.

## Items to finish before family invitations

Assess which operator/contact disclosures are legally required for this exact data flow before family invitations. The FTC distinguishes information collected from parents from information collected from children; child-mode requests and passive identifiers still need review. If COPPA applies, email alone does not replace its operator name/address/phone/email notice requirements. The operator does not currently authorize publishing personal address/phone information or buying new services. Review the proposed retention commitments: vault data while the account is active; unused pilot accounts reviewed and removed within 90 days after the pilot ends unless a parent chooses to continue; support messages reviewed for removal within 90 days after closure except a specific unresolved security/legal need. These are manual operator procedures, not scheduled deletion jobs. Establish an end-of-pilot review when an end date is chosen. Do not claim automatic retention cleanup.

Confirm actual Supabase backup/log, Resend email-log and hosting/CDN retention settings before finalizing the notice. No provider purge deadline is invented. If restoring a backup, reapply deletions before returning the database to service; keep any operational deletion tracking restricted and free of unnecessary child information.

This child-themed site uses child profiles and technical identifiers. Review applicable children's privacy requirements, direct parent notice, an appropriate consent method and provider processing before invitations. Parent login/PIN or a privacy checkbox alone does not establish verifiable parental consent. This PR does not implement or certify that consent process and does not certify COPPA compliance.

Primary references:
- https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/auth/sessions

## Deploy

1. Run supabase/migrations/20261115000000_account_deletion.sql. Installation creates a function and permissions; it does not delete existing accounts.
2. Separately run supabase/checks/account_deletion.sql. It creates random disposable users and records in a transaction, tests deletion and isolation, and rolls back. It never targets existing test-parent IDs. Leave the final rollback intact. It creates a temporary-in-lifetime constraint-check table within that rollback transaction.
3. Review the PR and outstanding policy items, then merge when the operator chooses to deploy. Deploying this change is not approval to launch with an unfinished privacy notice.
4. Use a truly disposable account for final live deletion QA. Deleting the existing development account erases ALL its explorers, not just Pilot Check. Do not execute a real deletion without the operator's explicit approval at the time.

## Final product checks

- Open Privacy and Parent Help before sign-in and from the portal; check support mailto targets support@fairybucks.com.
- In the disposable account create an explorer, tooth rewards and requests; record expected data.
- Open Account, privacy and support → Delete account and family data. Back out and confirm nothing changed.
- With an old login, confirm reauthentication is required. Sign out/in and reopen within ten minutes.
- Incorrect PIN/confirmation must not delete anything. Then confirm DELETE and the correct PIN. A new account without a family/PIN must also be deletable after recent sign-in.
- Confirm parent login and family records are gone, old parent/child sessions lose access and another account is unaffected. A lost response must show an uncertain outcome, never false success.
- Do not place or cancel actual purchases. Account deletion does not affect separately arranged purchases.

## Implementation

The RPC derives the target from auth.uid(), validates a live matching session and rejects mismatched expected-parent IDs. A Supabase-signed password/OTP/magiclink AMR proof within ten minutes is required. Browser refresh and editable user_metadata cannot satisfy it. If a PIN exists, a matching unexpired session-bound unlock is required. The UI obtains it using the existing rate-limited PIN RPC.

The function locks account/family/PIN rows, explicitly deletes known app records and private settings, then removes auth.sessions and auth.users in one transaction. Existing foreign keys are unchanged. It never executes blanket CASCADE. Supabase's Auth cascades remove identities and refresh-token dependencies. Future Storage ownership or an unrelated constraint can block deletion; that rolls the WHOLE transaction back. Run the live-schema rollback check first.

Already-issued JWTs remain cryptographically valid until expiry, but their sessions and app data are gone. Sensitive app functions check live sessions. Owner RLS reads have no deleted-family rows to return; family creation cannot reference a removed auth.users row. Child tokens lose their backing session record. The browser does not receive a service-role key. No new Edge Function is required.

The client removes only the deleted family's local tooth-retry IDs and child-session state, and uses Supabase local sign-out. A failed/lost response never says deletion succeeded and does not silently retry.

## Support procedure

Reply from the configured monitored inbox. For unauthenticated deletion/copy requests, verify control of the registered parent email. A child's nickname is not identity verification; never request a PIN/password. Prefer recovery plus self-service deletion. If recovery fails, verify ownership through a documented operator review before Supabase administrative deletion. Do not say a request is fulfilled before checking active records/auth access and any relevant support copies.

## Validation and limits

Local PGlite checks cover authorization, recent sign-in/PIN protection, metadata spoofing, wrong/anonymous sessions, atomic failure rollback, dependent/root cleanup, stale parent/child tokens, replay rejection, other-family isolation and empty-account deletion. UI tests cover read-only review, exact confirmation, PIN failure, expiry, account switch, local cleanup and uncertain responses. Privacy tests check support, honest draft status, provider/storage disclosures and privacy links.

Browser QA uses mocked auth only. Real support email delivery, provider retention settings, a live account deletion and legal/consent readiness are not verified by these tests.
