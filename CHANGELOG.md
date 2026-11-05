# Version history

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
