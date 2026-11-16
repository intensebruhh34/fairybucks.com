begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();s uuid:=gen_random_uuid();pin_result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(s,a);
 -- Some live projects initialize a family at signup; remove only this disposable fixture's empty family.
 delete from public.families where owner_id=a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',s)::text,true);perform set_config('role','authenticated',true);
 if public.fairybucks_create_parent_pin(null,a)->>'status'<>'setup_required' then raise exception 'No-family account cannot start setup';end if;
 if public.fairybucks_create_parent_pin('12',a)->>'status'<>'invalid_pin' then raise exception 'Invalid PIN allowed';end if;
 begin perform public.fairybucks_create_parent_pin('123456',b);raise exception 'Wrong account setup allowed';exception when insufficient_privilege then null;end;
 pin_result:=public.fairybucks_create_parent_pin('123456',a);
 if pin_result->>'status'<>'unlocked' then raise exception 'First PIN creation failed';end if;
 if public.fairybucks_create_parent_pin('654321',a)->>'status'<>'pin_required' then raise exception 'Existing PIN overwritten';end if;
 if public.fairybucks_parent_pin('654321',false)->>'status'<>'incorrect_pin' then raise exception 'Unexpected replacement PIN';end if;
 if public.fairybucks_parent_pin('123456',false)->>'status'<>'unlocked' then raise exception 'Original PIN not preserved';end if;
 perform set_config('role','anon',true);
 begin perform public.fairybucks_create_parent_pin('123456',a);raise exception 'Anonymous setup allowed';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
 if (select count(*) from public.families where owner_id=a)<>1 then raise exception 'Setup did not initialize exactly one family';end if;
 if exists(select 1 from public.child_profiles c join public.families f on f.id=c.family_id where f.owner_id=a) then raise exception 'Setup created an explorer';end if;
 delete from auth.sessions where id=s;
 perform set_config('role','authenticated',true);
 begin perform public.fairybucks_create_parent_pin(null,a);raise exception 'Expired session setup allowed';exception when insufficient_privilege then null;end;
end $$;
select 'PASS: independent PIN setup, no explorers, ownership/session checks and existing PIN preserved.' as result;
rollback;
