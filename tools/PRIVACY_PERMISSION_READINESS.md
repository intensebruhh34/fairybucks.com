# Privacy and parent permission — step 6

Email permission replaces the proposed paper-form workflow. It remains staged, not a claim of legal compliance or launch readiness.

## Current implementation

- Parent-only accounts, private family vaults, PIN protections and scoped child sessions.
- Review/edit/delete controls and consent withdrawal.
- Notice version 2 shared by the portal, approval page and server email snapshot.
- A separately enabled Edge Function verifies the signed-in parent with Supabase Auth; a service-only RPC also checks the active session.
- Explicit approval through the emailed link; merely opening it does not approve.
- Separate confirmation email, durable retry jobs and provider acceptance references. Provider acceptance is not proof of inbox delivery.
- No ordinary browser role can verify permission or read the private mail tables.
- Link tokens expire after seven days and are stored only as hashes. Requests are limited across withdrawals/restarts.
- Website flags remain false. The database migration preserves enforcement=false, sets the revised notice to draft and leaves email_method_reviewed=false. The Edge Function also defaults to disabled.

## Remaining evidence before activation

| Area | Completion needed |
| --- | --- |
| Method eligibility | Confirm actual provider arrangements support the email-plus method under current COPPA definitions; ordinary hosting/auth service providers are not automatically disqualifying |
| Notice | Review the complete version 2 direct notice and privacy text against actual practices |
| Deployment | Apply the new migration, deploy the Edge Function and set private secrets; merging code alone does none of this |
| Delivery | Rehearse notice, explicit approval, separate confirmation, failed/retried mail, refusal and withdrawal with operator-controlled test accounts |
| Provider records | Confirm actual Supabase plan/region/logs/backups, GitHub hosting/security processing, Resend settings, jsDelivr and support forwarding/Gmail paths |
| Email settings | Confirm no-reply@fairybucks.com can send through Resend; disable open/click tracking for permission emails; confirm support replies and bounce handling |
| Retention | Implement/rehearse the purpose-based cleanup schedule, including expired requests, jobs, logs, old support messages and provider copies |
| Operations | Record security coordinator, safeguards, monitoring, incident response, provider assurances and parent copy/deletion handling |
| Existing test data | Decide whether to remove development child data before pilot invitations; consent obtained later does not retroactively authorize earlier collection |
| Cutover | Coordinate reviewed notice/hash, database flags, function enablement and website flags; do not mark ready from SQL PASS alone |

See [EMAIL_PARENT_PERMISSION.md](EMAIL_PARENT_PERMISSION.md) for the exact deployment and rehearsal steps. Steps 1–5's reported product checks do not establish completion of this privacy workstream.

## Sources

- FTC compliance plan: https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- Amended Rule, including 312.2 and 312.5(b)(2)(viii): https://www.govinfo.gov/content/pkg/FR-2025-04-22/html/2025-05904.htm
- Supabase processing terms: https://supabase.com/legal/customer-resources/data-processing-addendum

Keep operational evidence, private parent information and all secrets out of this public repository.
