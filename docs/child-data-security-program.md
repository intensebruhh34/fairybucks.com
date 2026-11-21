# Fairy Bucks — children's information security program
**Status: draft for operator review, adoption and documented evidence; not a claim of COPPA compliance.**

This program is intended to support the requirements of 16 CFR § 312.8 and applies to the Fairy Bucks website, child sessions, parent accounts, support operations, data stores and service providers. The operator must designate a responsible person, actually perform the tasks below and record dated evidence.

## Accountability
- **Designated security coordinator:** [Operator to designate a responsible individual and date of adoption]
- **Scope:** Child profile nicknames, optional age/gender, tooth records, balances and requests, temporary child identifiers, browser/network logs, parent accounts and support messages
- **Review:** Upon material product or provider change, after security incidents, and **at least annually**
- **Evidence:** Keep a dated risk register, test summary, provider-assurance records, incident log and approval history somewhere access-controlled; do not put children’s data or secrets in GitHub

## Risk assessment and safeguards
| Area | Expected safeguard | What must be checked and documented |
| --- | --- | --- |
| Identity and parent consent | Verified parent email, affirmative permission via emailed link, versioned notice, revoke and delete controls | Private rehearsal, rejection without approval, expiration, notice version mismatch, withdraw and rerun |
| Family isolation | Row-level security and owner checks on privileged endpoints | Negative cross-family access tests, review all new tables and RPCs |
| Child access | Short-lived opaque tokens, hashed server storage, restricted actions and permission rechecks | Invalid/expired/cross-child tokens; unauthorized request and cancellation attempts |
| Sensitive parent operations | Authentication, recent sessions where required, parent PIN, throttling | Wrong PIN, replay attempts, session expiry, owner mismatch |
| App/database integrity | Controlled schema migrations, test suite, pull request approval | CI results and live smoke tests after deployments; no direct unapproved changes |
| Credentials | Server-side keys only; least privilege; protected access to provider dashboards | Audit who has access and revoke stale credentials, no secrets in public site or repository |
| Data retention | Published purpose-specific schedule; account/explorer deletion; scheduled cleanup; operator follow-up | Review cleanup jobs, proof of deletion, 12-month inactivity process and 90-day support cleanup |
| Shared devices | Local sign-out before child handoff; expiry and token cleanup | Handoff and return-to-parent tests |
| Logs and backups | Minimum necessary data, provider retention settings, restricted access | Verify actual provider settings and deletion/backup procedures; document unresolved gaps |

## Monitoring and incident response
- Review access control after material migrations, authentication changes and data-flow changes.
- Monitor email delivery failures, permission failures, database security advisories, scheduled cleanup and support reports.
- For a suspected exposure, restrict affected access, preserve minimal appropriate evidence, assess affected data and services, remediate, and record cause and measures taken; obtain applicable breach-notification guidance as needed.
- Re-test mitigations before reopening an affected feature and review security safeguards at least annually.

## Provider due diligence (required before public enrollment)
For each provider that collects or maintains children's personal information on the operator's behalf, document:
1. Exactly what data it receives, including IP/device identifiers and whether a child can reach its service directly.
2. Processing purposes and whether data is used or disclosed for any non-internal purpose.
3. Security capabilities and **written security assurances** (e.g., applicable contractual terms/DPA); record the source, effective version/date and review decision.
4. Retention, access, subprocessor, international transfer and deletion/incident reporting terms where relevant.
5. Whether the provider counts as an internal-operations support provider for the specific use; if not, determine required separate notice/consent with qualified counsel.

## Data retention
The **Privacy page** is the public-facing data-retention statement. Do not claim all its operator-assisted processes are automated: temporary database cleanup is scheduled, while support inbox housekeeping, inactivity warnings and eventual account removals require recorded operator action. Verify provider backup/log settings before public enrollment.

## Launch sign-off (operator to complete)
- [ ] Security coordinator designated and dated
- [ ] Current risk assessment completed and evidence retained
- [ ] Negative authorization tests completed; findings tracked and resolved
- [ ] Provider inventory, security assurances and data-use classification reviewed
- [ ] Privacy and retention policy checked against actual operations
- [ ] Consent method suitability reviewed for this data flow
- [ ] Incident response and deletion responsibilities accepted
- [ ] Public enrollment release explicitly approved; no automatic flag change through this document

*This is a working operational document, not attorney certification, an external penetration test, or proof that provider assurances have been obtained.*
