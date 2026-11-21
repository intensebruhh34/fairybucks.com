-- Aggregate operational status only. Never select Vault plaintext, HTTP request headers or email bodies.
select j.jobname,j.schedule,j.active,
 w.last_submitted_at,r.status_code,r.timed_out,
 count(m.id) filter(where m.accepted_at is null) as pending_confirmations,
 count(m.id) filter(where m.accepted_at is null and m.first_confirmation_attempt_at<=clock_timestamp()-interval '23 hours') as needs_operator_review
from cron.job j
cross join private.fairybucks_confirmation_worker w
left join net._http_response r on r.id=w.last_request_id
left join private.fairybucks_permission_mail m on m.kind='confirmation'
where j.jobname='fairybucks-permission-confirmation'
group by j.jobname,j.schedule,j.active,w.last_submitted_at,r.status_code,r.timed_out;
