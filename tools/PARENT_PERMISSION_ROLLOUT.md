# Historical parent-permission foundation — retired rollout instructions

The original paper-form rollout and version-1 activation instructions are retired.
Do not print consent forms, use the legacy verification script for new families,
or run `supabase/operators/activate_parent_notice.sql` to activate the current
email flow. That script now stops without changing any settings.

The foundation migrations and restricted legacy functions remain for migration
history; their presence does not make the paper process the current workflow.
The former instructions are available in Git history.

Use these current documents:

- [Final launch review](../docs/reviews/pilot-launch-2026-11-20.md): current evidence, deferred items and remaining decisions.
- [Email parent permission](EMAIL_PARENT_PERMISSION.md): staged email implementation and coordinated activation requirements.
- [Account-scoped rehearsal](../docs/reviews/account-permission-rehearsal.md): controlled testing on the existing site.
- [Security/recovery operations](../docs/security-recovery-operations.md) and [retention operations](../docs/retention-operations.md).

Global permission and privacy-review flags remain off. No family invitation or
production activation is authorized by this document change.
