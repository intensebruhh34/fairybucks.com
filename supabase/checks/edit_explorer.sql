begin;
do $$
declare
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();s uuid:=gen_random_uuid();fa uuid;fb uuid;
 c1 uuid:=gen_random_uuid();c2 uuid:=gen_random_uuid();other uuid:=gen_random_uuid();r1 uuid:=gen_random_uuid();r2 uuid:=gen_random_uuid();
 treasure uuid;price integer;result jsonb;old jsonb;token1 text;token2 text;unlock text;v1 jsonb;v2 jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(s,a);
 select id into fa from public.families where owner_id=a limit 1;
 if fa is null then insert into public.families(owner_id) values(a) returning id into fa;end if;
 select id into fb from public.families where owner_id=b limit 1;
 if fb is null then insert into public.families(owner_id) values(b) returning id into fb;end if;
 insert into public.child_profiles(id,family_id,nickname,age,gender) values(c1,fa,'First explorer',7,'boy'),(c2,fa,'Second explorer',null,'rather-not-say'),(other,fb,'Other family',8,'girl');
 insert into public.lost_teeth(child_id,lost_on) values(c1,current_date),(c1,current_date-1),(c2,current_date);
 insert into public.fairy_wallets(child_id,balance) values(c1,25),(c2,40) on conflict(child_id) do update set balance=excluded.balance;
 select id,fairy_price into treasure,price from public.treasures where shop_key=1;
 insert into public.treasure_requests(id,child_id,treasure_id,status,price_at_request) values(r1,c1,treasure,'pending',price),(r2,c2,treasure,'pending',price);
 insert into private.parent_pin_security(parent_id,pin_hash) values(a,extensions.crypt('123456',extensions.gen_salt('bf',4)));
 -- Newer consent-enabled installations need a synthetic permission fixture.
 -- Older development installations have no consent tables; no setup is needed there.
 -- All permission changes and fixtures below roll back.
 if to_regclass('private.fairybucks_privacy_release') is not null
 and to_regclass('private.fairybucks_parent_consents') is not null then
 update private.fairybucks_privacy_release set notice_ready=true;
 insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at,verified_at,method,evidence_ref,reviewer)
 select a,notice_version,notice_hash,'verified',now(),now(),'signed_form','SYNTHETIC-EDIT-CHECK','Rollback fixture' from private.fairybucks_privacy_release;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',s)::text,true);perform set_config('role','authenticated',true);
 old:=jsonb_build_object('nickname','First explorer','age',7,'gender','boy');
 result:=public.fairybucks_edit_explorer(c1,'  Renamed explorer  ',9,'rather-not-say',a,old);
 if result->>'status'<>'saved' or result->'profile'->>'nickname'<>'Renamed explorer' then raise exception 'Own explorer edit failed';end if;
 if public.fairybucks_edit_explorer(c1,'Stale overwrite',7,'boy',a,old)->>'status'<>'changed' then raise exception 'Stale edit overwrote newer details';end if;
 old:=jsonb_build_object('nickname','Renamed explorer','age',9,'gender','rather-not-say');
 if public.fairybucks_edit_explorer(c1,'Renamed explorer',null,'rather-not-say',a,old)->>'status'<>'saved' then raise exception 'Optional age could not be removed';end if;
 begin perform public.fairybucks_edit_explorer(c1,' ',null,'boy',a,old);raise exception 'Blank nickname accepted';exception when invalid_parameter_value then null;end;
 begin perform public.fairybucks_edit_explorer(c1,'Name',99,'boy',a,old);raise exception 'Invalid age accepted';exception when invalid_parameter_value then null;end;
 begin perform public.fairybucks_edit_explorer(c1,'Name',null,'invalid',a,old);raise exception 'Invalid gender accepted';exception when invalid_parameter_value then null;end;
 begin perform public.fairybucks_edit_explorer(c1,'Name',null,'boy',b,old);raise exception 'Wrong current parent accepted';exception when insufficient_privilege then null;end;
 if public.fairybucks_edit_explorer(other,'Not mine',8,'girl',a,'{}')->>'status'<>'unavailable' then raise exception 'Cross-family edit allowed';end if;
 unlock:=public.fairybucks_parent_pin('123456',false)->>'token';token1:=public.fairybucks_start_child_session(c1,unlock);
 unlock:=public.fairybucks_parent_pin('123456',false)->>'token';token2:=public.fairybucks_start_child_session(c2,unlock);
 perform set_config('role','anon',true);
 begin perform public.fairybucks_edit_explorer(c1,'Name',null,'boy',a,old);raise exception 'Child/anonymous edit allowed';exception when insufficient_privilege then null;end;
 v1:=public.fairybucks_child_action(token1);v2:=public.fairybucks_child_action(token2);
 if v1->>'nickname'<>'Renamed explorer' or (v1->>'balance')::int<>25 or (v1->>'tooth_count')::int<>2
 or jsonb_array_length(v1->'requests')<>1 or v1->'requests'->0->>'id'<>r1::text then raise exception 'First explorer data mixed';end if;
 if v2->>'nickname'<>'Second explorer' or (v2->>'balance')::int<>40 or (v2->>'tooth_count')::int<>1
 or jsonb_array_length(v2->'requests')<>1 or v2->'requests'->0->>'id'<>r2::text then raise exception 'Second explorer data mixed';end if;
 perform set_config('role','none',true);
 if not exists(select 1 from public.child_profiles where id=c1 and family_id=fa and age is null)
 or not exists(select 1 from public.child_profiles where id=other and family_id=fb and nickname='Other family') then raise exception 'IDs/family metadata changed';end if;
 delete from auth.sessions where id=s;perform set_config('role','authenticated',true);
 begin perform public.fairybucks_edit_explorer(c1,'Name',null,'boy',a,old);raise exception 'Expired session edit allowed';exception when insufficient_privilege then null;end;
end $$;
select 'PASS: explorer metadata edits, stale-write protection, two-explorer separation and family/session isolation.' as result;
rollback;
