# Final privacy/permission review — November 21, 2026

Result: factual review completed; activation remains pending. This is a source/configuration review, not legal certification. No release flag, secret, notice hash or permission record was changed.

## Confirmed evidence

| Area | Finding |
| --- | --- |
| Operator contact | ITS Security, support email, phone and mailing address are configured centrally. Configuration is not evidence of business registration. |
| Family data | Notice describes parent authentication, explorer details, balances, teeth, transactions, requests, stages and child-session identifiers. Requests/cancellations are linked to explorers. No child email credentials, public profile, chat or photo upload is present in the reviewed flow. |
| Review/deletion | Parent Portal is the main review route. The owner dismissed dedicated export/download handling; general verified support remains for information unavailable in the portal. Explorer deletion is PIN-confirmed and owner-tested, and account deletion remains available. Do not treat this as an audit proving every provider record is displayed. |
| Direct-notice parity | Version 2 local fingerprint is `8fa04272d6a167c5e4e3bc46b8a2f6aac033e85204a3d9f63b186776c9580de2`, matching the database. Browser and Edge Function embed the same notice/contact snapshot; existing tests enforce parity. |
| Permission boundary | Email request is not approval. Explicit approval is bound to the same signed-in parent and token. Separate confirmation submission precedes verified access. Owner previously reported live approval, withdrawal, blocked child access and reapproval. Rehearsal permission is not production permission. |
| Retention | Scheduled cleanup succeeded at 2026-11-21 03:17 UTC. Latest-success aggregate and cron run agree; all eligible deletion counts were zero. Installed inactivity/support tools are distinct from manual warning/case/deletion operations. Corrected stale public wording accordingly. |
| Support | Incoming alias and Gmail reply tested by owner; public reply-address explanation and two-business-day response target live. Signature set. |
| Recovery | Free plan has no project backups. Owner explicitly deferred backup/recovery work for cost. Do not claim a backup or tested restore exists. |
| Release | Browser privacy/permission flags remain false. Database notice_ready, enforcement_enabled and email_method_reviewed remain false. Secret values were not inspected. |

## Activation issue: email confirmation timing

The Edge Function calls its confirmation sender immediately when approval changes status to confirming. A status refresh may retry that same job. It has no durable delayed confirmation sender.

FTC staff's email-plus FAQ describes sending a confirmation after a reasonable time delay, including the original notice and withdrawal instructions. The current confirmation includes the notice and withdrawal instructions, but its timing does not follow that recommendation. The revised Rule lists a confirmation following consent without specifying a numeric delay. Do not present a particular number of hours as an FTC-prescribed deadline or silently treat the FAQ wording as the Rule itself.

Before activation, resolve the method review. A conservative implementation would schedule the confirmation after a documented delay, keep child access blocked until confirmation submission succeeds, and provide durable retries plus withdrawal/account-deletion cancellation. A delay cannot be achieved merely by changing page copy or asking the parent to refresh later. This review does not implement or activate a sender.

## Provider/method assessment

The Rule's definition of disclosure excludes provision to a person supporting internal operations. Therefore, merely using a database or email host does not automatically disqualify email-plus. Conversely, calling every provider an internal service does not establish eligibility: actual purposes, terms and unrelated uses matter.

Reviewed public sources include Supabase's DPA (incorporated into its agreement), Resend's DPA (incorporated on agreement acceptance), GitHub's privacy statement and the jsDelivr policy entry point. These are evidence sources, not a finding that every account-specific arrangement or every processor's handling satisfies COPPA. The jsDelivr policy body did not render in the web reader; no conclusion about its full terms is drawn from that result. No raw parent data or credentials were sent to providers for this review.

Before enabling email-plus, record the actual applicable provider/security terms, service purposes and responsible review conclusion in restricted operator records. Include hosting/security requests on child pages and incoming support forwarding/Gmail, not only the database. Provider-written security assurances can be supplied by applicable contracts/terms; do not assume a new paid service or a separate custom letter is automatically necessary. Forwarding retention remains disclosed without an invented numeric deadline; do not reopen the resolved retention investigation merely to repeat it.

## Operator adoption still needed

The repository contains security and retention procedures, but documents alone do not perform them. Confirm the responsible operator, restricted support-case/due-date records, monthly inactivity review, permission-mail bounce/failure monitoring and annual security review. Keep family identifiers and filled cases out of public GitHub. The owner's existing MFA setup and response-target approval are recorded; they do not by themselves establish all of these ongoing tasks.

Resolve existing development child data before invitations with an explicit scoped decision; no deletion is performed here. Keep backup recovery listed as deferred in the pilot decision. After method/provider/operations decisions, prepare a separately reviewed cutover and run the final phone journey on the actual release settings. Do not use the retired version-1 activation script.

## Sources checked

- [FTC COPPA FAQ, especially email-plus and parental access](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [2026 CFR Part 312, including disclosure, consent, security and retention](https://www.govinfo.gov/content/pkg/CFR-2026-title16-vol1/xhtml/CFR-2026-title16-vol1-part312.html)
- [FTC six-step compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business)
- [Supabase DPA](https://supabase.com/legal/customer-resources/data-processing-addendum)
- [Resend DPA](https://resend.com/legal/dpa)
- [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
- [jsDelivr policy entry point](https://www.jsdelivr.com/terms/privacy-policy)
