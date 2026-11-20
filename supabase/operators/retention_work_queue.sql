-- Private operator report. Results contain parent emails; never share/commit exports.
-- Read only. Does not send warnings, mark mail deleted or delete an account.
with accounts as (
 select u.id as parent_id,u.email,private.fairybucks_retention_last_activity(u.id) as last_activity
 from auth.users u where u.email_confirmed_at is not null
)
select a.parent_id,a.email,a.last_activity,n.id as notice_id,n.sent_at,
 n.sent_at+interval '30 days' as earliest_deletion,
 case when n.id is null then 'SEND WARNING'
 when lower(a.email)<>lower(n.parent_email) or a.last_activity>n.activity_at then 'NEW ACTIVITY OR EMAIL: DO NOT DELETE'
 when n.sent_at>clock_timestamp()-interval '30 days' then 'WAIT'
 else 'REVIEW DELIVERY AND TARGET BEFORE DELETION' end as next_action
from accounts a left join private.fairybucks_inactivity_notices n on n.parent_id=a.parent_id
where a.last_activity<=clock_timestamp()-interval '12 months'
order by a.last_activity;

select case_ref,closed_at,closed_at+interval '90 days' as delete_by,hold_reason,hold_review_at,
 case when hold_reason is not null and hold_review_at<=clock_timestamp() then 'REVIEW EXCEPTION NOW'
 when hold_reason is not null then 'DOCUMENTED HOLD'
 when closed_at+interval '90 days'<=clock_timestamp() then 'OVERDUE: REMOVE RELATED MAIL COPIES'
 else 'REMOVE BY DUE DATE' end as next_action
from private.fairybucks_support_retention where deleted_at is null
order by closed_at;
