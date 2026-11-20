-- Operational cleanup only. Does not enable child mode or alter family records.
begin;
create table private.fairybucks_cleanup_status (
 singleton boolean primary key default true check(singleton),
 completed_at timestamptz not null,
 removed_requests integer not null,
 removed_sessions integer not null,
 removed_unlocks integer not null,
 removed_limits integer not null
);
alter table private.fairybucks_cleanup_status enable row level security;
revoke all on private.fairybucks_cleanup_status from public,anon,authenticated,service_role;

create function private.fairybucks_retention_cleanup()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p uuid; requests integer:=0; sessions integer; unlocks integer; limits integer; n integer;
begin
 -- Follow the permission RPC's auth-user-before-request lock order. Busy parents
 -- are skipped until the next daily run. Recheck eligibility after locking.
 for p in select u.id from auth.users u where exists (
  select 1 from private.fairybucks_email_permission_requests r
  left join private.fairybucks_parent_consents c on c.parent_id=r.parent_id and c.notice_version=r.notice_version
  where r.parent_id=u.id and (
   (r.state in ('requested','approved') and r.expires_at<clock_timestamp()-interval '30 days')
   or (r.state='withdrawn' and c.status='withdrawn' and c.withdrawn_at<clock_timestamp()-interval '30 days')
  )
 ) order by u.id for update of u skip locked loop
  delete from private.fairybucks_email_permission_requests r using private.fairybucks_parent_consents c
  where r.parent_id=p and c.parent_id=r.parent_id and c.notice_version=r.notice_version and (
   (r.state in ('requested','approved') and r.expires_at<clock_timestamp()-interval '30 days')
   or (r.state='withdrawn' and c.status='withdrawn' and c.withdrawn_at<clock_timestamp()-interval '30 days')
  );
  get diagnostics n=row_count; requests:=requests+n;
 end loop;
 -- Expired tokens are already rejected by access checks; now remove their rows.
 delete from private.fairybucks_child_sessions where expires_at<=clock_timestamp();
 get diagnostics sessions=row_count;
 delete from private.fairybucks_parent_unlocks where expires_at<=clock_timestamp();
 get diagnostics unlocks=row_count;
 delete from private.fairybucks_permission_mail_limits
  where greatest(window_start,coalesce(last_attempt,window_start))<clock_timestamp()-interval '30 days';
 get diagnostics limits=row_count;
 insert into private.fairybucks_cleanup_status values(true,clock_timestamp(),requests,sessions,unlocks,limits)
 on conflict(singleton) do update set completed_at=excluded.completed_at,
 removed_requests=excluded.removed_requests,removed_sessions=excluded.removed_sessions,
 removed_unlocks=excluded.removed_unlocks,removed_limits=excluded.removed_limits;
 return jsonb_build_object('requests',requests,'sessions',sessions,'unlocks',unlocks,'limits',limits);
end $$;
revoke all on function private.fairybucks_retention_cleanup() from public,anon,authenticated,service_role;
commit;
