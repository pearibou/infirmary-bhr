# Infirmary — Brother Health Records

A dependency-free, single-page PWA with a System 7 Macintosh interface. Directory entries and timestamped notes are saved locally, with explicit Google Drive pull/merge/push sync.

## Run

From this repository, run `npm start` (Node/npm and Python 3 required), then open port 8000 locally. Alternatively serve this directory using any static HTTP server. No install or build step is required. Deploy these files to an HTTPS static host for home-screen installation and offline support. Do not open `index.html` as a file URL.

Use **+ New** to create a person, select them in the directory, and enter notes with Enter or Add. Notes appear oldest first, with timestamps displayed in the device's timezone. **Mepkin Abbey Infirmary → Export JSON** downloads a backup. No sample health records are included.

## Required connection and desktop handoff notes

Every opening shows the Drive connection dialog and hides/disables the workspace until Google sign-in and a successful directory sync finish. Choose a folder or My Drive root after signing in; a remembered location syncs automatically. Escape, the dialog Close button and minimize cannot dismiss the required connection step. A failed initial sync leaves it blocked with a retryable error. Disconnecting or losing the active access token locks the workspace again. This frontend gate is not backend authorization and does not encrypt or remove existing localStorage records.

Right-click an empty desktop area to open its context menu, then choose **New Sticky Note**. Type a handoff message and select **Leave note**. The pastel-yellow card records the connected user's name and syncs immediately into `desktopNotes` in `people_directory.json`; the next connected user of that same Drive directory receives it during their opening sync. Drag cards to move them, or focus a card and use arrow keys. Drag a card to Trash (or focus it and press Delete) for the existing permanent-delete confirmation. Deleted card IDs sync so stale copies cannot restore them. A network failure can leave a handoff pending locally; verify successful sync before expecting the next user to receive it. Cards may contain protected information, so none are written into source, GitHub, logs or app-shell caches.

## Log out

The power symbol at the far right of the top bar opens a small dimmed-screen confirmation: **Do you want to log out?** **Cancel** or Escape keeps the session and draft; **Log out** clears the in-memory Google connection, aborts pending Drive requests, clears unsent editor/file drafts and photo previews, and returns to the mandatory connection window. A completed old sync cannot unlock the logged-out workspace. Saved records remain intact in local storage/Drive. Logout activity is recorded locally and may remain pending until the next connection. This logs out of the BHR connection, not every Google website or the browser's Google account; future backend staff sessions will be separate from the central Drive connection.

## Event Log

Double-click the clipboard icon at the top right of the desktop (or focus it and press Enter) to open the read-only Event Log window. Events appear newest first and record actor, UTC creation time, action, affected entry ID, and changed field names. Record creation/updates/deletion, clinical note entry/edits/deletion, folder attachment changes, profile-photo and other uploads, sticky creation/movement/deletion, Drive connections/disconnections and directory-location selections are recorded. Read-only viewing, mouse movements, window geometry and unchanged periodic syncs do not add noise. Logging begins with this version; past activity cannot be reconstructed retroactively.

Data mutations and their event metadata are saved together in browser directory JSON. Existing event IDs cannot be edited or removed through normal application actions, including deleting a person or note. Cross-user sync unions entries and rejects changes under an existing event ID. Clinical note text, record field values, attachment bytes and credentials are not copied into the log. File IDs, person IDs and staff identities remain protected information. Only synthetic test metadata belongs in source.

Successful directory sync maintains `eventLog` in `people_directory.json` and a separate UTF-8 **BHR_event_log.txt** in the same selected Drive folder. The text file is a compact tab-separated document with quoted/escaped string fields, newest first; it is human-readable and can be safely re-read. Existing events from both copies are recovered and merged before writing. Duplicate log filenames or an unrecognized/changed log stop sync rather than overwrite unknown history. If publishing the text copy fails after JSON saves, the app reports incomplete sync and retries later. Offline actions and disconnect events can remain locally pending until the next successful connection/sync.

“Immutable” here means append-only events and a read-only app interface, not tamper-proof storage. A user with direct Drive/localStorage access can alter or delete files outside the app. Client timestamps can be inaccurate, JSON/text writes are not atomic, simultaneous clients still have the existing Drive-write race, storage failures can prevent an event being durably recorded after an upload, and old app versions can discard new fields. Production enforcement, durable atomic audit recording, trusted timestamps and retention policies require the planned backend. Update all clients before relying on this log. No raw record values are retained in event text when an entry is deleted.

Shared desktop stickies remain removable by **any connected user**, regardless of creator. Only individual chronological clinical notes have the original-author deletion restriction.

## File uploads and protected information

On a person's page choose **Upload file…**. Attach a Drive folder first and connect Google. With one attached folder it is selected automatically; with several, explicitly select the destination. The browser accepts any file type and sends the file directly to Google's Drive resumable upload endpoint. No application server, GitHub API, repository file, localStorage entry, or service-worker cache receives the file contents. Files remain in memory only as browser File handles during selection/upload. A duplicate name creates a separate Drive file, not an overwrite. Upload failures retain the selection for retry; check Drive first if a timeout leaves the outcome uncertain. Drive permissions, quotas and browser/network limits still apply. The upload timeout is five minutes. This version does not resume an interrupted transfer.

Only frontend source, public configuration, documentation and synthetic test fixtures belong in this repository. All real person information, notes, birth dates, directory JSON and attachments are protected runtime data; never put them in source, fixtures, logs, screenshots, issue reports or commits. `people_directory.json`, `BHR_event_log.txt`, `uploads/`, local environment files and logs are ignored as an additional guard, not an access-control mechanism. Browser directory storage remains unencrypted; attachments themselves are not persisted locally by the app. Google Drive authentication and server-side access controls must be part of the production login design.

The top bar uses a monochrome System 7-style recreation of the supplied abbey emblem and the name **Mepkin Abbey Infirmary**.

## Windows and ages

Age appears below date of birth, calculated from a complete date in the device timezone; incomplete/invalid dates show no calculated age. Ages refresh while open. February 29 birthdays increment on March 1 in non-leap years.

On desktop screens at least 1000 px wide, the main window starts around 60% of screen width and 80% of available height, leaving more visible desktop. Smaller screens retain the responsive layout. Drag a title bar to move the main window or a dialog, use its minus button to minimize, and click its button in the bottom dock to restore. Drag the lower-right resize corner to resize. Focus a title bar and use arrow keys to move it with the keyboard. The square maximize button fills the viewport below the top menu; pressing it again restores the previous size and position, including a manually resized window. The bottom status bar remains in the window frame while directory/detail contents scroll. Browser resizing keeps windows reachable and adjusts a maximized window to the available workspace. Mobile touch resizing depends on browser support.

## Desktop and permanent deletion

Desktop icons occupy a grid anchored at the top right, filling downward before creating another column to the left. Future `.desktop-icon` elements added to `#desktop-icons` use the same grid. Event Log occupies the first top-right grid slot; Trash is separately anchored at the bottom right and comes forward during an entry drag so it can receive drops even when the main window is maximized.

Drag a directory listing or your own chronological note onto **Trash**. Individual chronological notes can only be dragged/deleted by their original connected Google account; legacy/unattributed notes cannot be individually deleted. Ownership is checked again when confirming, so a stale dialog cannot authorize a different account. Shared desktop handoff notes remain trashable by any connected user. The dialog asks **ARE YOU SURE YOU WANT TO PERMANENTLY DELETE THIS ENTRY?** Cancel is focused by default; only confirming removes the entry. Deleting a person also removes their notes and revision histories from this directory. There is no undo or recoverable in-app trash. For keyboard access, focus a person or note and press Delete. On touch devices, tap an entry to select it, then tap Trash for the same confirmation.

Deletion removes record content from local directory storage and propagates to the selected directory JSON on the next successful sync. Minimal deletion markers contain only person/note IDs, allowing updated clients to reject stale copies instead of resurrecting deleted entries. Attached Drive folders/files/photos, previously exported backups, and Drive version history are **not** deleted. This is not a secure-erasure guarantee for external copies. All clients must update to this version to honor deletion markers; old app versions can discard new metadata. Person/shared-desktop-note deletion remains available after confirmation; individual chronological-note deletion requires its original connected Google author. Production role/author authorization still belongs in the planned backend.

## People and attached folders

The New/Edit person form has last name, first name, optional middle name/initial, preferred name, and separate month/day/year birth-date boxes. At least one name must contain text; all other fields are optional, including individual birth-date boxes. Impossible dates are rejected. Preferred name is used for display when present, with the full legal name below it. Existing records from earlier versions are retained, including their original names and notes. Location is no longer requested or displayed. Middle name is saved and searchable, and appears between first and last names in directory and record full-name subtitles. Preferred display names remain unchanged; there is no separate middle-name detail line. The original requirement of at least one first, last, or preferred name still applies.

Living people appear first, followed by a heavy divider and deceased entries in muted plum. Both groups sort by last name, then first name, ignoring case. Entries without a last name fall back to their current display name; names are not guessed from legacy text. The divider is a button that collapses/expands deceased entries. It stays available whenever deceased entries match the search, even if no living entries match, and remembers its state on the device. Deceased people have a crucifix beside the avatar. The deceased checkbox directly enables the date input without an extra death-record heading.

Each person's **Drive folders → Attach folder…** supports multiple folder links. Paste a Google Drive folder URL and optional label, or browse using Google's folder picker after connecting. Links persist locally and sync in the directory JSON; attaching a folder does not upload files, move records, grant access, or change folder sharing. Each folder opens in Google Drive in a separate tab. Folder links from both copies are retained during merges.

## Editing records, notes, and profile photos

Use the small **✎** at the right of a directory entry or record header to edit the person. Names, birth date, additional information, deceased status, and photo can be changed without replacing notes or attached folders. A record changed by sync while its editor is open must be reopened before saving, preventing silent overwrites.

Check **This person is deceased** to enable the separate death month/day/year boxes. Enter only known parts: month, year, month/year, month/day or a full date are supported. A day without a month is rejected, including day/year. Unknown parts stay blank. Invalid dates and known-impossible future or pre-birth ranges are rejected; no day or year is invented. Deceased records show **Age at death**, calculated only with complete birth/death dates; their age does not keep increasing. Unchecking deceased clears the saved death date.

Both New person and Edit record accept JPEG, PNG, WebP, or GIF profile photos up to 10 MB. Connect Google before saving a photo. Its destination is automatic: the person’s first attached Drive folder, or My Drive (root) when no person folder is attached. There is no photo-folder selector. The directory-sync folder and a previous photo’s folder do not override this rule. Photos upload directly to Drive only when the form is saved. Directory JSON contains only `{fileId, folderId}` references: no base64, image bytes, public sharing URLs, or access tokens. Photos are fetched using the in-memory Google token and displayed via temporary object URLs; initials remain the fallback offline, signed out, or when an image is unavailable. Existing photos are not deleted when replaced. A failed local save after a successful upload can leave an unreferenced photo in Drive; review it there rather than automatically deleting files.

New signed-in notes show **Entered by [Google account name]** next to the timestamp. The stable Google account subject identifies ownership; a display name alone is not used for permission checks. Only that connected account sees the note's pencil and can save an edit. The original timestamp/text, every revision, editor, and edit time are retained in **View edit history**. Signing out or switching accounts removes access to the previous author's editing controls. Legacy and signed-out notes are explicitly unattributed and cannot be edited or retroactively claimed. Signed-out quick entry remains available, with a hint explaining attribution.

These ownership checks and history validation run in the browser. They are useful application behavior, **not tamper-proof authorization or an enforced audit trail**: people with direct Drive/file access can change JSON outside the app. The proposed authenticated backend must enforce author ownership on the server before using this as a protected production records system. New Google consent may be requested for the identity scopes. If identity lookup fails, Drive can remain connected, but new notes stay unattributed and editing is unavailable.

## Google Drive setup

Until the client ID is configured in `config.js`, actual Google sign-in cannot run. The app explains that setup is missing rather than silently leaving a disabled sign-in button.

To store `people_directory.json` at the top level of your own Drive, sign in, click **Use My Drive (root)**, then **Sync directory**. This choice is remembered and does not require opening the folder picker. It refers to My Drive, not a shared-drive root.

The normal connection flow is **Mepkin Abbey Infirmary → Google Drive… → Continue with Google → Choose directory folder… → Sync directory**. Account selection and consent use Google's actual OAuth popup; folder selection uses Google's actual Picker. Both need one-time application registration by the site administrator. The connection screen does not expose technical configuration fields. A static site cannot supply its own valid Google client identity automatically.

1. Create a Google Cloud project; enable **Google Drive API** and **Google Picker API**.
2. Configure the OAuth consent screen and add test users while the app is in testing. Create an **OAuth 2.0 Web application** client.
3. Add the exact deployed origin to **Authorized JavaScript origins**. For this GitHub Pages deployment use `https://pearibou.github.io` (no repository path). Add `http://localhost:8000` for local development if needed.
4. Create an API key restricted to the Google Picker API and appropriate website referrers (for example `https://pearibou.github.io/*`). Find the project's numeric **project number**, not its text project ID.
5. Put the public client ID, Picker API key, and project number in `config.js`, then commit/deploy. These are public application identifiers; never put an OAuth client secret or access token in source. Connection configuration belongs to the deployment, not the sign-in dialog.
6. After configuring and deploying these identifiers, open Google Drive, continue with Google, choose a writable directory folder, then sync. Per-person folder URLs can be attached without any Google setup.

Sign-in requires a direct click and opens Google's standard popup. Popup cancellation, network errors, or missing configuration are reported without deleting local records. The app itself keeps its retro design; Google's account and picker windows use Google's own interface.

Sync finds `people_directory.json` in the chosen directory folder, validates it, merges people and notes by stable IDs, and uploads the result. A missing file is created; duplicate filenames and conflicting note IDs stop sync. People metadata uses its newest `updatedAt`. Original note text is immutable; author edits are stored as append-only revisions. Sync combines compatible revision chains and stops on competing edits rather than silently picking a winner. Tokens remain in memory, while public configuration and selected directory folder are remembered locally. Disconnect clears the token; revoke the grant in Google Account permissions when needed.

The app requests `openid email profile` to identify the connected Google account for note attribution, plus the full `drive` OAuth scope so it can find an existing JSON file in an arbitrary folder. Public distribution can require Google's verification/security review for this restricted scope. A production alternative is a `drive.file` implementation with access limited to explicitly selected files. A fresh app opening requires Google authentication, a directory location and a successful initial sync. The cached interface can load offline, but its workspace remains blocked until that connection succeeds. After a successful opening, brief offline note entry is possible while the in-memory Google session remains valid; reopening or expired access requires reconnection.

Sync runs every 10 seconds while the app is visible, online, connected to Google, and a backend folder is selected. The top-bar **↻** and **Sync directory** also trigger it manually. Requests never overlap in one tab; drafts and notes entered during a request are retained. Automatic sync never opens OAuth popups: reconnect manually when the in-memory access token expires. Google can throttle requests; sync failures leave local records intact. Sync is **not transactional across devices**. Avoid simultaneous sync by multiple users: the second read narrows the race window but cannot prevent a concurrent write. Export backups and enable Drive version history. Hidden/closed apps do not sync, and confirmed deletions propagate using ID-only deletion markers. OAuth failures and rejected writes leave local records intact.

## Install on a home screen

On iOS Safari, use Share → Add to Home Screen. On supported Android/desktop browsers, use the browser's install action. Installation requires HTTPS (localhost is accepted for development). The service worker caches the local shell only; it does not cache Google API responses. iOS can evict local data, so keep exports or Drive backups. Actual iOS/Android installation should be checked on physical devices before deployment.

## Data handling

Records are stored unencrypted in this browser's localStorage and, after manual or automatic sync while connected, your selected Google Drive folder. This prototype has no application login, access controls, audit enforcement, or encryption at rest under app control. Use synthetic data for evaluation; deployment with real health records needs an approved security/privacy design and organizational review. Local persistence failures are reported rather than silently discarding records. Other open tabs are blocked from editing after a storage change until reloaded.

JSON format: `{ "version": 1, "people": [...] }`. Each person contains `id`, a compatible display `name`, `firstName`, optional `middleName`, `lastName`, `preferredName`, `birthDate` (`month`, `day`, `year`, each optional), `driveFolders` (`id`, `name`), `info`, optional `deceased`, `deathDate` as optional month/day/year parts (legacy ISO date-only strings are still read), optional Drive `photo` reference, ISO `updatedAt`, and `notes`. Optional directory-level `deleted` metadata contains `people` IDs and `{personId,noteId}` note markers, and optional desktop-note IDs. Optional top-level `eventLog` stores append-only activity metadata. Optional top-level `desktopNotes` stores shared handoff text, author, timestamps and desktop coordinates. Legacy `room` values are preserved but not displayed. Each note contains `id`, original `text`, ISO `createdAt`, optional `authorId`/`authorName`, and an append-only `edits` chain (`id`, `parentId`, `text`, `editedAt`, `editorId`, `editorName`).

## Validate

- `python tests/logout_browser.py` checks power-button placement, confirmation/cancel and logout during pending sync.
- `python tests/event_log_browser.py` verifies icon/window behavior, JSON/text history recovery, event coverage and cross-user sticky deletion using a synthetic backend.
- `python tests/startup_sticky_browser.py` verifies connection hard stops, partial dates, collapse preferences and two-user sticky-note sync/deletion with a synthetic Drive backend.
- `python tests/directory_browser.py` checks group/surname sorting, plum entries, crucifix, middle-name editing and unchanged display names.
- `python tests/desktop_trash_browser.py` checks maximize/restore, pinned footer, desktop grid, drag cancellation/confirmation and sync against stale copies.
- `npm test`: model and mocked Drive API tests, including ownership, edit-history merging/conflicts, death dates, photo references, age boundaries and uploads.
- With the server running: `python tests/records_browser.py` checks person editing, deceased records, account switching, note revisions, and Drive photo behavior with synthetic records and in-memory generated image bytes.
- `python tests/windows_sync_browser.py` checks desktop controls and 10-second sync; `python tests/upload_browser.py` checks direct Drive upload using synthetic bytes.
- With the server running: `python tests/person_drive_browser.py` checks names, birth dates, folder-link persistence, and mocked Google sign-in/Picker interactions. `python tests/clock_browser.py` checks the header.
- `npm run check`: JavaScript syntax checks.
- With the server running: `python tests/browser_smoke.py` uses Python Playwright and `/usr/bin/chromium`. Tests person creation, notes, safe text rendering, persistence, search, offline entry in an active session, blocked fresh offline startup, and mobile overflow. Screenshots go to ignored `artifacts/`.

No package installation is needed for the app or Node tests. Browser-test tooling is a development-only prerequisite. Real Google OAuth, Picker, and sync require your configured Google project and account and are not covered by mocked API tests.

Future tasks should use this existing isolated checkout; no extra Git worktree is necessary. Start the static server again in a new session. Increment the service-worker cache version when changing the offline asset set.

## Login architecture (proposal; not implemented)

GitHub Pages publicly serves the frontend. A JavaScript-only password screen would not enforce access to the site or protect browser-stored health records. Google Drive authorization currently protects only access to Drive, not the page itself. API keys and OAuth client IDs are public identifiers, not login credentials.

For a staff-only application, move the frontend behind an authenticated host/access gateway and use Google sign-in with an explicit allowlist of staff accounts. A small backend should verify identity tokens, issue secure HttpOnly sessions, enforce authorization on every data request, and manage the organization's Drive access server-side. The backend can retain refresh credentials securely so staff sign-in and the shared Drive connection are separate. Never embed refresh tokens or a shared account password in this repository. Choose the hosting/identity provider and authorized staff list before implementing this design.

With login, the local/offline cache also needs an explicit policy: avoid unencrypted health records in localStorage on shared devices; clear or lock user data on sign-out, and determine whether authenticated offline use is allowed. Protecting the hosted URL alone does not revoke records already cached on a device.


### Logout and presence

The top-bar power button confirms logout, waits for any active sync, then performs a fresh final sync before disconnecting. A failed final sync keeps the session open for retry; Cancel becomes available again. Unsaved input drafts are not posted automatically. Closing a tab or browser does not run this logout flow.

**Connected Users: N** opens a compact list. Currently it reports only the authenticated session in this browser, not all people using the shared Drive account. `presence.js` exports `setPresenceProvider(provider)` for future shared presence: `provider.subscribe(onUsers)` emits arrays of `{id, name}` and returns an unsubscribe function. The provider starts only during an unlocked session and stops at logout; stale callbacks are ignored. Supply this from a future authenticated backend with session expiry/heartbeats and authorization, without writing presence to the clinical directory or GitHub.
