-- OPERATOR ONLY. No browser role can execute the private approval function.
-- Review the actual signed form, its full notice text/version/hash and registered email first.
-- Put only an internal reference here; never paste signatures/photos into SQL or GitHub.
begin;
do $$
declare
 reviewed_parent uuid := null; -- UUID from the matching pending request
 reviewed_version integer := 1;
 reviewed_hash text := ''; -- exact reviewed form and active notice hash
 internal_form_reference text := ''; -- identifier in restricted consent storage
 reviewing_operator text := '';
begin
 if reviewed_parent is null then raise exception 'Fill the reviewed parent account UUID after checking the signed form';end if;
 perform private.fairybucks_verify_signed_consent(reviewed_parent,reviewed_version,reviewed_hash,internal_form_reference,reviewing_operator);
end $$;
commit;
