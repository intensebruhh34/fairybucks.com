# Parent data requests — operator procedure

Scope: existing profile editing, whole-account deletion, support-assisted family
data copies and deletion of one explorer. Only authorized operators use the SQL
templates. They are not public APIs and do not themselves verify the requester.

## Verify the request before releasing or deleting data

1. Receive the request at support@fairybucks.com. Do not act on a screenshot,
   nickname, claimed email address or incoming From header alone.
2. Find the existing registered, confirmed parent email and account UUID in the
   protected operator dashboard. Send a fresh, unpredictable one-time challenge
   and case ID **to that registered address**, not a replacement address supplied
   in the request. Generate the challenge with a password manager; never reuse it.
3. Require a reply with that challenge from the registered mailbox. Expire the
   challenge after 24 hours and after use. If the mailbox is inaccessible, use
   account recovery first; do not change ownership or accept a password/PIN as proof.
4. Record the case ID, verification time, registered account UUID, request type
   and minimum required scope in the restricted support case. Keep the challenge
   out of exported data and SQL comments. Do not include family details in GitHub.
5. For deletion, separately obtain an explicit confirmation naming the exact
   explorer. If nicknames are duplicated, resolve which profile the parent means
   before using its UUID. Explain permanence, affected records and purchase limits.

## Provide a copy

Use `supabase/operators/export_family_data.sql`. Fill the verified email,
expected parent UUID and case reference. The default template returns no data.
Run it as a read-only query and confirm exactly one result for the intended parent.

Review the JSON before delivery: parent email, own families/explorers, wallets,
transactions, tooth records, treasure requests/delivery status, reward settings,
guide progress and permission history. Authentication/PIN secrets, session tokens,
mail leases and other families are excluded. Provider logs/backups and support
correspondence are not in this application snapshot; review those separately if
the request covers them. Do not claim the snapshot includes every provider copy.

Confirm the delivery method with the verified parent. Deliver only to the
verified destination using a private method; do not upload it to GitHub, a public
file link, or an unverified replacement inbox. Avoid retaining a second downloaded
copy after successful delivery. Record delivery time and scope in the case.

## Delete one explorer

Use `supabase/operators/delete_explorer_data.sql` only after verification and
explicit confirmation. Fill the verified parent email, parent UUID, explorer UUID,
case reference, and `DELETE EXPLORER <exact UUID>` confirmation.

The transaction locks the parent/family/selected explorer; checks ownership;
removes that explorer's child sessions, requests, transactions, teeth, wallet and
profile; and ends existing parent unlocks. It keeps the parent login, siblings,
other families and account-level settings/permission history.

An unknown dependency fails the whole transaction. Never add CASCADE or remove
ownership filters to force it through. Roll back after an error and investigate.
If a response is lost, inspect the intended explorer before retrying. Do not
substitute another profile or widen the request.

Verify afterward: selected profile and active dependent records absent, selected
child sessions absent, parent/siblings retained. Tell the parent deletion affects
active application records; it does not cancel retailer purchases or instantly
erase provider backups/logs, their own downloads or prior support correspondence.

## Existing portal actions

- Review records in the Family Vault and explorer histories.
- Correct nickname/optional age and gender using Edit explorer.
- Undo a mistaken tooth entry in Parent controls.
- Use Delete account and family data for whole-account removal. This requires
  recent sign-in, Parent PIN if configured and typed confirmation. Never test it
  on a real family without their explicit request.
- Withdrawal refuses further child-mode collection when permission enforcement
  is active. During development the public release remains staged; the completed
  account-scoped permission rehearsal tested that boundary separately.

## Step 9 validation and remaining operator rehearsal

Automated tests use synthetic parents and children in a disposable local database.
They check scoped copy/secret exclusion, mismatched identities, exact deletion
confirmation, cross-family denial, atomic rollback on an unknown dependency,
target-session removal and preservation of siblings/other families. Existing
profile-editing and whole-account deletion regression tests remain in the suite.

Before closing the operational portion of step 9, rehearse a support request with
the owner using **dummy explorer records only**: request, mailbox challenge,
verified copy delivery, explicit single-explorer deletion confirmation and parent
receipt of the result. Do not mark that human workflow passed from the SQL tests.

Keep public permission disabled. Step 10 still owns approved retention schedules,
provider-copy handling and automated cleanup; step 12 owns routine support operations.
