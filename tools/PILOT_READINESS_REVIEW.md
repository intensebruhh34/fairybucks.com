# Pilot readiness review — November 16, 2026

Status: in progress. Public family invitations and consent activation remain on hold. Current development access stays available. This review is evidence of checks performed, not a compliance certification.

Reviewed source: main commit a9ccfca (merged PR #32). No real account was deleted, no parent was marked as verified, and no activation or production database migration was run during this review.

## Checks completed

| Item | Evidence | Result |
| --- | --- | --- |
| Published operator contact | Live Privacy page displays ITS Security, the approved phone/address and support email | Pass for display; does not verify business registration, phone reception or mailbox delivery |
| Existing parent access | Existing authorized test session loads Family Vault and existing explorers | Pass; consent panel remains inactive |
| Deletion access protection | Live deletion review rejects an old sign-in and asks for a fresh sign-in within ten minutes | Pass for this guard; no irreversible submission attempted |
| Database and UI regressions | Full `npm test --prefix tests` on the merged source | Pass: wallet/request/refund/delivery, PIN/recovery, isolation, deletion, staged and activated consent fixtures |
| Support mail routing | Public DNS MX records resolve to mxa.mailgun.org and mxb.mailgun.org | Mailgun is in the inbound route. Does not prove support alias delivery or identify the final destination inbox |

## Provider findings and remaining evidence

| Provider | Published documentation | Still needed for this account |
| --- | --- | --- |
| Supabase | Pricing lists API/database log windows of 1/7/28/90 days by plan. Backup documentation offers daily backups on paid plans and recommends exports for Free projects. A dashboard query window is not proof that every internal provider copy has been purged. The DPA distinguishes processing of customer data from Supabase's own account information. | Dashboard sign-in; actual plan, region, enabled backups/PITR/drains, auth-log storage/settings, manual exports, access/MFA and applicable written processing/security assurances. Do not assume this project is still Free from older notes. |
| Resend | Standard Free/Pro/Scale documentation states 30-day email/log retention and 7-day backups. Its DPA is described as included with accounts. | Confirm account plan, custom SMTP configuration, template contents, open/click tracking settings, signed account DPA and whether support/receiving features are used. Do not interpret Resend as the incoming support mailbox merely because it sends account emails. |
| GitHub Pages | Pages documentation says visitor IPs are logged for security. Its limits page restricts using Pages to run an online business/commercial SaaS and cautions against sensitive transactions. | Resolve hosting suitability for the planned family service before launch, through an appropriate host or written clarification. This is a hosting decision; the GitHub source repository and PR workflow can remain. Do not claim the current service has already been suspended or that changing repository visibility solves the hosting rule. No hosting or DNS change was made. |
| jsDelivr | The operator publishes privacy, subprocessor and processing terms. Source currently loads its SDK on parent pages; child mode no longer loads that SDK. | Review applicable terms/subprocessors and retention. The privacy-policy web page did not expose its full text in retrieval; follow the official repository document. Do not infer zero third-party processing from the absence of a child SDK. |
| Incoming support mail and consent evidence | Mailgun appears in public MX records. Squarespace documents Mailgun-backed forwarding, but DNS alone cannot establish the route owner or destination. | Confirm whether Squarespace forwarding is used, the final inbox provider, forwarding/storage copies, access/MFA, retention/trash/backups and restricted signed-form storage. Add the confirmed providers/purposes to Privacy and the direct parent notice before activation. |
| Phone service | The approved number is visible on Privacy and Parent Help | Identify the phone/voicemail provider and whether it stores caller numbers, messages, recordings or transcripts. Make a test call from a separate phone and confirm reception or appropriate voicemail. Do not send child details for this test. |

Provider age clauses must be read in context: restrictions on holding a developer/service account do not alone establish whether processing a customer's properly authorized family-app data is allowed. Review the actual customer-data terms; obtain clarification where needed rather than assuming permission or prohibition.

## Consent and deletion walkthrough still required

1. Finalize actual data flows, provider assurances/disclosures, purpose-specific retention schedules and responsible operator. Confirm the public contact route works. Keep `privacyNoticeReviewed=false` and `parentPermissionEnabled=false` meanwhile.
2. Establish restricted handling for signed forms and a practical review/deletion schedule. A login, PIN, checkbox or test fixture is not real verified permission.
3. Confirm the consent foundation migration/check is installed on the real project before the planned activation. Installation defaults to no new restrictions; operator activation is separate. Do not activate all users merely to test a form.
4. Rehearse the complete notice/form/request/review/withdrawal flow using synthetic local fixtures first. Local automated checks passed; real pilot verification and phone printing remain unverified.
5. Use a specifically designated disposable live account for the final deletion submission, with fresh sign-in and PIN as applicable. Obtain confirmation immediately before permanent deletion; preserve the main test account. Confirm subsequent sign-in and stale parent/child sessions cannot restore the removed data. Reconcile external inbox/consent copies separately.
6. Before restoring any backup, reapply deletions and permission withdrawals before reopening service. Document that procedure in restricted operational records.

## Support reachability checks

Website email links work as links; that does not test delivery. From a separate mailbox, send a message containing only “Fairy Bucks support delivery test” and confirm receipt and a usable reply path. No automated test message or call was sent in this review. Check spam, forwarding and voicemail without using any child's information.

## Official references reviewed

- Supabase pricing: https://supabase.com/pricing
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Supabase DPA: https://supabase.com/legal/customer-resources/data-processing-addendum
- Supabase customer-data terms: https://supabase.com/terms
- Resend retention/DPA explanation: https://resend.com/security/gdpr
- Resend DPA: https://resend.com/legal/dpa
- GitHub Pages visitor logging: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub Pages usage restrictions: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- jsDelivr privacy source: https://github.com/jsdelivr/jsdelivr/blob/master/Privacy%20Policy.md
- jsDelivr subprocessors: https://github.com/jsdelivr/jsdelivr/blob/master/Sub-Processors.md
- Squarespace forwarding: https://support.squarespace.com/hc/en-us/articles/19000909092237-Email-forwarding-with-a-Squarespace-domain

Keep screenshots, signatures, personal inbox addresses, account identifiers, credentials and provider agreements out of this public repository. Record private operational evidence separately.
