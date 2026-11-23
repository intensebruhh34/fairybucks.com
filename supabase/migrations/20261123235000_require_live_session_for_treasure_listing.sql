-- Restrict parent treasure-request listing to an active Auth session.
-- This parent-facing SECURITY DEFINER RPC must not accept a JWT whose session was revoked.
-- The existing function's return type, EXECUTE grants and search_path are preserved.
begin;
do $$
begin
 if to_regprocedure('public.fairybucks_list_treasure_requests(uuid)') is null then
  raise exception 'Existing treasure-request listing RPC is missing: review schema before applying';
 end if;
end $$;

create or replace function public.fairybucks_list_treasure_requests(p_child_id uuid)
 returns table(id uuid, name text, price integer, status text, delivery_stage text)
 language sql
 stable security definer
 set search_path to ''
as $function$
 select r.id,t.name,r.price_at_request,r.status,r.delivery_stage
 from public.treasure_requests r join public.treasures t on t.id=r.treasure_id
 join public.child_profiles c on c.id=r.child_id join public.families f on f.id=c.family_id
 where r.child_id=p_child_id
   and f.owner_id=auth.uid()
   and exists (
     select 1 from auth.sessions s
     where s.id=nullif(auth.jwt()->>'session_id','')::uuid
       and s.user_id=auth.uid()
   )
 order by (r.status='pending') desc,r.created_at desc,r.id desc;
$function$;
commit;
