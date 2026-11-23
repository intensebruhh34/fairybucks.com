# Conditional activation package (NOT approved to merge or run)

**Dependency:** This branch starts from draft PR #71 (Netlify notice v5), not from `main`. Its PR must target the #71 branch for review. It cannot be a production release by itself.

## Prepared and deliberately disabled

- `supabase/operators/check_v5_activation_readiness.sql`: read-only query for the release row after the coordinated v5 migration. The expected result before approval is `V5_STAGED_FAIL_CLOSED`. Do not run it until v5 is deployed and the database migration is applied.
- `supabase/operators/activation_template_v5_DO_NOT_RUN.sql`: **not executable for release as checked in**. It contains a mandatory exception and ends with `rollback`; both intentionally prevent activation. It documents transactional preconditions and which release fields would eventually require an explicit legal/operator authorization.
- Public `site-contact.js` flags remain FALSE. Edge Function public email permission switches must remain FALSE; do not switch them from this draft.
- Existing `tests/launch-staging-preflight.mjs` must stay passing while staged and must be revised in a *separate approved public activation PR* to assert the appropriate production configuration.

## Actual launch sequence only after all independent gates

1. Receive and review Netlify, Supabase and Resend factual provider answers (plus other browser-facing providers); record written security assurances and data-use limitations privately.
2. Confirm eligible parental-consent method with qualified COPPA counsel/safe harbor based on real request identifiers and disclosures. If email-plus is ineligible, do not activate; build and test an acceptable method instead.
3. Adopt dated operator security, deletion, incident, data-access, retention and email bounce monitoring procedures; resolve residual backup risk decision and existing test records.
4. User reviews and approves PR #71 migration; coordinate three Supabase Edge Function notice snapshots, v5 SQL fingerprint, hosting HTTPS, DNS and fresh reconsent.
5. Run read-only v5 check, existing CI and full two-parent browser journey: signed-out/anonymous, mismatched accounts, denied/withdrawn/expired/replayed tokens, permission approval and delayed confirmation, PIN, request and wallet isolation, child-only Fairy Bucks, support and deletion.
6. Create **a separate FINAL LIVE ACTIVATION PR** with website permission flags ON and production-specific CI assertions, reviewed against actual consent enforcement. Never deploy just one of website, Edge switches or DB release states in isolation.
7. In a supervised change window, require separate explicit approval for the final activation SQL, with all safeguards validated, and coordinate server enrollment enforcement and mail delivery before site availability. Log final go/no-go without family identifiers.
8. If anything fails, **stop new enrollment and revoke affected sessions**; do not disable server consent enforcement as a rollback.

## No accidental publish

The template's `raise exception` plus `rollback` protect against accidental execution. It requires a separate human-reviewed change before actual execution. Merging this draft alone would not enable public child enrollment, but **do not merge it now** while PR #71 and provider/legal decisions remain open.

## Where to review

- PR #71: Netlify and v5 notice staged
- PR #72: provider/security program draft
- PR #73: security audit draft
- PR #75: staging readiness tests (merged)

No vendor communication or legal review is represented as complete by this document.
