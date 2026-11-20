-- Operator-assisted retention. No emails are sent and no accounts are deleted by installation.
begin;
create table private.fairybucks_retention_policy (
 singleton boolean primary key default true check(singleton), started_at timestamptz not null default clock_timestamp()
);
insert into private.fairybucks_retention_policy(singleton) values(true);
create table private.fairybucks_account_activity (
 parent_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default clock_timestamp()
);
-- Never infer that existing accounts have already been inactive for a year.
insert into private.fairybucks_account_activity(parent_id) select id from auth.users;
create table private.fairybucks_inactivity_notices (
 parent_id uuid primary key references auth.users(id) on delete cascade,
 id uuid not null unique default gen_random_uuid(), parent_email text not null,
 activity_at timestamptz not null, sent_at timestamptz not null default clock_timestamp(),
 evidence_ref text not null check(length(btrim(evidence_ref)) between 1 and 200)
);
create table private.fairybucks_support_retention (
 case_ref text primary key check(length(btrim(case_ref)) between 1 and 100),
 closed_at timestamptz not null default clock_timestamp(),
 deleted_at timestamptz,
 hold_reason text, hold_review_at timestamptz,
 check((hold_reason is null)=(hold_review_at is null))
);
alter table private.fairybucks_retention_policy enable row level security;
alter table private.fairybucks_account_activity enable row level security;
alter table private.fairybucks_inactivity_notices enable row level security;
alter table private.fairybucks_support_retention enable row level security;
revoke all on private.fairybucks_retention_policy,private.fairybucks_account_activity,
 private.fairybucks_inactivity_notices,private.fairybucks_support_retention from public,anon,authenticated,service_role;

create function private.fairybucks_track_retention_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare p uuid;
begin
 if tg_table_schema='auth' then
  if tg_op='DELETE' then p:=old.user_id;else p:=new.user_id;end if;
 else
  select f.owner_id into p from public.child_profiles c join public.families f on f.id=c.family_id where c.id=new.child_id;
 end if;
 if p is not null and exists(select 1 from auth.users where id=p) then
  insert into private.fairybucks_account_activity(parent_id,last_seen_at) values(p,clock_timestamp())
  on conflict(parent_id) do update set last_seen_at=greatest(private.fairybucks_account_activity.last_seen_at,excluded.last_seen_at);
  delete from private.fairybucks_inactivity_notices where parent_id=p;
 end if;
 return null;
end $$;
revoke all on function private.fairybucks_track_retention_activity() from public,anon,authenticated,service_role;
-- Refreshes count conservatively as activity; closing/revoking a session also cancels an old warning.
create trigger fairybucks_retention_session_activity after insert or update or delete on auth.sessions
 for each row execute function private.fairybucks_track_retention_activity();
create trigger fairybucks_retention_child_activity after insert or update on private.fairybucks_child_sessions
 for each row execute function private.fairybucks_track_retention_activity();

create function private.fairybucks_retention_last_activity(p_parent uuid)
returns timestamptz language sql stable security invoker set search_path='' as $$
 select greatest(p.started_at,a.last_seen_at,u.created_at,u.last_sign_in_at,
  (select max(greatest(s.created_at,
   nullif(to_jsonb(s)->>'updated_at','')::timestamptz,
   (nullif(to_jsonb(s)->>'refreshed_at','')::timestamp at time zone 'UTC'))) from auth.sessions s where s.user_id=u.id))
 from auth.users u cross join private.fairybucks_retention_policy p
 left join private.fairybucks_account_activity a on a.parent_id=u.id where u.id=p_parent
$$;
revoke all on function private.fairybucks_retention_last_activity(uuid) from public,anon,authenticated,service_role;

create function private.fairybucks_record_inactivity_warning(p_parent uuid,p_email text,p_evidence text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare seen timestamptz; notice uuid;
begin
 perform 1 from auth.users where id=p_parent and lower(email)=lower(p_email) and email_confirmed_at is not null for update;
 if not found then raise exception 'Confirmed parent/email mismatch';end if;
 seen:=private.fairybucks_retention_last_activity(p_parent);
 if seen is null or seen>clock_timestamp()-interval '12 months' then raise exception 'Account is not inactive for 12 months';end if;
 if p_evidence is null or btrim(p_evidence)='' or p_evidence like 'REPLACE_%' then raise exception 'Accepted warning delivery reference required';end if;
 insert into private.fairybucks_inactivity_notices(parent_id,parent_email,activity_at,evidence_ref)
 values(p_parent,p_email,seen,p_evidence)
 on conflict(parent_id) do update set id=gen_random_uuid(),parent_email=excluded.parent_email,
 activity_at=excluded.activity_at,sent_at=clock_timestamp(),evidence_ref=excluded.evidence_ref returning id into notice;
 return notice;
end $$;
revoke all on function private.fairybucks_record_inactivity_warning(uuid,text,text) from public,anon,authenticated,service_role;

create function private.fairybucks_delete_inactive_account(p_parent uuid,p_email text,p_notice uuid,p_confirmation text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare n private.fairybucks_inactivity_notices%rowtype;seen timestamptz;
begin
 if p_confirmation is distinct from 'DELETE INACTIVE ACCOUNT '||p_parent::text then raise exception 'Exact account confirmation required';end if;
 perform 1 from auth.users where id=p_parent and lower(email)=lower(p_email) and email_confirmed_at is not null for update;
 if not found then raise exception 'Confirmed parent/email mismatch';end if;
 perform 1 from public.families where owner_id=p_parent for update;
 perform 1 from public.child_profiles c join public.families f on f.id=c.family_id where f.owner_id=p_parent for update of c;
 -- Serialize existing-session refreshes and child-token updates too. New sessions
 -- and child tokens need FK locks on the already locked parent/profile rows.
 perform 1 from auth.sessions where user_id=p_parent for update;
 perform 1 from private.fairybucks_child_sessions s join public.child_profiles c on c.id=s.child_id join public.families f on f.id=c.family_id
  where f.owner_id=p_parent for update of s;
 -- Recheck tracked activity after all dependent locks.
 select * into n from private.fairybucks_inactivity_notices where parent_id=p_parent for update;
 seen:=private.fairybucks_retention_last_activity(p_parent);
 if n.id is null or n.id is distinct from p_notice or lower(n.parent_email)<>lower(p_email)
 or n.sent_at>clock_timestamp()-interval '30 days' or seen is null
 or seen>clock_timestamp()-interval '12 months' or seen>n.activity_at
 then raise exception 'A current 30-day warning and continued inactivity are required';end if;
 delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
  where s.child_id=c.id and c.family_id=f.id and f.owner_id=p_parent;
 delete from public.treasure_requests r using public.child_profiles c,public.families f
  where r.child_id=c.id and c.family_id=f.id and f.owner_id=p_parent;
 delete from public.fairy_transactions t using public.child_profiles c,public.families f
  where t.child_id=c.id and c.family_id=f.id and f.owner_id=p_parent;
 delete from public.lost_teeth t using public.child_profiles c,public.families f
  where t.child_id=c.id and c.family_id=f.id and f.owner_id=p_parent;
 delete from public.fairy_wallets w using public.child_profiles c,public.families f
  where w.child_id=c.id and c.family_id=f.id and f.owner_id=p_parent;
 delete from public.child_profiles c using public.families f where c.family_id=f.id and f.owner_id=p_parent;
 delete from public.families where owner_id=p_parent;
 delete from private.fairybucks_parent_unlocks where parent_id=p_parent;
 delete from private.parent_pin_security where parent_id=p_parent;
 delete from private.fairybucks_tooth_rewards where parent_id=p_parent;
 delete from private.fairybucks_parent_guides where parent_id=p_parent;
 delete from private.fairybucks_pin_recoveries where parent_id=p_parent;
 delete from auth.sessions where user_id=p_parent;
 -- Auth identities and refresh tokens use Supabase's own cascades. Storage ownership or an
 -- unexpected external dependency makes the entire transaction fail; never use CASCADE here.
 delete from auth.users where id=p_parent;
 if not found then raise exception 'Account deletion could not be confirmed'; end if;
 return jsonb_build_object('status','deleted');
end $$;
revoke all on function private.fairybucks_delete_inactive_account(uuid,text,uuid,text) from public,anon,authenticated,service_role;
commit;
