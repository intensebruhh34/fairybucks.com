# Parent welcome guide and FAQ

1. Run `migrations/20261114190000_parent_welcome_guide.sql` in Supabase SQL Editor.
2. Run `checks/parent_welcome_guide.sql` in a separate query. It uses the two existing test parents and rolls back all fixtures, including temporary completion records and a session. Sign into the first test account beforehand if requested.
3. After PASS, review and merge. On the next confirmed sign-in each parent, including existing pilot accounts, sees the guide once. Continue saves completion in a private server table before opening family setup. Welcome guide reopens it; Parent FAQ remains accessible from any parent vault. Signing out and child handoff clear parent help.

Welcome text uses Fairy Bucks in full. FAQ explains manual purchases/tracking, reward adjustments, original-cost corrections and refunds, child handoff, password recovery and current PIN/deletion limitations. No dollar conversion, retailer URLs or live pricing is added to the guide. Help is framed around the invite-only pilot host; no unverified support address or nonexistent reset/deletion feature is promised. PIN recovery and a public support/deletion process remain launch work.

Also fixes the authenticated shop route to accept positive treasure keys above 12, so slots 13 and 14 can be requested through the parent shop route. Ownership and canonical offer checks remain server-side.

Validation: full PGlite regression suite plus progress persistence, idempotency, parent isolation, wrong-user/missing-session and anonymous denial. Browser QA used real page/modules with a mocked parent session/RPC: first guide, completion to family setup, reload skipping completed guide, FAQ expansion, reopening and sign-out clearing. Content/route tests and JavaScript syntax checks passed. Live email confirmation/sign-in and production SQL verification remain rollout steps. QA fixtures are not included in the repository or deployment.
