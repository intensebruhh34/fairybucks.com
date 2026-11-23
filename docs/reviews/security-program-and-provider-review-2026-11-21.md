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


## 7. Provider review request — ready for operator to send, not yet sent
**Scope for all replies:** Fairybucks is a US family-focused service where a parent authenticates, records explorer nicknames and optional ages/gender, and shares a parent-approved one-hour child session with a child. Hosting requests can contain device information, IP addresses and persistent identifiers. Child-facing mode has no ad trackers, public profile, chat or uploads. We are assessing FTC COPPA Rule 16 CFR 312.5(b)(2)(viii), 312.2, and 312.8, not asking providers to issue an unconditional "COPPA compliant" label. Do not send actual child identifiers, tokens or customer account details via public channels.

### Netlify support / trust or privacy team
- Does the current **self-serve** subscription agreement incorporate the November 2026 DPA for our specific account, without additional signature, including logs of requests made by site end users? We saw the published DPA references self-serve and request logs; please confirm specific scope and any qualifications.
- In static-site/edge delivery, which IP addresses, headers, cookies, session IDs or other persistent identifiers are collected from visits to `child.html`; for what purpose, retention and subprocessors? Any unrelated product analytics, cross-site tracking, marketing or advertising use of those end-user identifiers?
- Can we disable unnecessary logs/analytics, restrict retention, or obtain written security assurances covering visitor identifiers and child-facing traffic? Are there product/account settings we should enable?
- Are public deploy previews accessible without approval, and can they be disabled or protected to keep child sessions from staging/unreviewed builds?
- Please identify any material exception for services marketed toward families/children under US law.

**Published reference:** https://www.netlify.com/pdf/netlify-dpa.pdf/ (PDF describes self-serve DPA and end-user request logs as Customer Data); separate actual agreement and account settings still to verify.

### Supabase support / security
- For Free-tier Auth, Postgres, RPC, Edge Functions and logs: what personal data, client IP/persistent identifiers, retention, subprocessors and secondary uses occur on child-session API requests? Confirm whether the current customer DPA applies to the Free-tier account.
- Is child-linked vault information processed solely to deliver and secure customer services, with no independent advertising/profiling? Are formal written security assurances, audit evidence and relevant subprocessor contractual commitments available?
- Which logs/backups survive child deletion, and what deletion/retention limits apply? Which Free-tier recovery features actually exist and how should the operator limit risks while formally deferring backups?

**Published reference:** https://supabase.com/legal/customer-resources/data-processing-addendum (August 1, 2026 version says DPA supplements Terms of Service), and current subprocessors page.

### Resend support / privacy
- Does the 2025 Resend DPA attach automatically on acceptance of its Terms for our existing self-serve account? Are parent verification/permission/confirmation email addresses and contents used only for delivery/security, or are any message data or identifiers used for unrelated analytics, AI training, targeting or advertising?
- Which email delivery logs, event history, recipient information and message contents are retained, for how long, and which subprocessors have access? The current November 2026 subprocessor list includes AI-related vendors; please distinguish **possible** subprocessors from **actual processing** of our transactional email data.
- Which bounced/failed confirmation event controls and retention/deletion options can we use on our account?

**Published references:** https://resend.com/legal/dpa and https://resend.com/legal/subprocessors (the names on that list alone do not establish that a particular child's data reaches every listed company).

### Legal consent-method reviewer (separate from vendor support)
- Determine if the actual collection, hosting/CDN/network logs, Auth/database APIs, email delivery, support workflow, and any persistent identifier use constitute a 'disclosure' under §312.2, rather than qualifying internal-operations processing; confirm if the current email-plus method meets §312.5(b)(2)(viii).
- If not appropriate, specify an accepted verifiable parental-consent alternative and what changes to direct notice, flows and evidence are required before opening public child mode.
- Review the current v4 notice and staged v5 Netlify notice only with *sanitized* screenshots and architecture, not real parent or child data.

**Official reference:** https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.5, including subsection (b)(2)(viii). This source requires no 'disclosure' under its defined meaning for email-plus, and separate confirmation and revocation notice.

### Operator follow-up tracking — do not check until real evidence is retained privately
- [ ] Netlify reply/account terms reviewed, privacy scope and preview settings documented privately
- [ ] Supabase DPA/account terms and child request metadata processing verified privately
- [ ] Resend actual data use, retention/bounce monitoring confirmed privately
- [ ] jsDelivr, Squarespace/Mailgun forwarding and Gmail risk review completed
- [ ] Qualified email-plus suitability determination recorded
- [ ] Separate v5 hosting cutover decision approved, still with public enrollment **off**

**Current decision:** Even after all vendor responses, do not switch public consent flags on without a qualified interpretation of the facts and a separately owner-approved launch change.


## 8. Direct source review: child-facing external-resource inventory (November 23, 2026)

Reviewed **current `main` source**, not an actual browser network capture. This is a source-code assessment only; CSS imports, redirects, third-party infrastructure, Edge Functions and network-layer headers require additional verification.

| Entry | Observed direct source references | Scope / action |
| --- | --- | --- |
| `child.html` | Local `/auth-config.js`, local module `/child-vault.js`, local `/vault-theme.css`, and a link to the same-site privacy page; **no direct third-party script URL in the HTML** | Encouraging reduction in child-browser third-party JavaScript; inspect complete network traffic in browser before final clearance. |
| `child-vault.js` | Local import `/treasure-catalog.js`; client connects to the configured Supabase endpoint using browser `fetch` | Child-session API calls still expose request metadata to Supabase; provider review remains necessary. |
| `auth.html` | Dynamic module import from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm` | **Third-party jsDelivr request on parent sign-in/setup page**. Parent device IP and request metadata may reach CDN; dependency version is major-version-wide rather than an exact pinned release. Consider independently tested self-hosting and exact-version pinning in a separate reviewed PR. Do not make this change as a quick untested prelaunch switch. |
| `auth-config.js` | Public Supabase project URL and publishable key | Intended public client configuration, **not a service-role secret**. Verify network destinations and authentication headers; never expose credentials in public source. |
| `privacy.html` | Lists GitHub Pages as current host, and Resend, Supabase, jsDelivr, Squarespace forwarding and Gmail | Correct for present GitHub hosting; **must coordinate with staged Netlify notice v5** in PR #71. Do not merge host-language changes independently from DNS notice/consent cutover. |

**Read-only configuration check:** `site-contact.js` on `main` still has `privacyNoticeReviewed: false` and `parentPermissionEnabled: false`. The live Supabase privacy-release row was separately verified on November 23 with `notice_version=4`, `notice_ready=false`, `enforcement_enabled=false`, `email_method_reviewed=false`. The Netlify project reports a ready deploy; these facts **do not** authorize public permission enrollment.

**Decision:** Keep provider and legal review open, plan a browser Network-tab capture for both child and parent entry flows, and treat minimizing jsDelivr exposure as a **separate testable hardening opportunity**, not as a prerequisite that is already complete.
