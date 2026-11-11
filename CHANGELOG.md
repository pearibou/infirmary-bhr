# Version history

## Unreleased

- Add a small parenthetical age at the administered dose date beside each resident name in the Immunizations Master List and its printout. Incomplete dates show “Age: —”; no observations are changed.

- Show calculated age and DOB beside the resident name in the individual Immunizations window, and age directly below DOB on its printout. Incomplete dates show an unavailable age; deceased residents retain age-at-death wording.

- Fix Immunizations Master List pairing returned Google Sheets grids with residents by stable sheet ID, regardless of response order. Preserve row-marker validation and reject missing or ambiguous sheet responses.

## 0.31.1 — 2026-11-10

- Move the optional Sex field below birth date on the primary person form while preserving its existing stored field.
- Add optional Social Security Number under Additional information and demographics printing only; omit it from the main chart.
- Show the compact age/sex line (for example, 71 y.o. Male.), retaining age-at-death meaning for deceased residents.


## 0.31.0 — 2026-11-10

- Add Community Rundown: resident/general sections, rich formatting/highlighting, archive/view/edit, independent copies, full readable dates and compact internal-document printing.
- Default new resident photos and file uploads to stable person-marked folders inside Infirmary-BHR, created on first use; preserve explicit upload overrides and existing external files.
- Enlarge The BHR artwork to 68px while preserving its 88px desktop grid cell.


## 0.30.0 — 2026-11-10

- Add Plot trends at the far right of Vital Signs controls, with on-demand SVG graphs, measurement/date-range selection, point details and display-only unit conversion.
- Print temporary graphs using the existing letterhead and browser print dialog; close/logout discards graph state. No vital-sign records or spreadsheet schemas are rewritten.


## 0.29.0 — 2026-11-10

- Implement shared Connected Users across Google accounts/browsers using private System/Presence session files, with per-account deduplication.
- Update alongside sync (30-second minimum), retain a lightweight minute fallback when sync is off/slower, and expire inactive sessions after three minutes.
- Remove the departing session when possible, bound cleanup delay, recover lost-create responses, and show unavailable checks without blocking record sync or logout.


## 0.28.5 — 2026-11-09

- Preserve sticky-note edit/create mode, text, drawing and tools while minimizing/restoring the editor; minimize no longer resets the draft.
- Label the minimized editor with its current task and restore an existing minimized draft when reopening a sticky.


## 0.28.4 — 2026-11-09

- Enlarge the main BHR opening window on desktop browsers to 65% of viewport width and 84% of workspace height, matching the supplied reference proportions.


## 0.28.3 — 2026-11-09

- Use MM/DD/YYYY for immunization date entry/display/printing, with MM/YYYY, year-only and blank values accepted for both administered and next-dose-due dates.
- Preserve existing ISO spreadsheet dates, schema and row markers without migration or loss of date precision.


## 0.28.2 — 2026-11-09

- Make person selection update only the selected row and chart, preserving directory nodes, keyboard focus and sticky notes.
- Avoid formatting the entire audit history while the Event Log is closed; refresh on opening and clear rendered log text when locking.


## 0.28.1 — 2026-11-09

- Make unacknowledged refill alerts blink fully on/off every 0.6 seconds, preserving the clickable button/counter and reduced-motion fallback.


## 0.28.0 — 2026-11-09

- Add chart and desktop Immunizations with individual dose histories, optional additional details, partial historical dates, edit/delete and printing. Create private Immunizations (BHR) workbook/person tabs only when first saving.
- Add searchable master immunization summary with latest dose per vaccine name and deceased persons hidden by default. Next-dose due dates are manual; no source field.
- Show the selected calendar symbol beside its notice in reading mode.
- Show compact legal name, middle initial and DOB beneath patient headings in refill alerts.
- Count only refill alerts needing attention in the menu badge; group deferred reminders separately and move acknowledged items to their own list at the bottom.


## 0.27.2 — 2026-11-09

- Add optional Sex to Additional information, with Male/Female suggestions and free-text entry; include it in viewed and printed demographics.


## 0.27.1 — 2026-11-09

- Restore a fixed retro abbey emblem on the BHR About card, with a subtle pixelated arrow cursor as its technology detail.
- Keep product artwork independent of private organization branding used by menus and printable clinical headers.


## 0.27.0 — 2026-11-09

- Add shared Organization Info in Preferences: name, logo preview/upload and generic-icon fallback.
- Store settings and logo only in the private BHR Drive directory; omit settings from the browser directory cache and clear runtime branding at lock/logout.
- Apply backend branding to the menu, record toolbar, About image and printable document/calendar headers.
- Remove bundled abbey logo assets and fixed facility-name defaults. Existing installations need one-time backend setup; recovered high-resolution artwork is supplied separately for re-upload.


## 0.26.0 — 2026-11-09

- Add browser-local automatic directory sync frequency in Preferences, defaulting to 10 seconds with an Off (not recommended) option; keep access-expiry locking independent of polling.
- Display tiny Synchronizing… text beside the rotating sync arrow throughout directory requests, reserving space to prevent toolbar movement.
- Add subtle horizontal dividers between sections on person records.


## 0.25.0 — 2026-11-09

- Add in-app refill alerts with a retro bottle/exclamation count, gentle attention animation and reduced-motion support.
- Add shared 7-day supply / 30-day prescription-expiration / zero-refill settings through Preferences and alert Settings.
- Add attributed acknowledgment, pending refill requests and shared reminder dates without changing dispensing or clinical medication status.
- Persist mergeable immutable follow-up metadata in private directory JSON; scan existing medication/refill sheets in read-only batches, show incomplete reads clearly and clear alert data at logout.
- Preserve existing medication/refill rows and printing; no spreadsheet migration or re-entry is required.


## 0.24.1 — 2026-11-09

- Enlarge the visible Vital Signs desktop artwork by 50%, compensating for its transparent image margins while preserving the grid cell and label placement.


## 0.24.0 — 2026-11-09

- Show email addresses parenthetically beside display names in the connected-users pane.
- Add a compact retro account-bust menu beside the power button with the signed-in Google email, display name and Edit display name action.
- Clear account details at lock/logout and retain compact top-bar layout across desktop and mobile widths.


## 0.23.0 — 2026-11-09

- Click a patient profile photo, or focus it and press Enter, to open a simple full-image viewer with an uncropped, proportional image and Close/Escape support.
- Reuse authenticated in-memory photo blobs; explain inaccessible Drive photos and clear the viewer on close, disconnect or logout.


## 0.22.1 — 2026-11-09

- Restyle patient chart sections as compact rounded rectangle buttons, with the medical document, stethoscope, pills and double-helix symbols beside their labels.
- Retain the desktop single-row layout and allow wrapping on narrow screens.


## 0.22.0 — 2026-11-09

- Fix GCS responses carrying into new vital-sign entries: explicitly clear hidden values/defaults and selection states for every fresh form, preserving saved scores when editing.
- Add a Medications desktop app with a crisp retro bottle-and-tablets icon and an alphabetized living/deceased patient picker, using existing medication lists, refill tracking and print actions.
- Clear the medication picker on logout and protect unsaved medication drafts when changing patient or reopening the app.


## 0.21.0 — 2026-11-09

- Make the connected Drive dialog glow bright neon green with a much broader halo.
- Add desktop rectangle selection and confirmed bulk deletion, preserving note ownership and empty-folder checks and showing any per-item failures.
- Keep minimized sticky notes beneath windows; expanded sticky-note layering is unchanged.
- Add optional three-column GCS response buttons, pressed selection states, calculated total/interpretation and E/V/M viewing details to Vital Signs.
- Read older vital-sign tabs without GCS and append the three optional columns safely on the next write, preserving existing observations and stable IDs.


## 0.20.0 — 2026-11-09

- Individual Google account selection, explicit existing shared-folder setup and mandatory authenticated attribution before opening the desktop.
- Persistent private per-account display-name preferences, with a change-name control in the Drive dialog. Original Google subject IDs continue to enforce note ownership; historical labels remain unchanged.
- Staff shared-folder selection validates an existing writable directory without creating or migrating a workspace. Owner-only workspace creation remains a separate explicit option.
- Block switching a populated browser directory into another workspace without logging out first. Profiles and account details are cleared from the session on disconnect/logout.


## 0.19.0 — 2026-11-09

- Add Vital Signs from patient navigation and a retro sphygmomanometer desktop icon, with a living/deceased person picker.
- Record dated blood pressure, pulse, respirations, temperature, oxygen saturation/delivery (RA default), height, weight and comments in a private on-demand Vital Signs workbook.
- Show independently latest height/weight and measurement dates on the main chart; support units, backdating, editing/deletion, retry/conflict protection and logout cleanup.

## 0.18.1 — 2026-11-09

- Enlarge The BHR desktop artwork within its unchanged grid slot.
- Highlight the Google Drive dialog with a steady green perimeter glow once connection and directory sync are ready; show connection status explicitly.
- Add About… as the last application-menu item, with a large abbey emblem, system name, release version and copyright; native printing from this dialog includes only its branding.

## 0.18.0 — 2026-11-09

- Start with the desktop after connecting; open The BHR from a new retro computer icon, and close its window with X beside maximize. Retain minimize/restore and window geometry.
- Move Event Log into the application menu with a clipboard icon; remove the desktop caption.
- Add red folder-detach controls and a chart-link warning; sync per-folder state to prevent stale reattachment while preserving Drive files and allowing intentional reattachment.

## 0.17.0 — 2026-11-09

- Add medication refill overview/history, optional dispensing and prescription fields, pharmacy defaults, signed supply estimates, explained manual adjustments and separate warnings.
- Store refills in on-demand per-person tabs in the existing private medication workbook, linked by stable medication IDs; retain existing medication rows and print layouts.
- Add retry-safe creation, stale-update protection, edit/delete attribution, history retention after medication removal, mobile forms and logout cleanup.

## 0.16.2 — 2026-11-09

- Add a per-calendar print symbol picker with 20 outlined medical symbols plus the existing blue Star of Life default. Preserve selection in Drive and omit captions from print.
- Center Area over its column in both calendar print formats.

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
