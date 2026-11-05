# Infirmary — Brother Health Records

A dependency-free, single-page PWA with a System 7 Macintosh interface. Directory entries and timestamped notes are saved locally, with explicit Google Drive pull/merge/push sync.

## Run

From this repository, run `npm start` (Node/npm and Python 3 required), then open port 8000 locally. Alternatively serve this directory using any static HTTP server. No install or build step is required. Deploy these files to an HTTPS static host for home-screen installation and offline support. Do not open `index.html` as a file URL.

Use **+ New** to create a person, select them in the directory, and enter notes with Enter or Add. Notes appear oldest first, with timestamps displayed in the device's timezone. **Export JSON** downloads a backup. No sample health records are included.

## Google Drive setup

1. Create a Google Cloud project and enable **Google Drive API**.
2. Configure its OAuth consent screen. For testing, add your Google account as a test user. Create an **OAuth 2.0 Web application** client.
3. Register the exact deployed origin under **Authorized JavaScript origins** (including the port for localhost). No client secret is used or needed.
4. Create or choose a writable Google Drive folder. Copy its ID from the folder URL.
5. Open **Google Drive…**, enter the web client ID and folder ID, then choose **Connect & sync**. Complete Google consent in the popup.

Sync finds `people_directory.json` in the chosen folder, validates it, merges people and notes by stable IDs, and uploads the result. A missing file is created; duplicate filenames and conflicting note IDs stop sync. People metadata uses its newest `updatedAt`. Existing note text is immutable. Tokens remain in memory, while the client and folder IDs are remembered locally. Disconnect clears the token; revoke the grant in Google Account permissions when needed.

The app requests the full `drive` OAuth scope so it can find an existing JSON file in an arbitrary folder. Public distribution can require Google's verification/security review for this restricted scope. A production alternative is a Google Picker flow with `drive.file`, which is outside this initial version. Drive authentication requires a connection; the app shell and local note entry work offline.

Sync is manual and is **not transactional across devices**. Avoid simultaneous sync by multiple users: the second read narrows the race window but cannot prevent a concurrent write. Export backups and enable Drive version history. No automatic background sync or deletion propagation is implemented. OAuth failures and rejected writes leave local records intact.

## Install on a home screen

On iOS Safari, use Share → Add to Home Screen. On supported Android/desktop browsers, use the browser's install action. Installation requires HTTPS (localhost is accepted for development). The service worker caches the local shell only; it does not cache Google API responses. iOS can evict local data, so keep exports or Drive backups. Actual iOS/Android installation should be checked on physical devices before deployment.

## Data handling

Records are stored unencrypted in this browser's localStorage and, only after explicit sync, your selected Google Drive folder. This prototype has no application login, access controls, audit enforcement, or encryption at rest under app control. Use synthetic data for evaluation; deployment with real health records needs an approved security/privacy design and organizational review. Local persistence failures are reported rather than silently discarding records. Other open tabs are blocked from editing after a storage change until reloaded.

JSON format: `{ "version": 1, "people": [...] }`. Each person contains `id`, `name`, `room`, `info`, ISO `updatedAt`, and `notes`. Each note contains `id`, `text`, and ISO `createdAt`.

## Validate

- `npm test`: model and mocked Drive API tests.
- `npm run check`: JavaScript syntax checks.
- With the server running: `python tests/browser_smoke.py` uses Python Playwright and `/usr/bin/chromium`. Tests person creation, notes, safe text rendering, persistence, search, offline entry, and mobile overflow. Screenshots go to ignored `artifacts/`.

No package installation is needed for the app or Node tests. Browser-test tooling is a development-only prerequisite. Real Google OAuth and sync require your configured client and account and are not covered by mocked API tests.

Future tasks should use this existing isolated checkout; no extra Git worktree is necessary. Start the static server again in a new session. Increment the service-worker cache version when changing the offline asset set.
