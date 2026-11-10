# Vital-sign trends — future idea

Status: discussion only, saved 2026-11-10. No chart functionality is implemented by this document.

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

This is a proposed read-only view of the existing Vital Signs data, not an authorization to implement it yet.
