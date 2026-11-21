-- Worker authentication and once-per-minute scheduler support. This installs no cron job.
-- pg_net is enabled separately by the operator after the reviewed worker is deployed.
begin;
create table private.fairybucks_confirmation_worker (
 singleton boolean primary key default true check(singleton),
 secret_id uuid not null,
 secret_hash bytea not null,
 last_request_id bigint,
 last_submitted_at timestamptz,
 last_pruned_at timestamptz
);
alter table private.fairybucks_confirmation_worker enable row level security;
revoke all on private.fairybucks_confirmation_worker from public,anon,authenticated,service_role;
do $$declare value text;ident uuid;begin
 -- Generated inside Postgres, encrypted by Vault, never returned through SQL output.
 value:=encode(extensions.gen_random_bytes(32),'hex');
 ident:=vault.create_secret(value,'fairybucks_confirmation_worker','Private credential for the fixed confirmation worker endpoint');
 insert into private.fairybucks_confirmation_worker(secret_id,secret_hash)
  values(ident,extensions.digest(value,'sha256'));
end $$;
create function public.fairybucks_check_confirmation_worker(p_secret text)
returns boolean language sql security definer set search_path='' as $$
 select coalesce(p_secret ~ '^[0-9a-f]{64}$' and exists(
  select 1 from private.fairybucks_confirmation_worker where singleton
   and secret_hash=extensions.digest(p_secret,'sha256')),false);
$$;
revoke all on function public.fairybucks_check_confirmation_worker(text) from public,anon,authenticated,service_role;
grant execute on function public.fairybucks_check_confirmation_worker(text) to service_role;

create function private.fairybucks_confirmation_tick()
returns bigint language plpgsql security definer set search_path='' as $$
declare state private.fairybucks_confirmation_worker%rowtype;credential text;request_id bigint;
begin
 select * into state from private.fairybucks_confirmation_worker where singleton for update;
 if not found then return null;end if;
 -- Bound this high-frequency job's own operational log retention, not other cron jobs.
 if state.last_pruned_at is null or state.last_pruned_at<clock_timestamp()-interval '1 hour' then
  delete from cron.job_run_details where jobid in (
   select jobid from cron.job where jobname='fairybucks-permission-confirmation')
   and end_time<clock_timestamp()-interval '7 days';
  update private.fairybucks_confirmation_worker set last_pruned_at=clock_timestamp() where singleton;
 end if;
 if state.last_submitted_at>clock_timestamp()-interval '55 seconds' then return null;end if;
 if not exists(
  select 1 from private.fairybucks_email_permission_requests q
  join private.fairybucks_permission_mail m on m.request_id=q.id and m.kind='confirmation'
  cross join lateral private.fairybucks_effective_permission_release(q.parent_id) rel
  where rel.notice_ready and rel.enforcement_enabled and rel.email_method_reviewed
   and q.notice_version=rel.notice_version and q.notice_hash=rel.notice_hash
   and q.state='approved' and q.approved_at<=clock_timestamp()-interval '5 minutes'
   and q.expires_at>clock_timestamp() and m.accepted_at is null
   and (m.lease_until is null or m.lease_until<clock_timestamp())
   and (m.first_confirmation_attempt_at is null or m.first_confirmation_attempt_at>clock_timestamp()-interval '23 hours')
 ) then return null;end if;
 select decrypted_secret into credential from vault.decrypted_secrets where id=state.secret_id;
 if credential is null then raise exception 'Confirmation scheduler credential unavailable';end if;
 -- Fixed origin/path and empty payload: never send a family ID, email or notice token.
 request_id:=net.http_post(
  url:='https://cuyrujodyxpxzkdwxstk.supabase.co/functions/v1/parent-permission-confirmation',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),
  body:='{}'::jsonb,timeout_milliseconds:=90000);
 update private.fairybucks_confirmation_worker set last_request_id=request_id,last_submitted_at=clock_timestamp() where singleton;
 return request_id;
end $$;
revoke all on function private.fairybucks_confirmation_tick() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
