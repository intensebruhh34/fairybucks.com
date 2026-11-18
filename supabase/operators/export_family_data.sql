-- Operator-only: complete the identity-verification procedure first.
-- Replace all three placeholders. Defaults match no account and return no data.
-- This is a read-only snapshot; never send the SQL Editor screenshot or raw auth tables.
with request as (
 select 'REPLACE_WITH_VERIFIED_PARENT_EMAIL'::text as email,
 '00000000-0000-0000-0000-000000000000'::uuid as expected_parent,
 'REPLACE_WITH_VERIFIED_REQUEST_REF'::text as case_ref
), parent as (
 select u.id,u.email,q.case_ref from auth.users u cross join request q
 where u.id=q.expected_parent and lower(u.email)=lower(q.email)
 and u.email_confirmed_at is not null and q.case_ref<>'REPLACE_WITH_VERIFIED_REQUEST_REF'
), family as (select f.* from public.families f join parent p on p.id=f.owner_id),
 children as (select c.* from public.child_profiles c join family f on f.id=c.family_id)
select jsonb_build_object(
 'format_version',1,'exported_at',clock_timestamp(),'request_reference',p.case_ref,
 'parent',jsonb_build_object('id',p.id,'email',p.email),
 'families',coalesce((select jsonb_agg(to_jsonb(f)) from family f),'[]'::jsonb),
 'explorers',coalesce((select jsonb_agg(to_jsonb(c)) from children c),'[]'::jsonb),
 'wallets',coalesce((select jsonb_agg(to_jsonb(w)) from public.fairy_wallets w join children c on c.id=w.child_id),'[]'::jsonb),
 'transactions',coalesce((select jsonb_agg(to_jsonb(t)) from public.fairy_transactions t join children c on c.id=t.child_id),'[]'::jsonb),
 'teeth',coalesce((select jsonb_agg(to_jsonb(t)) from public.lost_teeth t join children c on c.id=t.child_id),'[]'::jsonb),
 'treasure_requests',coalesce((select jsonb_agg(to_jsonb(r)) from public.treasure_requests r join children c on c.id=r.child_id),'[]'::jsonb),
 'tooth_reward', (select amount from private.fairybucks_tooth_rewards where parent_id=p.id),
 'welcome_guide',(select jsonb_build_object('version',completed_version,'completed_at',completed_at) from private.fairybucks_parent_guides where parent_id=p.id),
 'permission_records',coalesce((select jsonb_agg(jsonb_build_object('notice_version',notice_version,'notice_hash',notice_hash,'status',status,'requested_at',requested_at,'verified_at',verified_at,'withdrawn_at',withdrawn_at,'method',method)) from private.fairybucks_parent_consents where parent_id=p.id),'[]'::jsonb),
 'permission_history',coalesce((select jsonb_agg(jsonb_build_object('notice_version',notice_version,'event',event,'occurred_at',occurred_at)) from private.fairybucks_consent_events where parent_id=p.id),'[]'::jsonb),
 'email_permission', (select jsonb_build_object('notice_version',notice_version,'state',state,'requested_at',created_at,'expires_at',expires_at,'notice_sent_at',notice_sent_at,'approved_at',approved_at,'confirmation_sent_at',confirmation_sent_at) from private.fairybucks_email_permission_requests where parent_id=p.id),
 'limits','Active application records only. Provider logs/backups, support correspondence and device copies require separate review. Authentication secrets, session tokens and internal mail leases are excluded.'
) as family_data from parent p;
