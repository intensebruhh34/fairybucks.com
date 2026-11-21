-- Release hardening: disable development-only child access for ordinary accounts.
-- Private allowlisted rehearsals retain their tested effective-permission override.
-- No public feature flag is enabled by this migration.
create or replace function private.fairybucks_child_permission(p_parent uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare release private.fairybucks_privacy_release%rowtype;c private.fairybucks_parent_consents%rowtype;
begin
 select * into release from private.fairybucks_effective_permission_release(p_parent);
 if found and not release.enforcement_enabled then return false;end if;
 if release.singleton is null or not release.notice_ready then return false;end if;
 select * into c from private.fairybucks_parent_consents where parent_id=p_parent
  and notice_version=release.notice_version and notice_hash=release.notice_hash and status='verified' for share;
 if not found then return false;end if;
 if c.reviewer='permission-email-rehearsal' and not exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=p_parent and expires_at>clock_timestamp()) then return false;end if;
 if c.method is distinct from 'email_plus' and exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=p_parent) then return false;end if;
 if c.method='email_plus' then
  return release.email_method_reviewed and exists(
   select 1 from private.fairybucks_email_permission_requests r join auth.users u on u.id=r.parent_id
   where r.parent_id=p_parent and r.state in ('approved','verified') and r.parent_email=u.email and u.email_confirmed_at is not null
    and r.notice_version=release.notice_version and r.notice_hash=release.notice_hash and r.notice_sent_at is not null and r.approved_at is not null
    and (r.confirmation_sent_at is not null or (r.expires_at>clock_timestamp() and exists(select 1 from private.fairybucks_permission_mail m where m.request_id=r.id and m.kind='confirmation'))));
 end if;
 return true;
end $$;
