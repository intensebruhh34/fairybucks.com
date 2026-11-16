-- READ-ONLY privacy/permission installation report. Run as ONE SQL Editor query.
-- No account data, PINs, tokens or consent forms are returned. Nothing is activated.
with required_tables(name) as (values
 ('private.fairybucks_privacy_release'),('private.fairybucks_parent_consents'),('private.fairybucks_consent_events')
), required_functions(name,authenticated_allowed) as (values
 ('public.fairybucks_parent_consent(text,integer,text,boolean)',true),
 ('private.fairybucks_verify_signed_consent(uuid,integer,text,text,text)',false),
 ('private.fairybucks_child_permission(uuid)',false),
 ('private.fairybucks_start_child_session_core(uuid,text)',false),
 ('private.fairybucks_child_action_core(text,text,uuid,integer,integer)',false)
), report as (
 select 'Table: '||name as component,
 case when to_regclass(name) is null then 'MISSING'
 when not (select relrowsecurity from pg_class where oid=to_regclass(name)) then 'REVIEW'
 when has_table_privilege('anon',to_regclass(name),'SELECT,INSERT,UPDATE,DELETE')
 or has_table_privilege('authenticated',to_regclass(name),'SELECT,INSERT,UPDATE,DELETE') then 'REVIEW'
 else 'INSTALLED' end as status,
 case when to_regclass(name) is null then 'Consent foundation migration has not been installed completely.'
 else 'Expected: RLS enabled and no direct API-role read/write grants.' end as detail
 from required_tables
 union all
 select 'Function: '||name,
 case when to_regprocedure(name) is null then 'MISSING'
 when has_function_privilege('anon',to_regprocedure(name),'EXECUTE') then 'REVIEW'
 when has_function_privilege('authenticated',to_regprocedure(name),'EXECUTE') is distinct from authenticated_allowed then 'REVIEW'
 else 'INSTALLED' end,
 'Expected authenticated execution: '||authenticated_allowed::text||'; anonymous execution: false.'
 from required_functions
 union all
 select 'Explorer insert permission trigger',
 case when exists(select 1 from pg_trigger where tgrelid=to_regclass('public.child_profiles')
 and tgname='fairybucks_profile_permission' and tgenabled in('O','A')) then 'INSTALLED' else 'MISSING' end,
 'New profile inserts must be checked when the reviewed consent workflow is activated.'
 union all
 select 'Child handoff permission wrapper',
 case when to_regprocedure('public.fairybucks_start_child_session(uuid,text)') is null then 'MISSING'
 when position('fairybucks_child_permission' in pg_get_functiondef(to_regprocedure('public.fairybucks_start_child_session(uuid,text)')))>0 then 'INSTALLED' else 'REVIEW' end,
 'The public handoff function must call the private permission check.'
 union all
 select 'Child action permission wrapper',
 case when to_regprocedure('public.fairybucks_child_action(text,text,uuid,integer,integer)') is null then 'MISSING'
 when position('fairybucks_child_permission' in pg_get_functiondef(to_regprocedure('public.fairybucks_child_action(text,text,uuid,integer,integer)')))>0 then 'INSTALLED' else 'REVIEW' end,
 'The public child action function must check permission before reading or writing child data.'
 union all
 select 'Current database release settings','INFORMATION',
 case when to_regclass('private.fairybucks_privacy_release') is null then 'No release table is installed. Current development flow is not a verified-consent rollout.'
 else coalesce(
 ((xpath('/table/row/settings/text()',query_to_xml(
 'select row_to_json(r)::text as settings from (select notice_version,notice_hash,notice_ready,enforcement_enabled from private.fairybucks_privacy_release where singleton) r',
 false,false,'')))[1])::text,
 'Release table has no singleton settings row; review the installation.') end
 union all
 select 'Website release settings','STAGED',
 'Repository settings currently keep privacyNoticeReviewed=false and parentPermissionEnabled=false. This SQL report does not read deployed browser files.'
 union all
 select 'Launch decision','MANUAL REVIEW',
 'INSTALLED means components exist with the listed role checks, not legal compliance. Direct notice delivery, consent review, provider retention, written security procedures and a full rehearsal remain to confirm.'
)
select component,status,detail from report order by component;
