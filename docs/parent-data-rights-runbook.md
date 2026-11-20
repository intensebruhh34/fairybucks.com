# Parent review, correction and deletion

## Current approach — November 20, 2026

The owner chose the existing Parent Portal as the main review route and dismissed
the dedicated family-data download/export workflow. No download button or
mandatory export-delivery/email-challenge rehearsal is part of the product plan.
The public help page directs parents to their records and general support,
rather than advertising an export service.

This changes the interface and procedure, not parents' ability to ask to review
information. Do not assume everything collected is visible merely because the
main vault records are displayed. A parent who cannot find information or access
their account can contact support. Arrange appropriate verified access for the
actual request without imposing the retired standard email-code exchange.

The FTC's parental-access guidance calls for a means of review. It does not
specify a download button. This document does not certify that the present portal
covers every record/provider or independently establishes legal compliance.

## Portal actions

- Review explorer details, balances, tooth history, transactions and treasure
  requests in the family's own authenticated portal.
- Correct nickname and optional details with Edit explorer; undo mistaken tooth
  entries in Parent controls.
- Choose Delete explorer on the exact card. The warning names the target and
  explains permanent removal. A fresh six-digit Parent PIN and typed DELETE are
  required. Missing PIN setup must be completed first.
- Explorer deletion removes that explorer's active profile, wallet, teeth,
  transactions, wishlist, requests/delivery history and child sessions. Parent
  unlocks are cleared. The parent login, sibling explorers and account-level
  settings/permission history remain.
- Whole-account deletion uses Delete account and family data, recent sign-in,
  Parent PIN if configured and typed confirmation.
- Permission withdrawal ends child access when enforcement applies; it does not
  erase the parent's existing records.

PR #57 was merged, the deletion migration was installed, and the hosted rollback
check passed. The owner reported successful deletion of one explorer and
cancellation of a second deletion. Do not claim a wrong-PIN manual test from
that report; wrong PIN and lockout are covered by automated/hosted checks.

## Help when portal review is insufficient

Answer ordinary navigation questions by directing the parent to the relevant
portal screen. If they are locked out, use the existing password/PIN recovery
flows. Never request passwords, PINs or sign-in links by email.

For a request involving information unavailable in the portal, establish the
actual scope and arrange review only after reasonable account-ownership
verification. An incoming From address, nickname or screenshot alone is not
proof. Successful portal sign-in proves access within that session; it does not
automatically authenticate a separate unsolicited support email. If ownership
cannot be verified, pause disclosure and help with account recovery.

Record only a minimal private case reference, scope and outcome. Do not put
parent identifiers, support messages or exported records in public GitHub.
Existing operator SQL tools remain restricted implementation tools, not a
promised download feature or an automatic response to every support message.
Do not create or email an export unless an actual verified request requires
that delivery method and the parent agrees to it.

## Exceptional operator deletion

Prefer the parent's PIN-confirmed portal action. If verified support assistance
requires operator deletion, obtain explicit confirmation of the exact explorer,
resolve duplicate nicknames using the account/profile IDs and use the scoped
operator template. Never widen ownership filters or add CASCADE to force a
failed deletion. An unknown restrictive dependency must roll back.

Verify selected records/sessions are gone and parent/sibling records remain.
A lost response requires inspection before retrying. Explain that deletion of
active records does not cancel retailer purchases or instantly erase provider
logs/backups, previous support messages or copies on the parent's device.

## Validation and limits

Existing SQL tests cover scoped operator access, secret exclusion, exact deletion
confirmation and family isolation. The new RPC/UI tests also cover fresh PIN,
throttling, changed names, stale sessions, uncertain responses and sibling
preservation. The old challenge/export-delivery rehearsal is retired; no claim
is made that a real export was delivered.

Keep support available for exceptional access requests. Step 9 does not require
building a download feature, and removing that feature does not remove the need
to respond appropriately to an actual parental-access request.

Reference: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
