# Privacy notice v5 — evidence, readiness and remaining gates (November 24, 2026)

**Staged evidence review only. DO NOT merge, deploy, run the migration, change a notice hash, or enable public child enrollment without explicit owner approval and coordinated verification.**

## Review performed and documentation obtained

- **Netlify is the current host**, per connected Netlify project `fairybucks-com` (`fairybucks.com` listed as primary site, latest published deploy ready). Earlier PR #71 references to an upcoming GitHub Pages-to-Netlify DNS migration were outdated; verify actual HTTPS/domain routing before release. No DNS action is proposed.
- **Netlify DPA dated Nov 13, 2026, supplied by operator through Gmail.** DPA intro says it forms part of its self-serve or Enterprise subscription agreement. §§1.6 and 1.24 classify personal data in end-user CDN/access/function request logs as **Customer Data**, outside the independent `Service Data` category. §3.3 permits internal service analytics of Service Data within contract restrictions, and §4.1(b) prohibits using Customer Data for Netlify marketing/advertising or unrelated independent commercial purposes. Exhibit I includes visitor IP and browser/request metadata. Exhibit II specifies online 30 days / archive up to 13 months for CDN logs, online 90 days / offline one year for general platform logs, and online 365 days / archive up to six years for security/abuse logs. §12 generally deletes Customer Data within 90 days after service termination but excludes logs/backups from that deadline while they follow their own schedules.
- **Netlify subprocessor PDF dated Nov 24, 2026**, 26 entries, reviewed. List contains hosting, analytics, observability, AI and security vendors; it does not attribute each child request to a vendor or establish any such data-sharing pathway. Avoid claiming that the inclusion of an AI/analytics vendor means a child request was transmitted to it.
- **Resend response dated Nov 23, 2026:** 30-day standard sent-email/log retention, 7-day backup rotation, open/click tracking off by default, support-assisted individual message deletion by email ID, no customer content training, and no workflow-specific subprocessor mapping. Account-domain tracking must still be verified directly.
- **Supabase Nov 23, 2026** response confirms its current DPA is incorporated into self-serve Terms; specific Auth/PostgREST/Edge visitor IP/log persistence and child-session identifier processing were not answered.
- **Child-facing source/network audit PR #80:** local page resources and direct POST to Supabase child-action RPC; no *identified* third-party advertising SDK/pixel in inspected Child Mode code. Browser HAR/runtime and SDK supply-chain audit are still unverified.
- **FTC legal requirements (official COPPA amended rule, 16 CFR §312.4 and §312.5):** actual data collection, usage, disclosure, retention and contact terms must be represented accurately. Email-plus consent is conditional on absence of certain disclosures and additional identity-assurance steps. Neither a DPA nor successful technical regression alone proves method eligibility. Get a qualified COPPA review before activation.

## Changes staged in v5 notice PR

- Correct `privacy.html` from old GitHub Pages host to **current Netlify host**, keep GitHub identified as version-control provider only.
- Make direct child-to-Supabase RPC processing and technical identifiers explicit.
- Describe Netlify's contractual classification and longer log retention, with clear caution that which visitor identifiers appear in particular archived categories is not yet confirmed.
- List provider roles, subprocessors limitations, local browser session storage, parent deletion rights, account deletion caveats, and Resend default-versus-confirmed tracking status.
- Preserve parent-facing v5 direct notice, all three matching Edge Function notice snapshots, strict fingerprinted SQL migration, and the `siteContact` public permission/review flags in the **OFF** state. Existing v4 consent is not automatically treated as v5 permission.
- Add static regression for key disclosures, contact details and fail-closed flags.

## Go/no-go checklist — deliberately not marked complete

- [x] Netlify DPA and subprocessor list obtained and summarized.
- [x] Technical notice content and hosting discrepancy prepared in draft for review.
- [x] Browser code network audit completed (static inspection only).
- [ ] Runtime browser Network/HAR audit of landing, parent signin, permission, child entry and exit, with synthetic identities and sanitized exports.
- [ ] Confirm actual Netlify host HTTPS certificate/routing and any Netlify Web Analytics or optional tracking settings in the account.
- [ ] Confirm jsDelivr version pinning / integrity plan and enforce CSP only after browser rehearsal.
- [ ] Verify Resend domain open/click tracking is disabled.
- [ ] Record Supabase log/metadata use, retention/deletion, subprocessor treatment; assess residual uncertainty if no specific answer is possible.
- [ ] Verify provider security assurances against FTC requirements, and obtain COPPA-specific review of whether **email-plus** is appropriate for the implemented data flows.
- [ ] Adopt and operationalize the written security program, incident response, support/deletion tracking and Supabase backup/restore plan.
- [ ] Owner reviews exact text, accepts/disposes of residual gaps, and explicitly approves coordinated v5 cutover; update `siteContact.privacyNoticeReviewed` only after final review, not in this draft.
- [ ] Coordinated v5 Edge Function, Netlify deployment and Supabase migration; reapprove the existing private test parent under v5, verify consent withdrawal, family isolation and session handoff, and keep public enrollment disabled until separately approved.

## Deployment warning

The Netlify-hosting replacement is part of a **versioned parent notice**; editing only `privacy.html` and merging independently could create inconsistencies between browser notice, emailed notice and database fingerprint. PR #80 is a separate audit PR, not the v5 publication package. Both remain drafts until review. No website or production database change was made by this evidence checkpoint.
