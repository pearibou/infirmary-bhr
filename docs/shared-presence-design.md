# Shared Drive presence

Implemented in 0.29.0 (2026-11-10). This replaces the previous browser-only counter. It is informational recent-session presence, not proof of attention or a security/authorization mechanism.

## Storage and boundaries

Create app-marked System / Presence folders under the selected private Infirmary-BHR workspace, only after the workspace and individual Google profile are ready. Each subscription/browser session gets a random UUID and one small JSON identity file: schema version, stable Google subject, session ID, chosen display name and email. Last-seen time and a profile fingerprint live in Drive appProperties. Routine heartbeats update metadata on that same file; identity content is fetched only for new/changed profiles. No patient data, tokens or credentials are written to presence files.

Use existing authenticated no-store Drive requests. The directory JSON and clinical spreadsheet schemas are untouched. Do not project presence mutations into the Event Log. Exclude the app-marked presence subtree from any future backup; no ZIP-backup feature is implemented yet.

Cache folder discovery for one minute, paginate listings, and discover all app-marked folders if concurrent first use creates duplicates. After discovering duplicates, use a deterministic folder for new sessions but read all matching folders. This avoids treating folder names as identity and allows a temporary discovery delay. Never move/delete clinical files or unrelated folders.

## Timing and meaning

- Subscribe only during an unlocked, authenticated workspace session.
- Trigger updates alongside successful directory syncs. Coalesce concurrent updates and throttle starts to at least 30 seconds apart, including manual-sync bursts.
- A lightweight timer checks every 15 seconds and initiates a heartbeat when at least 60 seconds have passed since the last attempt. Thus slow/off record syncing still supports presence without secretly syncing clinical records. Browser throttling/suspension can delay timers.
- Count distinct Google subjects with a valid heartbeat less than three minutes old. Prefer the most recent session's display profile. Reject malformed and implausibly future timestamps; device clocks should be correct.
- Refresh on returning to a visible tab or opening the connected-users pane, subject to the same throttle.
- Publish an explicit unavailable/stale state (`?`) after failed reads/writes rather than claiming zero users. Retained names expire; a successful check restores the normal count. Presence failures never reject the record-sync result.

## Leaving and housekeeping

On confirmed logout after final record sync, or explicit disconnect, stop heartbeats and attempt to trash only this session's file. Allow at most 1.5 seconds for cleanup before continuing logout; expiry handles failures, browser crashes and tab closure. Other sessions for the same user remain intact. Late results are guarded and cannot populate a later session.

At most two files older than a day are considered for housekeeping per successful presence read. Re-read metadata, verify the app marker and parent, then trash only still-expired temporary files; ignore cleanup failures. Active sessions whose file was removed can recreate it. Do not remove directory, patient, attachment or staff-profile files.

Recover lost creation responses by searching for the current session marker before creating a replacement, preventing ordinary retries from generating duplicate session files.

## Provider seam and validation

The UI provider contract remains subscribe(onUsers) => unsubscribe. Providers may pass a second status argument containing loading/error/scope. A future central authenticated presence backend can replace the Drive provider without replacing the menu.

Synthetic tests cover separate accounts/browsers, multiple tabs deduplicated, throttle/fallback, stale-session expiry, lost creation responses, logout isolation, network failure isolation and late-result handling. A real deployment still needs ordinary Google sharing/API access; no automatic sharing changes are made.
