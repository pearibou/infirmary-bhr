# Infirmary — Brother Health Records

A dependency-free, single-page PWA with a System 7 Macintosh interface. Directory entries and timestamped notes are saved locally, with explicit Google Drive pull/merge/push sync.

## Run

From this repository, run `npm start` (Node/npm and Python 3 required), then open port 8000 locally. Alternatively serve this directory using any static HTTP server. No install or build step is required. Deploy these files to an HTTPS static host for home-screen installation and offline support. Do not open `index.html` as a file URL.

Use **+ New** to create a person, select them in the directory, and enter notes with Enter or Add. Notes appear oldest first, with timestamps displayed in the device's timezone. **Export JSON** downloads a backup. No sample health records are included.

## People and attached folders

The New person form has last name, first name, preferred name, and separate month/day/year birth-date boxes. At least one name must contain text; all other fields are optional, including individual birth-date boxes. Impossible dates are rejected. Preferred name is used for display when present, with the full legal name below it. Existing records from earlier versions are retained, including their original names and notes. Location is no longer requested or displayed.

Each person's **Drive folders → Attach folder…** supports multiple folder links. Paste a Google Drive folder URL and optional label, or browse using Google's folder picker after connecting. Links persist locally and sync in the directory JSON; attaching a folder does not upload files, move records, grant access, or change folder sharing. Each folder opens in Google Drive in a separate tab. Folder links from both copies are retained during merges.

## Google Drive setup

Until the client ID is configured in `config.js`, actual Google sign-in cannot run. The app explains that setup is missing rather than silently leaving a disabled sign-in button.

To store `people_directory.json` at the top level of your own Drive, sign in, click **Use My Drive (root)**, then **Sync directory**. This choice is remembered and does not require opening the folder picker. It refers to My Drive, not a shared-drive root.

The normal connection flow is **Google Drive… → Continue with Google → Choose directory folder… → Sync directory**. Account selection and consent use Google's actual OAuth popup; folder selection uses Google's actual Picker. Both need one-time application registration by the site administrator. The connection screen does not expose technical configuration fields. A static site cannot supply its own valid Google client identity automatically.

1. Create a Google Cloud project; enable **Google Drive API** and **Google Picker API**.
2. Configure the OAuth consent screen and add test users while the app is in testing. Create an **OAuth 2.0 Web application** client.
3. Add the exact deployed origin to **Authorized JavaScript origins**. For this GitHub Pages deployment use `https://pearibou.github.io` (no repository path). Add `http://localhost:8000` for local development if needed.
4. Create an API key restricted to the Google Picker API and appropriate website referrers (for example `https://pearibou.github.io/*`). Find the project's numeric **project number**, not its text project ID.
5. Put the public client ID, Picker API key, and project number in `config.js`, then commit/deploy. These are public application identifiers; never put an OAuth client secret or access token in source. Connection configuration belongs to the deployment, not the sign-in dialog.
6. After configuring and deploying these identifiers, open Google Drive, continue with Google, choose a writable directory folder, then sync. Per-person folder URLs can be attached without any Google setup.

Sign-in requires a direct click and opens Google's standard popup. Popup cancellation, network errors, or missing configuration are reported without deleting local records. The app itself keeps its retro design; Google's account and picker windows use Google's own interface.

Sync finds `people_directory.json` in the chosen directory folder, validates it, merges people and notes by stable IDs, and uploads the result. A missing file is created; duplicate filenames and conflicting note IDs stop sync. People metadata uses its newest `updatedAt`. Existing note text is immutable. Tokens remain in memory, while public configuration and selected directory folder are remembered locally. Disconnect clears the token; revoke the grant in Google Account permissions when needed.

The app requests the full `drive` OAuth scope so it can find an existing JSON file in an arbitrary folder. Public distribution can require Google's verification/security review for this restricted scope. A production alternative is a `drive.file` implementation with access limited to explicitly selected files. Drive authentication requires a connection; the app shell and local note entry work offline.

Sync is manual and is **not transactional across devices**. Avoid simultaneous sync by multiple users: the second read narrows the race window but cannot prevent a concurrent write. Export backups and enable Drive version history. No automatic background sync or deletion propagation is implemented. OAuth failures and rejected writes leave local records intact.

## Install on a home screen

On iOS Safari, use Share → Add to Home Screen. On supported Android/desktop browsers, use the browser's install action. Installation requires HTTPS (localhost is accepted for development). The service worker caches the local shell only; it does not cache Google API responses. iOS can evict local data, so keep exports or Drive backups. Actual iOS/Android installation should be checked on physical devices before deployment.

## Data handling

Records are stored unencrypted in this browser's localStorage and, only after explicit sync, your selected Google Drive folder. This prototype has no application login, access controls, audit enforcement, or encryption at rest under app control. Use synthetic data for evaluation; deployment with real health records needs an approved security/privacy design and organizational review. Local persistence failures are reported rather than silently discarding records. Other open tabs are blocked from editing after a storage change until reloaded.

JSON format: `{ "version": 1, "people": [...] }`. Each person contains `id`, a compatible display `name`, `firstName`, `lastName`, `preferredName`, `birthDate` (`month`, `day`, `year`, each optional), `driveFolders` (`id`, `name`), `info`, ISO `updatedAt`, and `notes`. Legacy `room` values are preserved but not displayed. Each note contains `id`, `text`, and ISO `createdAt`.

## Validate

- `npm test`: model and mocked Drive API tests.
- With the server running: `python tests/person_drive_browser.py` checks names, birth dates, folder-link persistence, and mocked Google sign-in/Picker interactions. `python tests/clock_browser.py` checks the header.
- `npm run check`: JavaScript syntax checks.
- With the server running: `python tests/browser_smoke.py` uses Python Playwright and `/usr/bin/chromium`. Tests person creation, notes, safe text rendering, persistence, search, offline entry, and mobile overflow. Screenshots go to ignored `artifacts/`.

No package installation is needed for the app or Node tests. Browser-test tooling is a development-only prerequisite. Real Google OAuth, Picker, and sync require your configured Google project and account and are not covered by mocked API tests.

Future tasks should use this existing isolated checkout; no extra Git worktree is necessary. Start the static server again in a new session. Increment the service-worker cache version when changing the offline asset set.
