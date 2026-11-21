# Fairy Bucks — provider review and COPPA consent gate
**Status: review worksheet; pending verification.** Do not add account numbers, credentials, personal family records or provider contracts containing confidential terms to this public repository.

| Provider | Observed or documented purpose | Child-data relevance to verify | Needed evidence |
| --- | --- | --- | --- |
| GitHub Pages | Serves public site and child vault, collects web-request/IP metadata | Direct child-facing page requests, host logs | Applicable terms and security assurances; IP/log use, subprocessor and retention review |
| Supabase | Parent authentication, child profiles, wallet/requests, permissions, child-session storage | Stores family/child records and operational logs | DPA/terms, access/security assurance, subprocessor usage, retention and backup configuration |
| Resend | Parent notices, verification, confirmation and other transactional email | Parent address and notice content may include described child-data categories | Terms/security assurance, email content handling, retention and telemetry settings |
| jsDelivr | Supabase authentication library on parent pages | Confirm it is not loaded in child mode; verify browser/CDN identifiers and log use | CDN privacy/terms and actual page-resource inventory |
| Squarespace forwarding and Google/Gmail | Routes and stores support email | Parents could supply child information in support cases | Forwarding and inbox terms/security assurance, support retention and deletion procedure |

## Operator decisions before real families
- [ ] Confirm all third-party scripts, subresources and network requests on child-facing pages, including redirects/CDNs.
- [ ] Record written security assurances and acceptable terms for every relevant provider.
- [ ] Determine whether processing is solely for support of internal operations and whether any separate parental consent would be required.
- [ ] Confirm security, logs, email tracking and backup-retention settings from provider accounts, not just default descriptions.
- [ ] Confirm support case tracking, retention/deletion, and the 12-month inactivity review workflow are operational.
- [ ] Have a qualified COPPA reviewer validate the emailed-link consent method, the direct/public notices, service-provider classifications and the resulting launch plan.
- [ ] After those checks, approve a separate release PR and server-side permission switch; run a controlled family pilot before wider enrollment.

**Legal basis:** 16 CFR §§ 312.2, 312.4, 312.5, 312.8 and 312.10 (2026). A successful private test of delivery, account permissions or consent recording does not by itself establish legal compliance.
