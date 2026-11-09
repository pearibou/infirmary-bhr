# Persistent staff display names

Status: initial direct-Google implementation shipped in 0.20.0. The migration sections below remain future design.

## Implemented experience

After a staff member signs in with their own Google account, load their BHR profile. If they have no profile yet, offer a custom display name, prefilled from their Google name as a convenient starting point. A familiar label such as a professional title and preferred name can be used.

Use that chosen name for new Created by / Entered by / Edited by attribution throughout BHR: quick notes, clinical documents, stickies, calendar changes, medications, history, refills, vital signs and Event Log actor labels where applicable. The Drive connection dialog includes Change my display name.

On subsequent sign-ins, retrieve the saved profile using the authenticated identity so the name does not need to be entered again, including on a different device using the same BHR workspace.

## Storage without an additional account database

The direct-Google edition keeps one private `staff_profile_<Google subject>.json` per account in the existing Infirmary-BHR folder. Separate files avoid concurrent staff updates overwriting other people. Duplicate files and identity mismatches stop loading/saving. Same-account simultaneous edits use last successful save; this is a preference, not a transactional audit record.

A profile contains schema version, Google issuer/subject, display name and update timestamp. The current stable user ID remains the Google subject; a separate internal BHR ID awaits the future verified backend mapping. It must not contain passwords, Google tokens, login secrets, approval decisions or authoritative roles.

Load profiles after Google authentication. Prefer session-memory caching so a shared device cannot accidentally reuse the previous staff member's name. Handle concurrent profile updates without overwriting other staff profiles; fail visibly and retain the typed name for retry if saving fails.

All staff with direct editing rights to the profile file could technically alter its contents. The file is a convenience profile store, not an authorization boundary or a tamper-proof identity registry. A later backend must enforce profile ownership and verified identity mapping itself.

## Names versus identity

Display names are editable labels, never ownership keys. Use a verified Google subject/issuer mapping and stable BHR user ID for identity. Creator-only edit/delete checks must never compare display-name text. Two staff may choose the same name without becoming the same account; changing a name must not transfer ownership.

A custom name also does not verify someone's professional credentials or prevent impersonation. Keep the authenticated identity available in appropriate account/audit details and retain actor IDs with attribution.

This proposal assumes distinct staff logins. If everyone still signs in as the same central Google account, BHR sees one identity and cannot safely maintain distinct per-staff profiles just from self-entered nicknames.

## Historical attribution

Recommended default: retain the display name used when an entry or edit was made as an attribution snapshot, alongside its stable actor ID. A later name change applies to new actions without rewriting the immutable Event Log or silently changing old records. A future UI may additionally show the actor's current name, clearly distinguished from the historical snapshot.

Do not change existing author IDs to make old central-account notes belong to the newly named staff member. Historical shared-account authorship cannot be reconstructed automatically.

## Future backend migration

Migrate the profile store and verified identity mappings to backend-controlled storage. Preserve BHR user IDs and the relationship to legacy Google author IDs so ownership survives. Google sign-in or a later verified local login should resolve to the same profile when explicitly linked; the display-name preference can therefore survive the transition.

Treat mappings from today's editable shared Drive file as data requiring verification, not proof that someone owns a legacy identity. Do not trust an imported profile that claims another person's author ID.

See [the authentication/storage transition](authentication-and-storage-transition.md) for the broader staged plan.
