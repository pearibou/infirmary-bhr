# Medication refill tracking — discussion notes

Status: implemented in **0.17.0**. The discussion below is preserved for context alongside [the medication-list design](medication-list-design.md). The implementation decisions in the next section take precedence over earlier suggestions.

## Implementation decisions

- Open **Refill tracking…** from the medication toolbar for the full overview, or **Refills…** on a medication for its history.
- Existing medication entries and their 21-column clinical schema stay unchanged. Refill records link to their stable medication IDs; no medication re-entry is needed.
- Use separate per-person **Refills Surname I** tabs inside the existing private **Medication Lists (BHR)** workbook. Create a tab only when saving the first refill. Sheet/person/row metadata carries identity; renaming a tab does not break linkage.
- Last filled means **dispensing date**; the estimate assumes supply begins that day. Dates and elapsed calendar days use the workbook timezone (normally America/New_York), including daylight saving changes.
- Preserve signed days-left values, with an overdue label when negative. Missing date or days supply yields “Not recorded”; future dates show when supply starts instead of a misleading estimate.
- Dispensing/prescription fields are optional; at least one must be entered. Blank refills means unknown, zero means none remain. Rx numbers are stored as raw text, preserving leading zeros.
- Each new refill is a separate history record. It defaults only the dispensing pharmacy from that medication's most recent record, not from the patient's preferred pharmacy. Confirm current Rx number, refills remaining and expiration yourself; these are not copied as though freshly verified.
- A signed **Adjustment (days)** changes that fill's estimate without changing days supply. Nonzero adjustments require an explanation. Early-refill carryover is not inferred; use an explicit adjustment when appropriate. PRN medicines use the same pharmacy-days-supply estimate.
- Latest overview record is chosen by dispensing date (entry date when dispensing date is blank), then entry timestamp. History appears newest first. Editing or deleting a record recalculates which record is shown.
- Warnings distinguish supply overdue/exhausted/7 days or less, zero refills, and prescription expired/expiring within 30 days. No warning changes the clinical medication or its status.
- Any connected staff member with current Drive/Sheets access can add, edit or delete refill records, consistent with medication-list editing. Preserve original attribution; edits record their editor/time. Delete requires BHR confirmation and clears only the stable refill row, leaving other records and the medication intact.
- Removing a medication retains its refill history, shown as a removed medication. Changing medication names keeps the link. Discontinued medications remain available for history and historical dispensing entry.
- Read on opening/refresh and after writes. No refill information is persisted in localStorage or the PWA cache. Logout/disconnect clears rendered refill information and drafts. Do not treat API read failures as an empty history.
- Use metadata-targeted writes with stale-baseline checks and retry-safe creation IDs. Spreadsheet writes still have the existing nontransactional check/write race; Google Sheets is not a transactional database. Keep all clients updated.
- Log refill mutation metadata without pharmacy, Rx number, supply values or adjustment text. Real records stay in private Google storage, never in repository files.
- **Exclude all refill tracking from medication printouts.** The clinical print renderer keeps its explicit existing columns; there is no refill Print button.

## Intended behavior

Extend each person's medication list with pharmacy dispensing and prescription information. Keep this separate from the medication's clinical instructions and discontinuation state.

Use the **days supply assigned by the dispensing pharmacy**, including for PRN medications. Do not attempt to count actual PRN doses or infer adherence. Display the result as **estimated days left**, rather than a measured quantity remaining.

## Fields discussed

| Field | Purpose |
| --- | --- |
| Last refill date | Date of the most recent dispensing recorded in BHR |
| Days supply | Number of days supplied, as assigned by the pharmacy |
| Estimated days left | Calculated from days supply and elapsed calendar days since the refill date |
| Rx number | Pharmacy prescription number |
| Refills remaining | Number of refills remaining as manually recorded |
| Prescription expiration date | Expiration of the current prescription, distinct from a medication's scheduled end date or the product's expiration |
| Dispensing pharmacy | Pharmacy that dispensed this medication/refill; may differ between medications for the same person |

## Days-left calculation

Basic estimate: **dispensed days supply − elapsed calendar days since refill**.

For example, a 30-day supply dispensed 10 calendar days ago estimates 20 days left. PRN medications use this same pharmacy-supply estimate even though actual stock may last longer.

Allow manual adjustments for dose changes, PRN use when staff choose to account for it, or differences between the estimate and actual supply. Preserve the originally entered dispensing information rather than silently replacing it with an inferred amount.

## Suggested history and pharmacy handling

- Keep a refill history for each medication instead of overwriting the previous refill.
- Each refill can retain its date, days supply, dispensing pharmacy, Rx number, refills remaining and prescription expiration as recorded at that time.
- Default the dispensing pharmacy to that medication's previous pharmacy, while allowing a change on each refill.
- Keep dispensing pharmacy separate from the patient's demographics **Preferred pharmacy**; recording a different dispensing pharmacy must not change that preference.
- Link refill records to the medication's stable entry ID, so editing its name does not break its history.

## Indicators discussed

Optional indicators could distinguish low estimated supply, no refills remaining, and an approaching prescription expiration. Thresholds and presentation remain to be decided.

**Running out of estimated supply must never automatically discontinue a medication.** Prescription expiration and no refills remaining likewise do not establish a clinical discontinuation.

Values are staff-maintained information, not a live pharmacy feed. Remaining refills should not be decremented or otherwise inferred without an explicit workflow decision.

## Storage and refresh

Actual refill records are protected runtime information and belong in private Google storage alongside the medication data. Only this design document and synthetic fixtures belong in the frontend repository. A separate refill-history sheet/table is a possible design; its exact schema is not yet decided.

Recalculate estimates when loading or opening the medication list, consistent with the existing startup/open refresh approach. No continuously running service is needed for a date-based estimate.

## Details still to decide

- Whether refill date means dispensing date, pickup date, or supply-start date in the UI; define this consistently before implementation.
- How early refills and carried-over supply affect the estimate.
- Whether negative estimates display as zero, days overdue, or both.
- How manual adjustments are represented, attributed and retained in history.
- Required versus optional fields, warning thresholds, and refill-entry/edit/delete permissions.
- Spreadsheet schema, concurrency protection and event logging for refill changes.

## Further ideas from the previous manual sheet

The previous layout uses **Last Filled, Days Supply, Days Left, Rx#, Refills, Expires**. Keep the familiar compact grouping in a dedicated refill view, with the dispensing pharmacy alongside it. This can make checking multiple medications easier than opening each medication separately.

- **Negative days left:** the manual sheet retains negative values. Preserve that useful information, potentially displaying it as “overdue by N days” alongside the signed estimate. This indicates elapsed supply, not proof that the person stopped taking the medicine or has no tablets left. Final display wording remains to be decided.
- **Unknown versus zero:** a blank refills value means unknown/not recorded; zero means explicitly no refills remain. Likewise, a blank expiration date means not recorded, not expired or indefinitely valid. Missing dates or days supply should produce an unavailable estimate rather than a misleading zero.
- **Rx numbers are identifiers:** store them as text to preserve leading zeros, letters and punctuation. Never perform arithmetic on them. No actual prescription numbers from the reference image belong in this design document or test fixtures.
- **Separate warning reasons:** visually distinguish estimated supply overdue, zero refills, and expired prescription; they can occur independently and imply different follow-up actions. Keep text labels so meaning does not depend on color alone.
- **Date clarity:** use explicit dates and calculate elapsed calendar days in the configured infirmary timezone, avoiding changes caused solely by a viewer's timezone or daylight saving transitions.

These are design suggestions prompted by the reference, not implemented behavior or a decision to add new required fields.
