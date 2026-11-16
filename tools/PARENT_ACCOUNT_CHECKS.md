# Launch checklist item 1 — parent accounts

Status: implementation and local verification complete for this change; real new-account email walkthrough pending after deployment. Do not mark item 1 fully complete yet.

## Changes

- Added Resend confirmation beside signup/login/reset password. Uses Supabase's signup-resend API with the same /auth.html redirect and neutral feedback for unknown/already-confirmed addresses.
- Explicitly handles implicit token pairs, PKCE codes and token-hash callbacks once. Uses the session returned by that callback; a saved parent session cannot turn an expired callback into a successful reset or confirmation.
- Rejects explicit email-link errors, incomplete token pairs and type-only links before opening recovery controls. Removes callback values from the URL after handling.
- Preserves PIN recovery routing; reads the SDK's recovery redirect type when available. Other valid callbacks without a recovery purpose return to the parent portal instead of offering an unsolicited password change.
- Prevents duplicate pending form submissions, clears the signup password after a signup response and handles an immediately signed-in signup response without falsely claiming an email is required.

## Verified November 16, 2026

| Check | Evidence | Result |
| --- | --- | --- |
| Live auth settings | Read-only /auth/v1/settings using the existing public publishable configuration | Email sign-in enabled, signup enabled, email autoconfirm disabled; no setting changed |
| Signup/resend/reset API wiring | Automated UI harness with synthetic values | Expected email type/redirect; generic resend/reset feedback; recoverable errors |
| Wrong credentials, sign-in/out | Automated UI harness | Error stays signed out; successful response opens parent flow; sign-out hides family UI |
| Password mismatch | Automated UI harness | No password update request |
| Valid confirmation/recovery/invitation/PIN callbacks | Synthetic callback/session harness | Expected destination and one callback handler |
| Invalid/expired callbacks with an older saved session or child token | Synthetic callback/session harness | No password/PIN/parent vault access from the failed callback; retry message shown |
| Resend and expired-link UI | Local browser with mocked auth provider, no production requests | Correct form, neutral success feedback, expired-link retry state |
| Existing regression suite | npm test --prefix tests | Passed |

Local harnesses verify application behavior; they do not prove live email delivery, token verification or a password change. Earlier test-account password/PIN recovery checks are useful prior evidence but do not replace the fresh walkthrough on the deployed revision.

## Real walkthrough to finish item 1

1. Merge/deploy this PR, then create a distinct parent test account using an inbox controlled by the operator. If using a Gmail plus alias, confirm delivery to the same inbox; no separate paid mailbox is required for the test. The operator chooses and enters the new password privately.
2. Verify a fresh unconfirmed account cannot sign in before email confirmation. Confirm the email reaches the inbox or spam folder, points to fairybucks.com and opens the correct parent welcome screen.
3. Exercise resend confirmation, repeated signup and already-confirmed behavior without disclosing whether an unrelated address has an account. Observe server rate-limit feedback rather than sending many emails.
4. Sign out, sign back in, reload and open a second tab. Verify account separation and expected sign-out behavior across tabs.
5. Request a reset email. The operator completes new-password entry/submission. Verify the old password fails and the new password works; reused/expired links do not reopen a password form through an older session.
6. Set and recover the test Parent PIN with operator entry. Verify incorrect/expired recovery attempts stay blocked and resetting the PIN does not change the password.
7. Repeat the email-return journey in phone Safari/Chrome. Revisit redirect allowlist, email templates and expiry settings in Supabase if any step fails.

No production account was created, password changed, email sent or PIN reset during this implementation pass. No SQL migration or consent activation is needed for this frontend change. Keep real credentials, email-link tokens and account identifiers out of this public document.

## Operator feedback after PR #34

The operator reported the fresh signup/confirmation/resend/welcome walkthrough worked, and password reset rejected the old password while accepting the new password. PIN recovery was also reported working, but first-PIN creation was discoverable only through an explorer vault and the header reset action failed on a no-PIN/no-family account. The independent-PIN setup follow-up addresses that gap; repeat its live check after rollout before closing item 1. These are operator-reported results, not a claim that this implementation pass independently changed credentials.
