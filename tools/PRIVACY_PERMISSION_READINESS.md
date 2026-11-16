# Privacy and parent-permission readiness — step 6

Reviewed November 16, 2026. This is an implementation and operations draft, not a legal-compliance certification. Existing development access remains enabled by the current staging flags.

## What is already built

- Public privacy/support links and approved ITS Security contact details.
- Parent-controlled accounts, private family vaults, hashed PINs and scoped child sessions.
- A versioned parent notice and signed-form workflow staged behind release flags.
- Privileged consent verification; a checkbox/request does not grant verified permission.
- Consent withdrawal ends child sessions; parent review and account deletion remain available.
- Account deletion removes active family/auth data; provider logs, backups and emailed forms need their own handling.

The operator installed the consent foundation on November 16, 2026, reported parent_consent.sql passed, and supplied a follow-up report showing the consent components INSTALLED. Website access remains STAGED. This verifies installation and the reported rollback check; it does not complete notice delivery or the provider/retention/security review.

## This PR

- Reject permission status replies that do not identify the current parent (except setup_pending, which never grants permission).
- Pause the UI permission result while a request is refreshed/withdrawn and clear previously printable consent content. Failed or late replies cannot preserve it.
- Correct the support page to point parents to Edit explorer.
- Disclose the support forwarding/Gmail path already described by the operator; the forwarding provider and retention settings remain unconfirmed.
- Add a read-only database report. It changes no records or flags and returns no family data or credentials.
- Preserve privacyNoticeReviewed=false, parentPermissionEnabled=false, the existing notice content/version/hash, and server enforcement defaults.

## Evidence still needed before pilot activation

| Area | Current evidence | Required completion |
| --- | --- | --- |
| Database foundation | Operator reported migration/check passed and report shows INSTALLED on November 16, 2026 | Installation verified; maintain staged settings until the remaining reviews and rehearsal are complete |
| Notice delivery | Notice renders in the portal; no delivered-email record was found in the reviewed flow | Establish a direct-notice delivery and recordkeeping process before child data collection; a signup confirmation alone is not that notice |
| Signed consent | Form/verifier are built; synthetic DB check reported passed; portal rehearsal paperwork added | Follow PARENT_NOTICE_REHEARSAL.md for email, printing, return, matching and cleanup; live process remains staged |
| Email forwarding | Operator says support forwards to Gmail | Confirm the actual forwarding service, mailbox access and retention/trash/attachment handling |
| Provider records | Supabase, GitHub Pages, Resend, jsDelivr and support email paths identified | Record actual project plans, regions where relevant, log/backup periods, deletion limits and provider safeguards; do not infer settings from defaults |
| Retention | Public draft proposes pilot/form/support periods | Adopt and implement a purpose-based schedule, including inactive accounts and uncompleted permission requests; verify deletion beyond the active DB |
| Security operations | Access-control tests and parent-only functions exist | Name a coordinator, document risks/safeguards, test/monitor them, record incident handling and review dates; complete provider due diligence |
| Parent rights | Review/edit/delete UI and support contact exist | Rehearse a copy request, verified identity, safe delivery, refusal/withdrawal and mailbox/form cleanup |
| Cutover | Development remains usable | Confirm notice and contact hash match the DB, send direct notices, verify returned permissions, then coordinate server and website activation |

Never put names, form scans, email addresses, account IDs, provider credentials or private security details into this public repository. Keep operational evidence in restricted storage. This file records the process and unresolved work only.

## Practical low-cost signed-form process

1. Finalize the notice and real data-handling procedures before invitations.
2. Deliver the reviewed direct notice from the support address to the parent's registered email before child data is collected. For a small pilot this can be a manual process; record the version, delivery date/result and internal reference privately. Do not claim automated delivery exists.
3. Include the operator contact, intended data/use/service-provider disclosures, privacy link, consent/refusal instructions and applicable uncompleted-request deletion period. Have the final text/process reviewed against current requirements.
4. Match the returned signed form to the requesting parent, correct account, current notice/version/hash and affirmative guardian statement. Request only what is needed; no child photo, government ID, passwords, PINs or sign-in links.
5. Restrict attachment storage and mailbox access. Record a private evidence reference, not the form itself, in the database. Call only the operator verification function after review.
6. Confirm access, then rehearse withdrawal. Make sure existing child tokens stop working and parent review/deletion remain available.
7. Track deletion deadlines for active data, forms, mailbox copies/attachments/trash and provider copies; record completion and any specific justified exception. Existing public-draft periods are not an automatic cleanup job.
8. Re-notify/re-consent for applicable material changes. Updating contact/notice fields can change the hash; plan the release together.

Do not activate based only on a PASS result. Passing SQL does not establish direct notice delivery, appropriate retention, completed provider review or operational security.

## Sources checked

- FTC COPPA compliance FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions (it notes the 2025 amendments; use the revised Rule for current details).
- Final amended Rule: https://www.govinfo.gov/content/pkg/FR-2025-04-22/html/2025-05904.htm
- Written information security program: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.8
- Written retention/deletion policy: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.10

These support planning; the final applicability/process review must assess the actual service and provider practices.

## Validation limits and next action

Isolated JavaScript tests reproduced acceptance of a mismatched-parent reply in the previous UI and passed with the change. They also check refresh/withdrawal, printable-form clearing, late replies and preserved development staging. The full Node/PGlite suite and a browser test were not run in that session because the executor/browser were unavailable. The operator subsequently ran the read-only report and supplied INSTALLED results.

The report findings have been resolved through the reported installation/check. Complete the paperwork rehearsal in PARENT_NOTICE_REHEARSAL.md; a successful rehearsal is not a reason to turn on restrictions immediately. Step 6 remains open until installation, notices, provider/retention/security procedures and the permission rehearsal are complete.
