-- Read-only snapshot of actual installed child session issuance RPCs, November 23, 2026.
-- Test-only local fixture, not a migration. No secrets or family records.

-- private.fairybucks_start_child_session_core
CREATE OR REPLACE FUNCTION private.fairybucks_start_child_session_core(p_child_id uuid, p_unlock_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  child_token text;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent is required';
  end if;
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then return null; end if;
  perform 1 from private.fairybucks_parent_unlocks
    where parent_id = parent and session_id = auth_session
      and token_hash = extensions.digest(p_unlock_token, 'sha256')
      and expires_at > clock_timestamp()
    for update;
  if not found then return null; end if;
  if not exists (
    select 1 from public.child_profiles c join public.families f on f.id = c.family_id
    where c.id = p_child_id and f.owner_id = parent
  ) then
    raise insufficient_privilege using message = 'Explorer is unavailable';
  end if;

  child_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.fairybucks_child_sessions (child_id, token_hash, expires_at)
    values (p_child_id, extensions.digest(child_token, 'sha256'), clock_timestamp() + interval '1 hour')
    on conflict (child_id) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at;
  delete from private.fairybucks_parent_unlocks where parent_id = parent;
  return child_token;
end;
$function$;

-- public.fairybucks_start_child_session
CREATE OR REPLACE FUNCTION public.fairybucks_start_child_session(p_child_id uuid, p_unlock_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.fairybucks_child_permission(auth.uid()) then
  raise insufficient_privilege using message='Verified parent permission is required before child mode';end if;
 return private.fairybucks_start_child_session_core(p_child_id,p_unlock_token);
end $function$;
