# Single-inbox permission email delivery test

This limited rehearsal checks actual delivery, account/link matching and a distinct confirmation without turning on live permission enforcement. It is not the full live consent state-machine rehearsal and grants no legal consent.

## Preparation

1. Merge this PR, then deploy the new parent-permission-rehearsal Edge Function from the merged self-contained index.ts with verify_jwt=false. The function verifies the caller with Auth and checks the active database session itself.
2. Keep PARENT_EMAIL_PERMISSION_ENABLED=false. Keep both website flags and all database notice/review/enforcement flags off. The rehearsal refuses to run if live email sending is enabled.
3. Add one private Supabase Edge Function secret named PERMISSION_REHEARSAL_EMAIL, with the exact existing, confirmed parent-login email for your own test account. Do not put that email in the repository. Changing this value disables the previous inbox.
4. Use the existing RESEND_API_KEY and PERMISSION_LINK_SECRET. Do not rotate a working link secret simply to enable this test.
5. Confirm the sending domain and no-reply@fairybucks.com sender work; leave tracking disabled.

No new database migration is needed. The rehearsal invokes only the existing email RPC's read-only status action to check the active session; it never calls request, approve, accepted or withdraw and never updates vault/consent records.

## Run

In the Parent Portal, expand Preview email permission and select Test notice and confirmation emails. Sign in to the privately configured parent account if needed.

- Check the test acknowledgement and choose Email me a test notice.
- Confirm the message arrives in inbox/spam, says TEST ONLY, contains the full current notice and uses the expected sender/reply-to.
- Open its link. That performs a read-only inspection. It must not send a confirmation automatically.
- Check the test acknowledgement and choose Send test confirmation.
- Confirm the second message arrives and clearly says no parental consent was recorded.
- Record delivery/spam results privately. Do not send child information or upload email/link screenshots to GitHub/chat.

A new notice/confirmation pair is keyed per parent and UTC day, with stable provider idempotency keys. Repeated requests within that day retry the same message; they do not promise another inbox copy. The link expires at the next UTC midnight (within 24 hours). If a send fails, use Check again and explicitly retry. There is no background sender.

## Safety checks

- Another parent inbox, an unconfirmed parent, an expired sign-in, an altered token, an old notice or an expired link must fail.
- The token is signed, tied to parent/email/notice/expiry, kept in the URL fragment, removed from the address bar immediately and held only in memory.
- Opening or inspecting a link never submits consent or a confirmation email.
- The response never includes link tokens, provider IDs, credentials or the configured inbox.
- All messages are delivered only to the authenticated, privately configured parent email. A caller cannot choose a recipient.
- Finishing this test grants no permission and must not be described as completed COPPA compliance or a completed live consent rehearsal.

After testing, remove PERMISSION_REHEARSAL_EMAIL to close the test path. Leave PARENT_EMAIL_PERMISSION_ENABLED=false until the separate method/provider/retention/security review and full controlled consent rehearsal are complete. This implementation does not create a separate paid project, switch family access or change rewards.
