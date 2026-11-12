# Vital-sign trends — future idea

Status: implemented in 0.30.0 (2026-11-10). The discussion below records the original scope.

## Intended first version

Add **View trends…** inside Vital Signs. Start with pulse rate against a selected date range. Offer shortcuts such as past month, past three months and all recorded entries. Later choices could include weight, temperature, oxygen saturation and blood pressure (separate systolic/diastolic series).

Show measurement dates/times horizontally and the selected value/unit vertically. A point can reveal its exact value and recorded time when selected. Keep the graph readable and descriptive; do not add automatic clinical interpretations or severity alerts as part of this idea.

## Existing data stays intact

- Read existing observations and their measurement timestamps. No spreadsheet column changes, migration, rewritten observations or saved graph files are needed.
- Omit entries without the selected measurement; do not treat missing measurements as zero or invent values between observations.
- Convert differing units for display only, leaving the original stored values and units untouched.
- Build the chart on request in session memory. Clear chart data, labels and selected points at logout/disconnect; retain the existing session checks against late responses.
- Keep all measurements private. No clinical values belong in frontend assets, repository files, public caches or analytics.

## Implementation approach discussed

Use JavaScript and the browser's built-in SVG capabilities for axes, labels, points and connecting lines. No Python runtime, charting library or additional installed program is necessary. SVG remains sharp when resized or printed; a print option can be considered separately.

Implemented as a read-only view: Plot trends sits at the far right of the Vital Signs controls. All listed measurement choices and browser printing are available. Date boundaries use local calendar days, including DST transitions. Closed/cleared graphs leave no persistent chart files or schema changes.

Estimated MAP is also available in mmHg, calculated as (systolic + 2 × diastolic) / 3 and rounded to whole mmHg to match the observation display. Each point requires both pressures from the same observation; missing pairs are omitted. Point details retain the source BP, and printouts identify the calculation as an estimate. No stored MAP column or migration is needed.
