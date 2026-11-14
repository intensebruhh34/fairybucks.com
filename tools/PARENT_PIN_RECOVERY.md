# Parent PIN recovery rollout

## Deploy in this order

1. Run `supabase/migrations/20261114230000_parent_pin_recovery.sql` in Supabase SQL Editor. This adds a private consumed-proof table and an authenticated recovery RPC. It does not reset any PIN during installation.
2. In a separate query, run `supabase/checks/parent_pin_recovery.sql`. Both existing test parents must have confirmed emails and Family Vaults. The test temporarily replaces their PINs and adds fixtures, then rolls everything back. Do not remove the final rollback.
3. Merge the PR and allow GitHub Pages to update.
4. On a test parent account, choose **Forgot Parent PIN?** in Parent controls (also available as **Reset Parent PIN** in the portal). Request an email, open its newest sign-in link, choose and confirm a new PIN, then unlock the vault using it.
5. Confirm the old PIN no longer unlocks, balances/history/requests are unchanged, existing child vault sessions expire, and a new Hand Over the Magic works. Try replaying the same link/reset and confirm a fresh email is required.

## Email configuration

Uses the existing Supabase URL/SMTP configuration and the already-used `https://fairybucks.com/auth.html` redirect. No new Edge Function, service key, query-string redirect allowlist entry or email provider is needed. The **Magic Link** email template must contain `{{ .ConfirmationURL }}` so the parent receives a clickable link, rather than a code-only template. The default Supabase template does this. Verify the template and real email delivery before declaring recovery ready for pilot families. The email can have a generic sign-in subject; the portal explains that this link verifies the parent email for PIN recovery. Account password reset keeps its existing separate flow.

## Security and behavior

- `signInWithOtp` uses `shouldCreateUser: false` and the verified signed-in parent's email; there is no user-entered destination and no account creation.
- The database checks an extant matching auth session, family ownership, confirmed current email matching the signed claim, the email provider and Supabase-signed AMR (`otp` or `magiclink`) no older than ten minutes. A fresh password sign-in or editable user_metadata is insufficient.
- Each email proof timestamp can reset that parent's PIN once, across sessions. PIN-row locking serializes resets with normal unlocks. Expected-parent checking rejects account changes during the screen flow.
- The replacement PIN is bcrypt hashed. Lockout counters are cleared. Existing parent unlocks and that family's child session tokens are revoked atomically. Other signed-in parent sessions remain signed in but must unlock with the new PIN.
- This is not MFA and does not protect against someone who controls the parent's mailbox or already holds a freshly email-verified session. Parents should keep mailbox access private.
- A network failure after Save never claims success: the parent is told to try the new PIN or obtain another email link. No browser flags grant recovery authority.
- Authenticated email callbacks clear a leftover local child-session token after session verification. Normal child handoff routing and password/invitation/signup screens are covered by callback tests.

## Validation

Full local suite uses PGlite with a modeled Supabase schema and confirms proof age/method, metadata spoof rejection, consumed-proof replay, invalid PIN, wrong/missing sessions, expected-parent mismatch, anonymous/direct-table denial, lockout recovery, old/new PIN behavior, old unlock invalidation, family isolation, unchanged balances and child session revocation. Browser-module tests cover sending, confirmation mismatch, expiry, stale responses, account changes and uncertain saves. Callback tests cover implicit, token-hash and PKCE paths plus existing account flows. A local browser preview with mocked authentication displayed the reset form with the actual portal styling. No real email was sent, and no production PIN was changed during implementation; a live email round trip remains a release check.

Primary API references:
- https://supabase.com/docs/reference/javascript/auth-signinwithotp
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/guides/auth/jwt-fields
