# Version history

## 0.6.1

- Limited chronological-note trash dragging and deletion to the original connected author, with checks at confirmation and in the data operation. Shared desktop-note trash behavior is unchanged.

## 0.6.0

- Added precision-preserving partial death dates and rejected isolated days.
- Made the deceased divider collapsible with a device-local preference.
- Added desktop context menu and shared pastel-yellow handoff notes, movable and trashable with synced deletion markers.
- Required Google connection and successful initial directory sync before workspace access; disconnect/expired sessions lock it again.

## 0.5.1

- Grouped living/deceased directory entries, each sorted by surname, with a heavy divider and muted plum deceased styling.
- Added optional middle name/initial in New/Edit/search without changing display names.
- Simplified death-date labels and added a crucifix beside deceased persons’ avatars.

## 0.5.0

- Added true maximize/restore with previous geometry and a status bar pinned to the window frame.
- Added desktop Trash and a reusable icon grid anchored at the top right.
- Added person/note drag-to-trash and keyboard/tap deletion with explicit permanent-delete confirmation.
- Added ID-only deletion markers so stale directory copies cannot restore deleted content in updated clients. Drive files and external backups remain untouched.

## 0.4.1

- Removed profile-photo folder selection. New/replacement photos automatically upload to the person’s first attached Drive folder, falling back to My Drive root.

## 0.4.0

- Added directory/header pencils and a shared New/Edit record form preserving notes and folders.
- Added deceased status, illuminated date-of-death controls, date validation and age at death.
- Added Drive-only profile photos with initials fallback and metadata-only directory references.
- Added Google-account note attribution and author-only editing with append-only history and conflict-preserving sync. Legacy/signed-out notes remain unattributed and noneditable.
- Added synthetic model/API/browser coverage. Ownership remains browser-enforced pending the planned authenticated backend.

## 0.3.0 — 2026-11-05

- Added derived ages with birthday-aware calculation and partial-DOB handling.
- Added movable/resizable main window and dialogs, minimize/restore dock, and reset controls.
- Added top-bar sync and 10-second visible-session autosync with overlap prevention, no automatic OAuth prompts, and draft/concurrent-note preservation.
- Added arbitrary-type, direct browser-to-Drive file uploads to the selected person’s attached folder; file bytes are not saved to browser storage or GitHub.
- Documented protected runtime-data boundaries and a proposed staff login/backend architecture; login is not implemented.

## 0.2.4 — 2026-11-05

- Added Use My Drive (root) for backend directory storage without selecting a child folder.

## 0.2.3 — 2026-11-05

- Configured the supplied public Google Picker API key and project number.
- Refreshed versioned assets and offline cache so deployments load the completed Google configuration.

## 0.2.2 — 2026-11-05

- Configured the supplied public Google OAuth web client ID.
- Deployment identifiers now override stale remembered settings while retaining selected folders.
- Picker API key and project number remain unconfigured; live consent requires account-side verification.

## 0.2.1 — 2026-11-05

- Removed technical connection settings from the user dialog.
- Fixed misleading hourglass and permanently disabled sign-in state; missing deployment setup is explained explicitly, and SDK failures can be retried.
- Google connection still requires real deployment application identifiers; no credentials or OAuth client IDs are invented.

## 0.2.0 — 2026-11-05

- Added friendly Google sign-in flow, native Google folder picker, and collapsed administrator settings with deployment-wide public configuration.
- Added multiple per-person Drive folder links, picker attachment, and attachment-preserving merges.
- Replaced location/full-name entry with last, first, preferred names and optional separate birth-date boxes; only one name is required.
- Preserved legacy directory records; added validation and browser coverage for new forms and mocked Google interactions.

## 0.1.3 — 2026-11-05

- Switched the live clock to 12-hour time with AM/PM and bold time text.

## 0.1.2 — 2026-11-05

- Isolated the live clock from application/module startup failures.
- Versioned header assets to avoid stale mobile styles hiding the clock.
- Kept the date/time on a separate header row through tablet widths.

## 0.1.1 — 2026-11-05

- Renamed the top-left label to Mepkin Infirmary.
- Added a live local clock: weekday, two-digit day, full month, year, and 24-hour time with seconds, visible on desktop and mobile.

## 0.1.0 — 2026-11-05

- Added System 7 desktop styling, responsive directory, person details, and timestamped notes.
- Added local persistence, JSON export, storage error protection, and cross-tab edit guards.
- Added Google OAuth and manual Drive JSON merging with validation and duplicate-file protection.
- Added PWA manifest, app icons, offline shell, tests, and deployment instructions.
- Known limits: manual nontransactional sync; real OAuth and physical-device installation await configured deployment checks.
