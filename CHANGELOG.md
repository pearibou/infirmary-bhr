# Version history

## 0.16.1 — 2026-11-09

- Match the reference calendar’s print-only palette: pale-yellow week heading, light-gray day headers, white rows, dotted gray rules and black administrator divider.
- Add a compact blue Star of Life beside the calendar print disclaimer in public and administrator copies; wait for the emblem before fitting the one-page layout.

## 0.16.0 — 2026-11-09

- Open saved clinical note files in a readable viewing mode with title, timestamps and formatted content; hide editing fields and toolbar.
- Add a pencil Edit note button for the original author only. New notes and resumed unsaved drafts open in editing mode; saving switches to viewing mode.
- Recheck note ownership in edit/save handlers, retain creator-only deletion, and clear reading headers on logout.

## 0.15.0 — 2026-11-09

- Add shared sticky editing, right-click Edit/Minimize/Trash, and a local minimized-note strip below the menu bar.
- Add sticky-only drawing tools with ink colors, brush sizes, undo and clear; persist validated strokes through Drive sync and clear drawing state on logout.
- Preserve original sticky creators, attribute edits, and merge content separately from position updates; document future drawing-editor ideas.

## 0.14.1 — 2026-11-09

- Rename Calendar Maker to Weekly Appts on the desktop, window titles, accessibility labels and connection message.

## 0.14.0 — 2026-11-09

- Open saved appointment calendars in a readable day-by-day view with compact appointment cards and separated administrator details.
- Add pencil Edit calendar and View calendar controls; saving returns to reading mode and switching protects unsaved drafts.
- Keep print layouts unchanged; printing a saved reading view does not rewrite the calendar. Clear reading content on logout.

## 0.13.6 — 2026-11-09

- Rename the medication editor field to Medication name and align its help/validation wording.
- Expand refill-tracking discussion notes with compact layout, overdue estimates, unknown-versus-zero values and prescription identifier handling.

## 0.13.5 — 2026-11-09

- Use the standard arrow over clinical quick notes instead of the platform-dependent grab cursor, preserving author-only drag-to-trash and edit-button pointers.

## 0.13.4 — 2026-11-09

- Add optional Race/ethnicity and Nationality fields to Additional information, demographics display, printouts, and Drive synchronization.

## 0.13.3 — 2026-11-09

- Put Include Sunday before Include Saturday in Calendar Maker.
- Add New note to each chart’s Clinical notes section, using the existing rich-text editor and attaching the saved note directly to that patient; keep patient-specific drafts separate.

## 0.13.2 — 2026-11-09

- Simplify Calendar Maker’s desktop icon with clean outlines and restrained colors matching the other desktop icons; preserve the original pixel artwork as `icons/calendar-maker.png`.

## 0.13.1 — 2026-11-09

- Start new appointment calendars on Sunday; show optional Sunday before Monday in the editor and printouts.
- Preserve dates and weekend settings in previously saved Monday-based calendars, explicitly labeled as archived format.

## 0.13.0 — 2026-11-09

- Add Calendar Maker beside Event Log, with weekly appointment editing and a saved-calendar archive in the private Infirmary-BHR Drive folder.
- Separate public and administrator appointment fields; independent weekend print toggles retain all saved entries.
- Save before native browser printing; fit public portrait and administrator landscape reports to one Letter page, refusing unreadably dense calendars instead of clipping.
- Protect drafts on save failures, reject stale overwrites, avoid duplicate files on retry, and clear calendar content on logout.

## 0.12.4

- Remove the scheduling/timezone explanation from the medication print report.

## 0.12.3

- Match medication startup batch results to permanent sheet IDs rather than response positions, preventing rows from being checked against another patient’s metadata. Reject missing/ambiguous matches without writes.
- Identify the affected person when a genuine startup check fails; keep clinical cells and row markers unchanged.

## 0.12.2

- Omit duplicate name/DOB table rows from Medical History and medication reports while retaining the patient header and repeated column headings.
- Add a prominent plus to Add medication; group PRN frequencies last, with a pastel green card background and As needed divider. Apply the same ordering to reports and regroup after frequency edits.

## 0.12.1

- Show Medical History as monospaced code — diagnosis name, omit per-entry catalog labels, and emphasize Add diagnosis with a plus sign.
- Add refreshed letterhead printing for Medical History, with monospaced codes and failure-safe print blocking.
- Default to textured light French Blue and add a desktop background chooser with preview, cancel, presets and a device-only saved color.

## 0.12.0

- Add private Sheets-backed Medical History with on-demand workbook/person tabs, add/edit, optional partial onset, uncoded conditions and confirmed deletion; omit status.
- Bundle 74,706 public ICD-10-CM leaf codes for local condition/code search. Clearly label the historical FY2026 April edition and preserve official title/code/edition separately from custom display names.
- Retain failed forms, detect conflicting/shifted rows using stable metadata, make retries idempotent, log metadata-only changes and clear history forms/lists on logout.

## 0.11.1

- Reorder demographics details as requested and shorten the displayed e-mail label to E-mail address.

## 0.11.0

- Simplify pharmacy display; add optional primary care provider/e-mail fields, printer icons, top-right upload action and bottom-of-chart Drive folders.
- Rename Clinical quick notes and Clinical notes, show newest entries first, hide quick-note history while retaining edit timestamps and internal revisions, and support corrected quick-note event dates without changing original provenance.
- Add creator-only editor Trash buttons, confirmation for unsaved-note discard, and letterhead printing of plain/formatted note drafts. Show clinical document icons and compact creation timestamps.

## 0.10.1

- Constrain printed tables to page width with explicit columns and a practical print-frame viewport; tighten letterhead, margins and row spacing.
- Use side-by-side demographics/pharmacy sections, hanging address alignment, optional square Drive photos and no duplicate identity row in authorized contacts. Clear photo object URLs after printing/logout.
- Add optional pharmacy address, phone and fax; remove the redundant Face Sheet link.

## 0.10.0

- Add browser printing for medications and demographics with transparent, print-only abbey letterhead, patient identity, allergies, timestamps and repeated table headings. Refresh medications before printing; block stale or pending course updates.
- Add Additional Information tabs with language, religion, origin, address, phones, pharmacy, authorized/emergency contacts and multiple insurance policies; display in a dedicated Demographics window and retain protected sync/audit/logout handling.
- Select the first living person alphabetically by surname at session start, independent of stored record order.

## 0.9.2

- Search row-scoped Sheets developer metadata explicitly before reading or changing medication entries; recover already-saved entries without duplicating them.
- Make the synthetic Sheets GET response omit row metadata so the browser test exercises the real lookup path.

## 0.9.1

- Correct Sheets metadata creation requests for workbook setup, person tabs and medication rows; validate request shapes in the synthetic backend.

## 0.9.0

- Add chart navigation and a Sheets-backed Medications window with on-demand surname/initial tabs, Active/Discontinued views, add/edit, discontinuation and confirmed deletion.
- Add indication/prescriber and timezone-aware short courses, checked at connection and list opening; preserve failed drafts and show pending completions.
- Use stable sheet/row IDs, conflict checks, metadata-only activity logging and logout cleanup; keep all medication contents in Google.

## 0.8.6

- Preserve unsaved clinical-note drafts in memory when switching notes instead of asking to discard them; restore editing focus when reopening and expose unfinished work through Resume Unsaved Note….
- Show a protected loading state immediately and scope file deletion shortcuts to file icons outside an opening/open editor. Clear paused drafts on disconnect/logout.
- Keep the existing empty-folder-only Trash restriction.

## 0.8.5

- Lift the note formatting toolbar 3px and add a small gap above the editor focus outline.

## 0.8.4

- Reflect the current selection/caret formatting with depressed toolbar buttons, including keyboard changes and mixed selections.
- Replace list labels with compact bulleted/numbered SVG icons while retaining accessible names.

## 0.8.3

- Create/reuse Infirmary-BHR for directory, Event Log, desktop notes/folders and fallback photos; the BHR desktop now represents that folder.
- Move recognized legacy BHR files without changing Drive IDs, keep assigned destinations intact, and stop safely on duplicate/conflicting storage copies.
- Make partial upgrades retryable and preserve migrated photo references through directory merges.

## 0.8.2

- Integrate main branch edits, preserving the minimized main-window label “Brother Health Records - Main.”
- Give each folder its own movable, resizable window and independent contents; opening an existing folder restores/focuses its window.
- Show live folder names and small folder icons in the dock, preserve geometry on restore, and refresh/clear all folder windows together.
- Allow dropping files into another folder window while retaining author checks and sticky-note foreground placement.

## 0.8.1

- Ellipsize desktop/folder icon names without clipping artwork; show full names in a small white hover/focus tooltip.
- Mark deceased people in chart attachment choices and separate the living/deceased groups with a thin non-selectable divider.

## 0.8.0

- Save the agreed medication-list plan in docs/medication-list-design.md for later implementation.
- Add Drive-root rich-text clinical notes, native nested folders, desktop grid icons, rename/move/trash actions and chart links. Clinical notes are editable/deletable only by their creator; folders must be empty before deletion.
- Preserve drafts on write failure, check stale Drive versions, sanitize formatting, and clear all document UI/memory on disconnect/logout.

## 0.7.9

- Add optional allergies text and No known allergies checkbox to person records; show the selected state below age, sync fields and log changes without clinical values.

## 0.7.8

- Enlarge the sync arrow and rotate it clockwise throughout sync without changing top-bar height; add a subtle rounded border around Connected Users.

## 0.7.7

- After final sync, logout clears protected browser storage, records, drafts, photo URLs and other open BHR tabs; failed sync/cleanup retains data for retry.
- Sync logout-request history before clearing, keep only frontend shell caching, and prevent stale requests from restoring cleared data.

## 0.7.6

- Wait for a fresh, successful final Drive sync before logout; keep the session open with retry on failure.
- Add compact Connected Users dropdown showing the current browser session, with a replaceable subscription provider for future shared presence.

## 0.7.5
- Move Google Drive and Export JSON into a keyboard-accessible System 7 application menu under Mepkin Abbey Infirmary.

## 0.7.4

- Replaced the downscaled raster header emblem with a dedicated 28-pixel SVG, simplifying branches and strengthening the roof/water shapes without increasing display size.

## 0.7.3

- Moved Event Log to the top-right desktop grid and pinned Trash to the bottom right.
- Replaced the diamond with a monochrome pixel-style recreation of the supplied abbey emblem.
- Updated branding to Mepkin Abbey Infirmary and adjusted responsive header spacing.

## 0.7.2

- Added a right-aligned power button and dimmed Log out/Cancel confirmation.
- Logout records the actor, clears the BHR connection and drafts, aborts pending Drive requests and prevents stale syncs from reopening the workspace.

## 0.7.1

- Applied a compact GitHub-style monospace font stack and tighter line spacing only to Event Log text.

## 0.7.0

- Renamed the desktop command to New Sticky Note; confirmed any connected user can trash shared stickies.
- Added an Event Log clipboard icon below Trash and a read-only, newest-first log window.
- Added append-only change metadata, cross-user immutable-ID merging/recovery and a protected BHR_event_log.txt copy in Drive. Clinical content and file bytes are excluded.
- Documented frontend-only audit limitations and added model/API/browser coverage.

## 0.6.3

- Included middle name/initial in directory and record full-name subtitles, removing the separate middle-name detail label. Preferred display names are unchanged.

## 0.6.2

- Reduced the main window’s initial desktop size to roughly 60% of viewport width and 80% of available height, retaining responsive sizing and maximize/restore.

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
