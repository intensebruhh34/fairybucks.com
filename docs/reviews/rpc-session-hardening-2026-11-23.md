# Security hardening checkpoint — live parent session for treasure-request listing

**Proposed change, not deployed.** This PR addresses one concrete gap found in the November 23 live function review. The existing `public.fairybucks_list_treasure_requests(uuid)` checked that the selected child belongs to `auth.uid()` but did not check whether the JWT's `session_id` still exists in `auth.sessions`. That differs from the more restrictive `private.fairybucks_start_child_session_core` and `public.fairybucks_submit_treasure` behavior.

## Change and test

- Add a live Auth session ownership check to the existing `SECURITY DEFINER` request-listing RPC. A missing/revoked session fails closed (empty listing). Preserve its stable return shape, family ownership check, ordering, restricted `search_path`, and existing EXECUTE grants.
- A PGlite regression runs in CI to check a valid parent's own request is visible; another family, a missing session ID, a revoked session ID and a session belonging to another user return no requests.
- Operator review must confirm this behavior is compatible with existing signed-in browser flows before a migration is applied. The CI test uses a simulated database, **not** production credentials or live user data.

## Deployment and rollback

After explicit owner approval and green CI: apply the migration through the established Supabase migration workflow, first on a separate test environment if possible, then verify with a fresh and signed-out parent session on the deployed website. Rollback is another owner-reviewed migration restoring the earlier function body only after impact assessment; do not silently remove the live-session constraint.

## Security warnings intentionally not auto-dismissed

1. **20 private RLS-without-policy INFO notices**: private tables are intentionally inaccessible directly to anonymous and authenticated API users; retain deny-by-default. Do not add broad policies to make a warning disappear.
2. **Anonymous `fairybucks_child_action` SECURITY DEFINER warning**: expected token-authenticated child-mode entrypoint, but high impact. Needs targeted invalid, expired, revoked, cross-explorer token tests; don't remove `anon` EXECUTE or child mode breaks.
3. **Authenticated SECURITY DEFINER RPC warnings**: explicitly review each RPC's ownership, Auth session, parameter bounds, `search_path`, and permissions. Do not blanket switch to SECURITY INVOKER when private tables are intentionally blocked.
4. **`pg_net` installed in public**: relocation may break confirmation/retention tasks; inventory dependent jobs/functions before a separately reviewed migration.
5. **Leaked-password protection disabled**: check if Supabase Auth and the current plan support enabling; do so only after confirming behavior and operational needs.
6. **Floating jsDelivr dependency**: pin or self-host a verified Supabase JS version after browser testing.
7. **Free-plan backup/restore and vendor/COPPA review**: still outstanding. No assertions of COPPA compliance or public launch authorization.

**Public signup stays disabled.** No live SQL, secret updates, DNS changes, Edge deployments, or PR merges are included in this proposal. Keep provider/legal launch gates separate from this technical hardening.
