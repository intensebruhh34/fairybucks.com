# Pilot launch review — November 20, 2026

This is the current checkpoint for the original 13-step plan. It supersedes older task-status summaries, not the evidence limits of individual tests. Preparing this review does not enable permission enforcement, approve the privacy notice or invite families.

## Original checklist

| Step | Current checkpoint | Remaining work |
| --- | --- | --- |
| 1. Parent accounts | Owner reports signup/recovery flows working; password reset passed again after the current security settings were shown. | Final new-parent journey at cutover. |
| 2. Explorer profiles | Previously passed and owner-tested. | Final smoke test; use dummy data. |
| 3. Fairy Bucks and teeth | Previously passed and owner-tested. | Final smoke test of reward, correction and balances. |
| 4. Treasures and requests | Previously passed and owner-tested. | Final request, approval, cancellation and delivery smoke test; child view contains Fairy Bucks only. |
| 5. Parent guidance | Welcome/FAQ/printing previously owner-tested. | Check current links and copy in final journey. |
| 6. Usability | Owner reports the phone flow looks and works well. | Final phone journey on the release configuration. |
| 7. Privacy notice | Draft remains visible; subsequent retention and support changes recorded. | Final accuracy and method/provider review; synchronize any material direct-notice changes before activation. |
| 8. Parent permission | Automated checks passed; owner reported real approval, withdrawal, blocked child access and reapproval during the account-scoped rehearsal. | Treat this as owner-reported rehearsal evidence, not a fresh browser audit or method-eligibility determination. Rehearsal approval must not silently become production permission. |
| 9. Parent data requests | Parked by owner. Existing support-assisted copy and individual-explorer deletion tools/links remain. | Resolve before invitations: validate a usable secure process or deliver a replacement. Removing an awkward email-code rehearsal does not remove parents' access/deletion needs. Do not send private data or delete records based on a nickname alone. |
| 10. Retention | Cleanup installed, manual run passed; inactivity/warning/deletion tools installed and verified. | First successful scheduled run; adopt restricted support/inactivity case records and due-date handling. No further forwarding-provider investigation requested from owner: disclose provider limitations without guessed deadlines. |
| 11. Security and recovery | Maintenance grants restricted and hosted check passed; owner reports two-factor setup for Supabase, GitHub, Resend, Gmail and Squarespace. Auth settings and reset flow reviewed below. | Backup/restore work explicitly deferred for cost by owner; recovery remains untested. Recovery-code storage, access roster and scoped containment rehearsal are not established by the MFA confirmations alone. |
| 12. Support | Receiving and replying owner-tested; signature set. Gmail reply-address note and two-business-day response target merged and verified live. | Operator must monitor the inbox and track unresolved cases/retention deadlines. Confirm bounce/non-delivery monitoring for permission mail before activation. |
| 13. Final release | This review is in progress. | Resolve outstanding items, make an explicit pilot decision, prepare a separate coordinated activation PR/operator action, then run final checks. |

## Settings and evidence reviewed today

- Owner screenshots show email authentication enabled, secure email/password changes enabled, current-password requirement enabled, 12-character minimum with uppercase/lowercase/digit/symbol requirements, email links enabled, 3,600-second expiry and eight-digit OTPs. Owner then successfully reset the password. Screenshots and owner reports are not an independent Management API audit of saved settings.
- Owner screenshot shows Site URL `https://fairybucks.com` and one exact allowed redirect, `https://fairybucks.com/auth.html`.
- Rate-limit screenshots show 30 Auth emails/hour/project, 60 seconds between emails per user, 30 verification requests per five minutes/IP, and 150 token requests per five minutes/IP. The token endpoint covers password login as well as refresh and other grants; the separate 30-request signup/sign-in-labelled setting is not a complete password-login limit description.
- Free-plan leaked-password protection is unavailable in the displayed settings. No paid upgrade was authorized.
- Owner's Backups screenshot explicitly reports that Free does not include project backups. Normal database persistence continues; GitHub code history is not a backup of family records. Owner elects to defer backup setup and upgrading. Do not imply encrypted backups or a tested restore exist.
- Hosted PR #53 check returned `PASS maintenance grants restricted; automatic RLS still works`. The maintenance-helper advisor findings disappeared. Expected privileged application APIs and the Free-plan password-protection limitation still require their documented interpretation; this is not a clean security certification.
- Support address is `support@fairybucks.com`; Squarespace forwards to `Fairybucks9@gmail.com`. Owner confirmed replies use that Gmail address, signature is set, and a two-business-day reply target is manageable. Live support-page checks after PRs #54 and #55 found the reply-address notice and response target.

## Read-only release inspection

Database inspection during this review found notice version 2, `notice_ready=false`, `enforcement_enabled=false`, and `email_method_reviewed=false`. The named cleanup job is active on `17 3 * * *`, with no scheduled-run history yet. The first scheduled checkpoint is November 20 at 10:17 p.m. Eastern (November 21 at 03:17 UTC). A manual run does not prove scheduler success.

Repository website flags remain `privacyNoticeReviewed=false` and `parentPermissionEnabled=false`. Earlier operator reports say both permission function enable secrets were returned to false after rehearsal; this review does not read secret values. Reconfirm deployment state at cutover without exposing secrets.

## Next work in order

1. After the scheduled time, inspect this job's run history and latest-success row; investigate failure rather than reinstalling or counting another manual run as scheduled evidence.
2. Revisit parked step 9 with the owner. Keep support available while selecting and validating a safe, usable data-request process. Do not quietly remove rights from the notice or mark this complete from a code merge.
3. Complete the final notice/method/provider accuracy review and owner adoption of the practical support/retention/security procedures. Record responsible operators, private case references and deadlines outside this public repository. Do not reopen resolved forwarding-retention questions or invent a fixed provider purge period.
4. Review the deferred recovery risk explicitly in the pilot decision. It remains unresolved even if other checks pass; a future paid upgrade must still be verified and restore-tested. No real family dump or new backup is authorized by this review.
5. Decide how to handle existing development child data before family invitations. Do not delete it automatically or treat later permission as retroactive evidence for earlier collection.
6. Prepare the reviewed email-permission cutover as a separate change. Verify exact notice version/hash and deployed function source, browser flags, server readiness/enforcement and private enable settings together. Do not use the retired version-1 paper-consent activation script. No raw secret or parent evidence belongs in the PR.
7. Run the final parent/child phone journey and check approval, non-approval, withdrawal, account separation, support and deletion against the actual release. Define rollback before enabling: retain server permission enforcement and end affected child sessions while fixing a failure; never return launched families to permissive development mode.

No launch date or compliance certification is established here. Completed product tests, deferred recovery and unfinished parent-rights/release work must remain distinguishable.
