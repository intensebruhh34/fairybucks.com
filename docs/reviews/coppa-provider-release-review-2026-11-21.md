# COPPA provider and release decision log — working review (November 21, 2026)

**Status: NOT CLEARED FOR PUBLIC INVITATIONS.** This is source review and a list of decisions to make; it is not a legal opinion or independent audit. Never store actual parent names, emails, case details, secret keys, child nicknames, tokens, or consent logs in this public GitHub repository.

## Rule requirements checked

- The 2026 [COPPA Rule, 16 CFR 312.5(b)(2)(viii)](https://www.govinfo.gov/content/pkg/CFR-2026-title16-vol1/xhtml/CFR-2026-title16-vol1-part312.html) permits email with additional verification steps **only if the operator does not "disclose" children's personal information**, as that term is defined by the Rule. Follow-up confirmation and clear withdrawal notice are required. Operator reports real notice, emailed-link approval, and confirmation; the last live rehearsal succeeded, but **technical delivery success is not a legal eligibility determination**.
- [16 CFR 312.2](https://www.govinfo.gov/content/pkg/CFR-2026-title16-vol1/xhtml/CFR-2026-title16-vol1-part312.html) excludes genuine **support for internal operations** providers from certain disclosures only when the data is not used/disclosed for unrelated purposes. Check actual practices, not just the service's name.
- [16 CFR 312.8](https://www.govinfo.gov/content/pkg/CFR-2026-title16-vol1/xhtml/CFR-2026-title16-vol1-part312.html) requires written information-security safeguards, operator responsibility, annual risk reviews, monitoring, and **written assurances** from providers allowed to collect or maintain children's information. Standard contractual DPA/security assurances may contribute; adoption and applicability must be established for the operator's actual account.
- [16 CFR 312.10](https://www.govinfo.gov/content/pkg/CFR-2026-title16-vol1/xhtml/CFR-2026-title16-vol1-part312.html) requires a written retention policy and deletion schedule.

## Public vendor evidence — not account-specific certification

| Provider | Product use | Public materials found | Decision still required |
| --- | --- | --- | --- |
| GitHub Pages | Current static host; may see child-page IP/security logs | [Pages commercial-hosting limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | Move commercial production hosting; retain GitHub only as source control. |
| Netlify | Proposed commercial static host; would receive browser requests | [Commercial use permitted](https://www.netlify.com/platform/), [DPA](https://www.netlify.com/pdf/netlify-dpa.pdf/), [privacy](https://www.netlify.com/privacy/) | Confirm actual self-serve agreement, logs/data use, subprocessors, security assurances, and treatment of child-facing page requests. Change privacy and versioned notice before DNS. |
| Supabase | Parent Auth; family database; child actions | [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), [subprocessors](https://supabase.com/legal/customer-resources/subprocessor-list) | Confirm current account terms and appropriate written security assurances, controls, permitted use, and subprocessors. |
| Resend | Parent emails and consent confirmation | [DPA](https://resend.com/legal/dpa), [subprocessors](https://resend.com/legal/subprocessors), [security](https://resend.com/security) | Confirm agreement applies, recipient/message retention and delivery-failure monitoring. |
| jsDelivr | Supplies Supabase JavaScript on parent pages | [Privacy policy](https://www.jsdelivr.com/terms/privacy-policy), [subprocessors](https://github.com/jsdelivr/jsdelivr/blob/master/Sub-Processors.md) | Confirm which pages contact the CDN and whether IP/analytics use is solely qualifying internal operations. Consider self-hosting dependency to reduce exposure; not yet implemented. |
| Squarespace forwarding | Support mailbox forwarding | Squarespace privacy/account terms | Confirm operator terms and whether child identifiers are sent via support. Don't promise a forwarding-provider purge window. |
| Gmail | Receives and answers forwarded parent support | [Google privacy policy](https://policies.google.com/privacy) | Confirm use restricted to support workflow and adopt minimum-data and case handling procedures. |

## Actual operator decisions still necessary

- Record a documented suitability determination for **email-plus** given all providers' access and data uses; seek specialist counsel or qualified safe-harbor guidance where needed. If ineligible, replace with a qualifying stronger parental-consent method *before* activating public child mode.
- Adopt the written security program, designate responsible operator(s), record annual risk review and vendor security assurances privately, and institute permission-mail bounce handling and support/deletion/inactivity case tracking.
- Review existing test child data before allowing new public families; decide treatment explicitly without automatically deleting records.
- Acknowledge the Supabase Free plan's absent project backups and untested restore as a **residual continuity/data-loss risk**. Reconsider before storing live family records rather than calling this fully cleared.
- Confirm the new host's contract/usage rights and ensure the revised direct notice and privacy page match the deployed service and notice hash.
- Only after all decisions: prepare a separately reviewed privacy/launch activation, verify the no-consent/withdrawal/expired-token fail-closed behavior and final mobile flow, and retain server enforcement during rollback. Public launch flags remain disabled now.
