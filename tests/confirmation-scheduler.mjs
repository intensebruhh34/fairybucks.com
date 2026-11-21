// Real SQL execution against simulated pg_net/Vault/cron APIs: no external HTTP or emails.
export async function checkScheduler(db){
 await db.exec(`begin;do $$
 declare a uuid:=gen_random_uuid();rid uuid:=gen_random_uuid();v integer;h text;x bigint;
 begin
 select notice_version,notice_hash into v,h from private.fairybucks_privacy_release;
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now());
 insert into private.fairybucks_email_permission_requests(id,parent_id,parent_email,notice_version,notice_hash,state,approved_at,notice_sent_at)
 values(rid,a,a::text||'@example.test',v,h,'approved',now()-interval '4 minutes',now());
 insert into private.fairybucks_permission_mail(request_id,kind) values(rid,'confirmation');
 update private.fairybucks_privacy_release set notice_ready=true,email_method_reviewed=true,enforcement_enabled=true;
 insert into cron.job values(998,'fairybucks-permission-confirmation'),(999,'other-job');
 insert into cron.job_run_details values(998,now()-interval '8 days'),(999,now()-interval '8 days');
 if private.fairybucks_confirmation_tick() is not null then raise exception 'Mail queued before five minutes';end if;
 if exists(select 1 from cron.job_run_details where jobid=998) or not exists(select 1 from cron.job_run_details where jobid=999) then raise exception 'Cron retention scope incorrect';end if;
 update private.fairybucks_email_permission_requests set approved_at=now()-interval '5 minutes 1 second' where id=rid;
 x:=private.fairybucks_confirmation_tick();
 if x is null or (select count(*) from net.calls)<>1 then raise exception 'Five-minute confirmation not queued';end if;
 if private.fairybucks_confirmation_tick() is not null or (select count(*) from net.calls)<>1 then raise exception 'Duplicate sub-minute tick';end if;
 if not exists(select 1 from net.calls where url='https://cuyrujodyxpxzkdwxstk.supabase.co/functions/v1/parent-permission-confirmation' and body='{}'::jsonb) then raise exception 'Wrong endpoint or private payload sent';end if;
 update private.fairybucks_confirmation_worker set last_submitted_at=null;
 update private.fairybucks_privacy_release set enforcement_enabled=false;
 if private.fairybucks_confirmation_tick() is not null then raise exception 'Staged release sent';end if;
 update private.fairybucks_privacy_release set enforcement_enabled=true;
 update private.fairybucks_email_permission_requests set state='withdrawn' where id=rid;
 if private.fairybucks_confirmation_tick() is not null then raise exception 'Withdrawn request queued';end if;
 end $$;rollback;`);
 console.log('PASS scheduler SQL with simulated networking: five-minute boundary, staging, withdrawal, duplicate ticks, fixed payload and scoped log pruning');
}
