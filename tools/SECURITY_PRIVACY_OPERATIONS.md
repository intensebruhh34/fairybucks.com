# Draft operator security and privacy program

Owner/responsible coordinator: operator to designate before launch. Review at least annually and after material changes or incidents. This file is a procedure template; filling it requires actual operational work and does not certify compliance.

## Data inventory and access

Inventory parent email/auth records; explorer nickname/optional demographics; tooth and wallet history; requests/stages; session tokens; permission records and signed-form evidence; support messages; host/database/email logs and backups. Record each purpose, provider, access role, storage location and deletion schedule. Collect no government IDs or child photos for this pilot workflow. Keep real inventory/account data in restricted operator records, never this public repository.

Protect operator email, GitHub and Supabase accounts with strong unique credentials and available MFA. Restrict database administration and support-inbox/consent-folder access to authorized operators; review access on role changes. Public client configuration contains publishable keys only. Never commit service keys, SMTP credentials, signed forms, child information or recovery links.

## Provider review

Before sharing child information, determine whether each provider can protect it and obtain/retain appropriate written security assurances and processing terms. Include hosting/CDN, Supabase, outbound email, incoming support mail and consent storage. Record actual logging/backup retention and subprocessors. Investigate any advertising, profiling or unrelated use. No blanket assertion that a provider is COPPA-approved is made here.

## Safeguards and testing

Maintain HTTPS, owner-scoped RLS, live-session checks on sensitive RPCs, rate-limited PINs and session-bound unlocks, hashed child tokens, verified-permission gates, least privilege and clear sign-out/handoff. Do not log raw PINs/passwords/child tokens or email verification links. Test account separation, consent withdrawal, deletion, lost responses and stale sessions before each relevant release. Use disposable fixtures; live irreversible deletion requires explicit confirmation.

Assess risks at least annually: public exposure, compromised operator mailbox, stolen sessions, misconfigured RLS/logging, accidental consent approval, retention beyond purpose, backup restoration resurrecting deleted records, third-party changes and failed support handling. Record likelihood, impact, safeguards, findings and remediation in restricted records. Update the program from those findings.

## Retention and support

Apply the finalized purpose-specific retention schedule, including active vault records, pilot-end review, pending consent requests, signed evidence and other support messages. Record review dates and responsible person. Check mailbox Trash and copies in shared folders when fulfilling deletion, subject to applicable preservation duties. Do not promise provider log/backup erasure earlier than their verified schedules. Reapply deletions and withdrawals to a restored database before service resumes.

Verify a support requester's authority before returning family information or executing administrative deletion. A nickname is insufficient; never request a password/PIN. Use registered-email control and the documented recovery/review process. Keep support messages limited to needed troubleshooting details.

## Incident response

If information may be exposed: restrict affected access, preserve necessary evidence securely, assess scope, rotate compromised secrets, remediate and retest. Determine applicable notification duties with qualified assistance; do not promise a fixed legal notification deadline from this template. Record the incident and changes, and revisit affected provider/access/retention controls.

References: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.8 and section-312.10.
