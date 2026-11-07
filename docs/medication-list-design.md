# Medication lists — design and implementation

Implemented in 0.9.0. The private master spreadsheet is named **Medication Lists (BHR)** and lives directly inside **Infirmary-BHR**.

## Storage and linkage

- Administrator creates one new, blank, private master Google spreadsheet.
- Each person's medication list occupies a separate sheet tab, created only on demand.
- Human-visible tab name: surname and first initial, e.g. Smith J. Resolve collisions with a suffix.
- Store stable spreadsheet and sheet IDs with the person; tab renames must not break linkage.
- The BHR creates the standard headers, formatting and status dropdowns. Keep a Read Me tab for conventions.
- Records remain in Google storage, never the source repository. Current Google connection needs Sheets API access/scopes; future backend separates staff identity from central storage.

## Medication window

- Open from the person record. When no sheet is linked, show only **+ Add medication list** in the center.
- Creating the list creates its formatted sheet; an existing empty list instead says **No active medications** and offers **Add medication…**.
- Fetch on open; provide Refresh and last-retrieved time. A failed read is an error with Retry, never evidence of an empty or missing list.
- Two views: **Active** (default) and **Discontinued** (newest discontinuation first).
- Render spreadsheet cells as a clean readable list, not an embedded spreadsheet.

## Columns

One medication per row. Use explicit status, not blank-row separators.

| Column | Meaning |
| --- | --- |
| Entry ID | Stable BHR-generated ID; may be hidden in Sheets |
| Medication | Name and strength |
| Dose | Amount taken |
| Route | Oral, topical, etc. |
| Frequency | Schedule |
| Instructions | Additional directions |
| Indication | Reason prescribed |
| Prescriber | Prescribing clinician |
| Start date | If known |
| Status | Active or Discontinued |
| Scheduled end | Optional end date/time for a short course |
| Discontinued date | When treatment ended, if known |
| Discontinuation reason | Separate from indication |

Use dropdown validation for status and muted formatting for discontinued rows. Filtering active rows must not destroy history.

## Writes and history

- Add/edit in BHR writes immediately through Google Sheets API and refreshes after confirmation.
- Preserve form on failure; never claim Saved before Google confirms. Prevent double submissions.
- Target stable entry IDs, not row numbers; check concurrent edits before overwriting.
- **Discontinue…** asks for date and optional reason and preserves the row in history.
- **Delete entry…** is for errors/duplicates, available in either view, with confirmation.
- Record actor/time/action in the protected Event Log. Backend enforcement will be required for robust multi-user audit and authorization.
- Restarting a medication generally creates a new entry, preserving the prior treatment period.

## Short courses

- Optional **Short course** exposes scheduled end date and optional time.
- Clearly show the endpoint in the active list. An endpoint is not evidence of an administered last dose.
- New templates use **America/New_York** (configurable before initialization). After initialization, the spreadsheet timezone is authoritative. A date without a time stays active through that date.
- Check overdue endpoints after connecting at startup and when opening a list; continuous background operation is unnecessary.
- On confirmation from Sheets, mark Discontinued with reason **Scheduled course completed**. Retain the scheduled endpoint and processing time; identify automation as the actor type.
- On write failure show **Scheduled end passed—update pending**, with Retry; do not misrepresent the item as current or successfully discontinued.
- Allow changing/removing a scheduled end as treatment plans change.

## Setup and operational limits

Enable **Google Sheets API** in the existing OAuth application project. The existing full Drive OAuth scope already permits these Sheets requests; no new client secret is needed. Open Medications and choose **+ Add medication list** to initialize the blank master and create that person’s tab. An unrelated nonblank workbook is never overwritten. Medical History has a separate spreadsheet implementation; Demographics serves as the face sheet.

Entry IDs and Google row developer metadata protect targeting when rows shift. Deleting an erroneous entry clears its cells and leaves the empty row/marker; it does not delete rows by position. Extra hidden columns retain creation/update identities, timestamps, processing time and revision. Do not change headers or technical markers manually.

The client checks existing contents before updates and preserves drafts on conflicts. Sheets does not provide an atomic compare-and-swap for this workflow: simultaneous edits to the same medication can still race. Server-side serialization, authorization and durable audit are required for stronger multi-user guarantees. Current users still share the connected Google account identity. Medication contents remain in session memory, are cleared on logout and are excluded from browser persistent storage and shell caching; only the spreadsheet/sheet link is included in protected directory sync.

Scheduled completion runs on connection and list opening, not continuously or on a backend timer. It changes list status; it does not establish that any dose was administered. Failed completion writes remain explicitly pending. Tests use synthetic Drive/Sheets responses only; live project/API setup must be verified in the browser.
