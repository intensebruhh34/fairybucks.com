-- Operator-only: verify the parent and obtain explicit confirmation of this explorer first.
-- Replace email, expected parent UUID, explorer UUID, case reference and confirmation.
-- Never use CASCADE or broaden the child/family filters to work around an error.
begin;
do $$
declare
 parent uuid:='00000000-0000-0000-0000-000000000000';
 child uuid:='00000000-0000-0000-0000-000000000000';
 parent_email text:='REPLACE_WITH_VERIFIED_PARENT_EMAIL';
 case_ref text:='REPLACE_WITH_VERIFIED_REQUEST_REF';
 confirmation text:='REPLACE_WITH_DELETE_EXPLORER_AND_UUID';
begin
 if case_ref='REPLACE_WITH_VERIFIED_REQUEST_REF' or btrim(case_ref)='' or confirmation<>'DELETE EXPLORER '||child::text then
  raise exception 'Verified case reference and exact explorer confirmation are required';end if;
 perform 1 from auth.users where id=parent and lower(email)=lower(parent_email) and email_confirmed_at is not null for update;
 if not found then raise exception 'Verified parent identity does not match';end if;
 perform 1 from public.families where owner_id=parent for update;
 perform 1 from public.child_profiles c join public.families f on f.id=c.family_id
 where c.id=child and f.owner_id=parent for update of c;
 if not found then raise exception 'Explorer unavailable for this parent';end if;
 delete from private.fairybucks_child_sessions where child_id=child;
 delete from public.treasure_requests where child_id=child;
 delete from public.fairy_transactions where child_id=child;
 delete from public.lost_teeth where child_id=child;
 delete from public.fairy_wallets where child_id=child;
 delete from public.child_profiles where id=child;
 if not found then raise exception 'Explorer deletion could not be confirmed';end if;
 -- End existing parent unlocks so stale pages must unlock again before protected writes.
 delete from private.fairybucks_parent_unlocks where parent_id=parent;
end $$;
select 'Explorer and active vault records deleted. Parent account and other explorers retained.' as result;
commit;
