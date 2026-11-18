# Step 7: privacy notice accuracy pass

Reviewed against main after PR #44. This is a content/source review, not a
certification of legal compliance or permission to invite families.

| Notice topic | Source evidence | Result |
| --- | --- | --- |
| Operator and parent contact | `site-contact.js` | Approved ITS Security contact details retained. |
| Parent and explorer records | `auth.html`, profile/wallet modules, database migrations | Parent-supplied nicknames, optional fields, teeth, wallet and requests described. |
| Child activity | `child-session.js`, child-mode/request migrations | Added request/cancellation collection and explorer association. |
| Parent purchases | Protected purchase details and catalog URLs | Added retailer visit disclosure; no explorer payload in purchase URLs; no card/address collection in current forms. |
| Permission | `parent-notice.js`, email function and permission migration | Staged status retained. Removed obsolete paper-signature instructions from Parent Help. Notice snapshot/version unchanged. |
| Storage | `child-session.js`, wallet/request modules, auth sign-out | Distinguished token expiry from browser-storage deletion and noted tab-scoped retry state. |
| Parent rights | Profile editor and account deletion modules | Distinguished portal actions from support-assisted copy/child-deletion requests. No export or individual-deletion button promised. |
| Retention | Expiry checks and account deletion migration | Proposed pilot/support cleanup clearly distinguished from current behavior. No scheduled cleanup represented as installed. |

## Primary documentation checked November 18, 2026

- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions): policy topics and parent access/refusal/deletion procedures. This review does not determine whether the staged consent method satisfies all requirements.
- [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection): visitor IP logging for security.
- [Resend GDPR/retention](https://resend.com/security/gdpr): standard email/log retention and backup period. Provider-published terms are not project-specific configuration evidence.
- [Supabase backups](https://supabase.com/docs/guides/platform/backups) and [Free-plan backup FAQ](https://supabase.com/kb/faqs/platform/free-plan-backups): automatic daily backups are a paid-plan feature. No unsupported fixed purge deadline added.
- [jsDelivr privacy](https://www.jsdelivr.com/terms/privacy-policy): CDN requests expose network/usage data.

## Remaining work, in the original checklist order

- Step 8: live permission approval/refusal/withdrawal and blocked-child-access rehearsal; review actual provider arrangements before enabling.
- Step 9: verify the support-assisted copy, correction and individual-child deletion procedures; current UI only has whole-account deletion.
- Step 10: implement the proposed cleanup schedule; confirm actual Supabase and Resend plans/settings, forwarding provider, Gmail retention, email tracking, backups and logs. Resolve remaining policy wording against that evidence.
- Steps 11–13: security/support operations and final launch review.

The privacy notice remains visibly a draft. `privacyNoticeReviewed`,
`parentPermissionEnabled`, database release settings and email permission secrets
are not changed. No SQL or function deployment is required for this PR.
