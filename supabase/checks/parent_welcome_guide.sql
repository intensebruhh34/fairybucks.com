-- Run separately after the migration. Uses existing test parents; all fixtures roll back.
begin;
do $$
declare
 parent_a uuid := '44a684ee-6e65-4098-80d7-3a21c3e2bcb4';
 parent_b uuid := '0ad4c55a-d913-4ccf-8dca-954bbe8acd94';
 session_a uuid;
 session_b uuid := gen_random_uuid();
 result jsonb;
begin
 select id into session_a from auth.sessions where user_id=parent_a order by created_at desc limit 1;
 if session_a is null then raise exception 'Sign in to the first test parent account, then retry'; end if;
 -- Simulate the other test account with a temporary session, rolled back below.
 insert into auth.sessions(id,user_id) values(session_b,parent_b);
 delete from private.fairybucks_parent_guides where parent_id in(parent_a,parent_b);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',parent_a,'session_id',session_a)::text,true);
 perform set_config('role','authenticated',true);
 if public.fairybucks_parent_guide()->>'completed' <> 'false' then raise exception 'New guide incorrectly completed'; end if;
 if public.fairybucks_parent_guide(true)->>'completed' <> 'true' then raise exception 'Completion not saved'; end if;
 if public.fairybucks_parent_guide(true)->>'completed' <> 'true' then raise exception 'Repeat completion failed'; end if;
 if public.fairybucks_parent_guide()->>'completed' <> 'true' then raise exception 'Completion not persisted'; end if;
 begin
  perform 1 from private.fairybucks_parent_guides;
  raise exception 'Direct table access allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',parent_b,'session_id',session_b)::text,true);
 if public.fairybucks_parent_guide()->>'completed' <> 'false' then raise exception 'Completion leaked across parents'; end if;
 -- Signed JWT must also reference an extant session belonging to that user.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',parent_b,'session_id',session_a)::text,true);
 begin
  perform public.fairybucks_parent_guide(true);
  raise exception 'Wrong-user session accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',parent_a,'session_id',gen_random_uuid())::text,true);
 begin
  perform public.fairybucks_parent_guide(true);
  raise exception 'Missing session accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('role','anon',true);
 begin
  perform public.fairybucks_parent_guide(true);
  raise exception 'Anonymous guide completion allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('role','none',true);
 if (select count(*) from private.fairybucks_parent_guides where parent_id=parent_a) <> 1 then raise exception 'Duplicate progress records'; end if;
end $$;
select 'PASS: welcome progress persists, retries are safe and parent/session isolation holds.' as result;
rollback;
