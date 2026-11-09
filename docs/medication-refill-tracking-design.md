# Medication refill tracking — discussion notes

Status: planned; no refill-tracking functionality has been implemented. These notes capture the discussion for future development alongside [the medication-list design](medication-list-design.md).

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
