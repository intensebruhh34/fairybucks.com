# Fairybucks — written information-security and provider review (operator adoption draft)
**Prepared:** 2026-11-21. **Status:** NOT ADOPTED / NOT LEGALLY CLEARED / NOT A PUBLIC-RELEASE AUTHORIZATION.

This draft describes concrete obligations for ITS Security to review, fill in privately, implement, and adopt before inviting real families. Its existence in GitHub does not demonstrate operational compliance. Do **not** put real parent emails, child names, logs, accounts, tokens, private contracts or security recovery details in this public repository.

## 1. Scope and ownership
- Scope: Fairybucks child-facing pages and child sessions; parent authentication/PIN; explorer nicknames and optional age/gender; teeth, rewards, balances, requests and fulfillment; email notices; support messages; hosting/CDN/security logs.
- Operator responsible for security oversight: **unassigned pending operator's explicit adoption**. Record designated accountable person, adoption date, access roster and next annual review **privately**.
- The owner of this program must perform and record initial and at-least-annual risk assessments, test controls regularly, and update safeguards after incidents or substantial changes.

## 2. Risk assessment and safeguards
| Risk | Existing/observed control | Further action required |
| --- | --- | --- |
| Child record exposed to another family | Supabase RLS and private API tests; scoped child session | Confirm privileged API authorization and perform final cross-account and revoked-token browser tests |
| Unauthorized parent access | Supabase Auth and 6-digit parent PIN on protected actions; reported MFA for operator services | Verify administrative MFA/recovery-code handling, least privilege and shared-device sign-out; maintain private access roster |
| Access without valid guardian permission | Notice/version/hash checks, unique email link, verified parent login, separate guardian approval and delayed confirmation, server deny by default | Independent email-plus suitability review; validate v5 approval, refusal, withdrawal and expiry in actual cutover |
| Over-collection | Child has no login, public profile, chat or upload; optional age/gender; nicknames encouraged | Assess whether optional gender/age are necessary; verify all child page requests and third-party script/network activity |
| Unnecessary provider transfer | No advertising analytics indicated in current site; contract sources identified | Perform vendor-by-vendor internal-operations and written-assurance assessment (below) |
| Lost or corrupted vault data | No project backup on Supabase Free according to prior operator check | **Open high-impact risk**: decide budget/plan and document a tested restricted export+restore process before live storage; do not claim recoverability |
| Incident / credential compromise | Some technical safeguards exist | Adopt detection, incident log, containment, credential rotation, breach assessment, required notifications and recovery owner; run an exercise |
| Excess retention | Published privacy schedule and automatic scheduled jobs | Verify schedules, support/deletion case tracker, access requests and provider log/backups; document exceptions |
| DNS/hosting cutover | Netlify staging tested; DNS identified; consent upgrade draft PR #71 | Secure HTTPS; verify Auth callbacks and v5 fingerprints; avoid unreviewed public activation; restore DNS from saved values if needed |

## 3. Operational procedures for operator adoption
1. **Daily when pilot/public service is active:** check support inbox and Resend delivery-failure/bounce status; investigate unresolved cases and failed background jobs. Never forward child records to third parties by default.
2. **Weekly:** review security advisories, failed tasks, unauthorized-login signals and dependency updates; record noteworthy findings privately without family identifiers in public tickets.
3. **On every PR/release:** require owner review; check that child-facing pages display **Fairy Bucks only**, no prices/merchant sourcing; run permission, cross-family RLS, token expiry, account recovery and child handoff checks; verify production never exposes credentials or service-role keys.
4. **On a parent data request:** authenticate the requesting parent, scope the request to their family, provide review/correction/access/deletion and record case progress privately; do not accept a nickname alone as proof of ownership.
5. **On suspected breach:** restrict access/rotate affected secrets, preserve minimum necessary evidence safely, investigate scope, consult qualified incident/legal adviser about notifications, inform provider as required, document remediation privately. Do not publish sensitive forensic details.
6. **On withdrawal/deletion:** immediately block child access on withdrawal; execute permitted family deletion and track known provider retention limitations and deadlines; never claim all external logs/backups vanish immediately.
7. **At least annually and after material changes:** perform documented risk reassessment, provider suitability review, written security-program evaluation and retention-policy review.

## 4. Vendor assurances and consent-method applicability — NOT COMPLETE
The provider's public privacy statement is not by itself evidence of an account-specific commitment or proof that a COPPA email-plus method qualifies. Operator must record privately which terms bind their account, the scope of processed child data or persistent identifiers, processing purpose, written security assurances, subcontractors, retention and deletion limits. Obtain qualified review of each provider's treatment under the FTC definition of disclosure and 'support for internal operations' before approving email-plus.

| Provider | Data likely handled | Available source and preliminary finding | Unresolved decision |
| --- | --- | --- | --- |
| **Netlify** | IP/browser requests and security/hosting logs on child pages; static assets | [DPA](https://www.netlify.com/pdf/netlify-dpa.pdf/), [subprocessors](https://www.netlify.com/legal/subprocessors/), [trust center](https://www.netlify.com/trust-center/). Published DPA describes limited-use processor commitments and safeguards. | Verify actual self-serve applicability to this account and **logs**; written assurance scope; child persistent identifiers and internal-operations classification. |
| **Supabase** | Parent Auth, child-linked vault records, token hashes, metadata/logs | [2026 DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), [subprocessors](https://supabase.com/legal/customer-resources/subprocessor-list). DPA covers processor role, security and restrictions. | Verify account coverage, service-specific network/log data, secret/backup handling, vendor assurances. |
| **Resend** | Parent email, permission notice, confirmation, provider message references | [DPA](https://resend.com/legal/dpa), [security](https://resend.com/security), [subprocessors](https://resend.com/legal/subprocessors). | Confirm account applicability, retention, bounce monitoring, secure messaging and no child information in emails. |
| **jsDelivr** | Browser requests on parent pages for authentication script | [Privacy](https://www.jsdelivr.com/terms/privacy-policy). | Determine actual page exposure and logs/persistent identifier use; consider self-hosting the JS bundle to reduce providers. |
| **Squarespace email forwarding + Mailgun** | Forwarded incoming support messages, routing data | Operator's existing provider and DNS setup; public provider contracts to review. | Verify support-only purpose, written assurances and retention/forwarding handling; prohibit unnecessary child details in tickets. |
| **Google Gmail** | Operator support inbox | [Google privacy](https://policies.google.com/privacy). | Verify suitable service terms for support data, access controls, retention and response procedures. |
| **GitHub** | Source code and CI after migration; old Pages host until DNS completes | [GitHub privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). | Verify no child records or secrets in repository/issues/build artifacts; discontinue public hosting once Netlify is active. |

## 5. Legal determination requiring qualified review
**Email-plus is not a generic parental-consent substitute.** Under 16 CFR 312.5(b)(2)(viii), use of email plus additional measures is conditional on the operator not 'disclosing' children's personal information as defined by §312.2. Technical delivery was tested; actual provider data-processing eligibility is not yet determined. If the conditions do not apply, do not activate public child mode using this approach; substitute a method that meets the Rule and retest.

- Official [2026 COPPA Rule](https://www.govinfo.gov/content/pkg/CFR-2026-title16-vol1/xhtml/CFR-2026-title16-vol1-part312.html), especially §§312.2, 312.4, 312.5, 312.6, 312.8 and 312.10.
- [FTC COPPA compliance guidance](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business).

## 6. Release decision record — leave unapproved until independently satisfied
- [ ] Operator personally reviews/adopts the security program and designates accountable role, dated privately.
- [ ] A real initial risk assessment, vulnerability/authorization review and documented controls have been performed.
- [ ] Each in-scope vendor's written security assurances reviewed, retained privately, and internal-operations/disclosure implications determined.
- [ ] Qualified review confirms current **email-plus** method is suitable for this exact data flow, or the method is replaced.
- [ ] Written retention/data-access/deletion procedures and case logs are operationally adopted and tested.
- [ ] Data-recovery limitation knowingly resolved or mitigation tested; don't infer backups from a Git repository.
- [ ] Netlify v5 cutover PR #71 coordinated with consent back end and DNS; first test parent's reapproval validated.
- [ ] Final technical and mobile tests passed with no-consent/withdrawn/expired-token access denied.
- [ ] Separate owner authorization for public invitation flags after all preceding requirements have evidence.

**No box is checked by creating this document.** Keep public `parentPermissionEnabled`, `privacyNoticeReviewed`, and live `enforcement_enabled` disabled pending full approval.
