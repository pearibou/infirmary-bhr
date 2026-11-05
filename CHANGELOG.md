# Version history

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
