# Conditional activation package (NOT approved to merge or run)

**Updated 2026-11-25:** PR #71 is merged. Privacy notice v5 is published on Netlify, three corresponding Edge Functions are deployed, and the v5 fingerprint is installed in Supabase. This PR should target `main` for its separate operator-only activation checklist. It is **not** itself a production release.

## Prepared and deliberately disabled

- `supabase/operators/check_v5_activation_readiness.sql`: read-only query for the release row after the coordinated v5 migration. The expected result before approval is `V5_STAGED_FAIL_CLOSED`. It has now been run read-only against the deployed v5 release row and returned `V5_STAGED_FAIL_CLOSED` on November 25, 2026.
- `supabase/operators/activation_template_v5_DO_NOT_RUN.sql`: **not executable for release as checked in**. It contains a mandatory exception and ends with `rollback`; both intentionally prevent activation. It documents transactional preconditions and which release fields would eventually require an explicit legal/operator authorization.
- Public `site-contact.js` flags remain FALSE. Edge Function public email permission switches must remain FALSE; do not switch them from this draft.
- Existing `tests/launch-staging-preflight.mjs` must stay passing while staged and must be revised in a *separate approved public activation PR* to assert the appropriate production configuration.

## Actual launch sequence only after all independent gates

1. Receive and review Netlify, Supabase and Resend factual provider answers (plus other browser-facing providers); record written security assurances and data-use limitations privately.
2. Confirm eligible parental-consent method with qualified COPPA counsel/safe harbor based on real request identifiers and disclosures. If email-plus is ineligible, do not activate; build and test an acceptable method instead.
3. Adopt dated operator security, deletion, incident, data-access, retention and email bounce monitoring procedures; resolve residual backup risk decision and existing test records.
4. **Technical v5 cutover completed November 25:** PR #71 merged, Netlify published version 5, three Edge Function notice snapshots deployed and v5 SQL fingerprint installed. Netlify production deployment was ready, and the operator confirmed the privacy page identifies Netlify. **Fresh v5 consent verification remains pending**; prior v4 approval cannot be reused.
5. Run read-only v5 check, existing CI and full two-parent browser journey: signed-out/anonymous, mismatched accounts, denied/withdrawn/expired/replayed tokens, permission approval and delayed confirmation, PIN, request and wallet isolation, child-only Fairy Bucks, support and deletion.
6. Create **a separate FINAL LIVE ACTIVATION PR** with website permission flags ON and production-specific CI assertions, reviewed against actual consent enforcement. Never deploy just one of website, Edge switches or DB release states in isolation.
7. In a supervised change window, require separate explicit approval for the final activation SQL, with all safeguards validated, and coordinate server enrollment enforcement and mail delivery before site availability. Log final go/no-go without family identifiers.
8. If anything fails, **stop new enrollment and revoke affected sessions**; do not disable server consent enforcement as a rollback.

## No accidental publish

The template's `raise exception` plus `rollback` protect against accidental execution. It requires a separate human-reviewed change before actual execution. Merging this draft alone would not enable public child enrollment, but **do not merge it now** while provider/legal decisions and controlled v5 approval/revocation tests remain open.

## Where to review

- PR #71: Netlify and v5 notice deployed (merged)
- PR #72: provider/security program documentation merged; private adoption and legal assurance unresolved
- PR #73: security audit draft
- PR #75: staging readiness tests (merged)

No vendor communication or legal review is represented as complete by this document.


## November 25 staging decision and delayed backup risk

Read-only release check returned `V5_STAGED_FAIL_CLOSED`: notice v5, expected hash, `notice_ready=false`, `email_method_reviewed=false`, `enforcement_enabled=false`. The website `site-contact.js` retains `privacyNoticeReviewed=false` and `parentPermissionEnabled=false`. No activation is authorized by this PR.

The operator selected Supabase Free and deferred a full backup/restore program until after launch. **This is an accepted schedule preference, not evidence of recoverability.** Any real-family data collection without a tested backup carries potentially irreversible loss risk; document the decision privately and consider a minimal encrypted export before accepting real records. Do not describe a future backup as already implemented.

**Pilot versus release:** The currently disabled gates intentionally prevent real child-mode handoff. A controlled test using fictional profiles, legally appropriate permission, and verified mail flow must precede enrollment activation; enabling switches is not itself a test of verifiable parental permission. Avoid public exposure simply on the assumption that no one knows the URL.


## Operator launch push — November 27, 2026 (technical preparation, not compliance certification)

The operator requested proceeding with all technical launch preparation and monitoring rather than purchasing certification. This is **not a factual determination that email-plus is eligible**. Keep the existing enforcement and public-enrollment switches closed until documented consent-method suitability and technical acceptance evidence are in place. An operator's willingness to accept business risk does not itself satisfy a required verifiable-parental-consent method.

### Hands-on acceptance script (fictional families only)

- [ ] On a clean browser, create two distinct parent test accounts, verify emails, and confirm unapproved explorers cannot enter Child Mode or create treasure requests.
- [ ] For test parent A, review the exact v5 notice, check the separate request acknowledgment, receive the unique link, sign in to the same account and explicitly approve; confirm the requested email alone did not approve.
- [ ] Confirm mismatched parent B, anonymous visitors, expired/replayed links and denied links cannot approve A's permission; old v4 consent does not grant v5 access.
- [ ] Verify the separate delayed confirmation email preserves the original v5 notice and withdrawal instructions; simulate delivery-failure or overdue-confirmation handling without opening child access.
- [ ] Approve test A, hand over Child Mode, request and cancel a treasure, check Fairy Bucks balance/tooth history, and confirm the child never sees real dollars, retailer links or payment information.
- [ ] Withdraw A's approval while a child token is active: existing session must stop; repeat after logout, browser refresh and token expiry; ensure B remains isolated.
- [ ] Exercise support contact, PIN, account deletion and denial of cross-family records; inspect browser network requests in actual Child Mode to close the earlier HAR gap.
- [ ] Record pass/fail, browser/device, exact test time and sanitized observations privately. Do not put tokens, emails or explorer identifiers in the public repository.

### Minimal ongoing oversight after any authorized release

- **Each day during pilot:** check transactional-email failures, parent requests/withdrawals and unexplained permission failures; stop new enrollment if consent cannot be confirmed.
- **Each week:** review security/authorization alerts, released dependencies and provider notices; spot-check access controls and consent-gate errors.
- **Monthly:** review COPPA/FTC guidance for material changes, public privacy text versus real data flows, and documented data-retention/deletion tasks.
- **Every material feature or provider change:** repeat child network inventory and consent/disclosure review *before* merging the change, since new tracking, third-party scripts or identifiers may change email-plus eligibility.
- **Quarterly:** rehearse incident response and account/data deletion with synthetic records; revisit deferred recovery risk. This schedule does not replace legal duties or assure compliance.

### Technical release boundary

PR #76 contains no live release mechanism. Even if its documentation-only changes are merged in future, it **cannot** turn enrollment on. A separate reviewed release PR and separate authorization for server-side release SQL remain necessary. Never bypass server consent checks or replace the deliberately failing SQL template with an unreviewed commit.
