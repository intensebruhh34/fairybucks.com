# Child-mode protection (step 5)

## Fix

A delayed active-vault response could render after another response closed the session. Child mode now marks the page closed and invalidates pending views before clearing content. Missing or replaced tokens are checked before requests and again before accepting replies. A replaced token is preserved for a fresh page; old replies cannot show the previous explorer. Private content is cleared even if browser storage throws.

No database migration, permission flag or session lifetime changes are included.

## Validation performed

The isolated JavaScript tests ran against the actual child-vault module body with synthetic DOM, fetch and storage objects. The previous source failed with "Late active view reopened an expired vault"; the updated source passed. Cases cover expired/permission closure, late replies, missing/replaced tokens, failure to clear browser storage, duplicate request clicks and anonymous scoped request headers.

The new Node test file runs the same harness using the repository source. The full Node/PGlite suite, new SQL and a real browser test could not run in this session because its executor and browser were unavailable. This is not a completed penetration test or a guarantee that every security issue has been found.

## Database verification

Run supabase/checks/child_mode_readiness.sql as one separate Supabase SQL Editor query. Expect PASS before merging. It uses random disposable users/explorers/requests inside a rollback transaction; no existing test email is required. It supports both older development databases without consent tables and newer installations with them. Synthetic permission fixtures and temporary notice readiness roll back; enforcement is never enabled.

Checks:
- Parent handoff needs a valid PIN unlock and correct family; it consumes the unlock.
- The child token has the expected format, stored hash and roughly one-hour lifetime.
- The child payload shows only its explorer and excludes purchase details and parent account fields.
- Child actions cannot cancel sibling/other-family requests or approve requests.
- Anonymous child access cannot call parent purchase, reward, correction, edit, approval, refund or handoff functions, or read private session/purchase tables.
- Missing, malformed and unknown tokens fail.
- A second handoff replaces the first token.
- Expired/replaced tokens cannot view, request or cancel.
- Ending a session is repeat-safe and removes access.

These are scoped API and sequential lifecycle checks; they are not simultaneous-transaction concurrency tests.

## Live phone check after publishing

1. Open a test explorer and unlock Parent controls. Select Hand Over the Magic.
2. Confirm only that explorer's balance, tooth count and requests appear; no sibling selector or purchase details.
3. Try Back/Return to parent sign-in. Parent controls must require signing in again.
4. Reopen child mode and confirm requesting/cancelling a pending treasure still works.
5. Confirm returning via browser Back does not reveal the previous parent page's controls.

The SQL check verifies expiry directly without waiting an hour. Browser expiry behavior and restored pages still need a real-device check. Step 5 remains pending until the SQL and live checks pass.
