# Individual Google access and a later central backend

Status: discussion/design only. No login or storage behavior is changed by this document.

## Near-term direction

Use individual staff Google accounts with explicitly shared access to the private Infirmary-BHR Drive folder. The central account keeps ownership. Staff authenticate with their own Google credentials and two-factor verification, without sharing the central account password or requiring its owner's approval for each sign-in.

Adapt and test folder selection, Drive/Sheets scopes and cross-user access. A shared-folder permission does not automatically establish that every API operation currently using drive.file will work for another staff member. Picker authorization and access to existing spreadsheet/document files need explicit verification before release.

Google's file permissions enforce storage access. BHR's interface can apply creator-only rules, but users with direct Drive editing permission can bypass those interface rules and alter the files themselves. This approach is not a server-enforced BHR permission system.

No new account database or Cloud Run deployment is required for this near-term route. Frontend source remains on GitHub; private runtime information remains in Google storage.

## Prepare the boundary now

Keep one frontend and shared models, validation, printing and record IDs. Refactor Google-specific authentication, tokens, file selection and storage details behind application-level operations such as reading medications, saving observations and maintaining staff profiles.

The current adapter would perform direct browser-to-Google operations using the staff member's authorization. A later adapter would call a central backend with a BHR session. Do not make screens depend directly on token handling or backend-specific storage details.

Keep identity, permissions and record storage as separate concerns. Storage selection is an intentional installation setting; a Google outage must never silently switch the application to another backend and create diverging records.

## Later central access

A server could authenticate approved staff, issue protected BHR sessions, enforce permissions on every request, and maintain a separate central Drive connection. Records can remain stored in Drive/Sheets while passing through the backend for authorized access.

This is meaningful backend and migration work, not a complete frontend rewrite. It requires protected persistent configuration/credentials and a decision about account/session storage. Cloud Run instance files are temporary; stopping an instance must not erase approvals or credentials. A small Google-only deployment could use a configured approved-user list instead of a full account database, but secrets still need protected persistence.

After backend-mediated access works, deliberately review/remove direct staff access to central Drive storage. Otherwise those file permissions remain an alternative route around BHR's server rules.

The same application boundary should leave room for a portable local server with SQLite and attachments, plus local accounts or other identity providers. GitHub can remain the development repository independently of live hosting.

## Identity and migration

- Identify Google users by the verified Google issuer/subject identity, not a display name or an email string.
- Maintain an internal BHR user ID with explicit mappings to login identities. The initial implementation may namespace Google identities; the later server must verify and preserve those mappings.
- Preserve existing note/record author IDs and stable record IDs. Do not rewrite historical authorship simply to fit a new login system.
- Link multiple login methods only through explicit verification. Matching names or emails alone is not enough.
- Existing entries created under the shared central Google account cannot reliably be assigned to individual staff retroactively. A nickname is not evidence of who created them.

## Related discussion

See [staff display names](staff-display-names-design.md) for a persistent, user-chosen attribution label independent of authentication and ownership.
