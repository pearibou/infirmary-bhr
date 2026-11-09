# Vital Signs — implementation notes

Implemented in **0.19.0**. All actual measurements are protected runtime information in private Google storage. Only frontend code, public icon art, schema descriptions and synthetic test data belong in the repository.

## Access and scope

- Open **Vital Signs** from the desktop's retro sphygmomanometer icon without opening The BHR. Select a person from the living/deceased groups.
- The patient's navigation row also has **Vital Signs**, with a small stethoscope icon, and opens the same window with that person selected.
- Observations appear newest first by measurement time, with entry time/ID as a deterministic tie-breaker.
- Any currently connected user with the workbook's Drive/Sheets permissions can add, edit or delete observations, consistent with medication/history maintenance. Original author and entry time are retained; edits identify their editor/time. Future staff roles still require backend authorization.
- A standalone Medications desktop app was subsequently added in 0.22.0. No clinical severity alerts, trend charts or vital-sign print view are included in this release.

## Observation fields

| Field | Behavior |
| --- | --- |
| Measurement date/time | Required; defaults to now; editable for backdated observations |
| Blood pressure | Optional paired systolic/diastolic values, mmHg |
| Pulse | Optional, beats/minute |
| Respirations | Optional, breaths/minute |
| Temperature | Optional value with °F/°C selector; °F default |
| Oxygen saturation | Optional percentage |
| Oxygen delivery | Free text; blank normalizes to RA (room air); may include method and flow rate |
| Height | Optional value in total inches or centimeters; inches default |
| Weight | Optional value in pounds or kilograms; pounds default |
| Comment | Optional plain text |

Enter at least one actual measurement; oxygen delivery or a comment alone does not create an observation. Individual measurements may be omitted. Bounds/unit validation catches invalid numbers; it is not clinical interpretation or a severity classification. Original units and values are retained. Height/weight displays include rounded conversions for readability.

The editor explicitly identifies the viewing device's timezone. Measurement times are stored as UTC ISO timestamps in the spreadsheet and rendered in the viewer's local timezone. Backdating is supported. Nonexistent local times during daylight-saving transitions are rejected; the browser's usual earlier-offset interpretation applies to ambiguous repeated local times when manually entered.

## Main chart height and weight

Height and weight each come from their latest **nonblank measurement**, selected independently. A newer blood-pressure-only entry cannot erase an older height or weight. Backdated entries do not replace newer measurements. Editing or deleting an observation recomputes both summaries, including falling back to an older measurement.

Show the values, units and a compact measurement date beside the person's main demographic details; stack below on narrow layouts. Hide each missing value, and hide the entire block if neither exists. Cache only in memory, refresh on chart access (up to once per minute during ordinary directory renders), and force a fresh read in the Vital Signs window. A failed refresh must not masquerade as a new measurement; retain any known values with their dates and indicate refresh failure.

## Private spreadsheet storage

- Master workbook: **Vital Signs (BHR)** directly inside the connected **Infirmary-BHR** folder. Reuse an existing blank workbook, or create it only when saving the first observation.
- Initialize a Read Me tab and per-person tabs named surname plus first initial, with numeric suffixes on collisions.
- A tab is created when needed for the first save, not merely by viewing or opening/canceling a form.
- Directory person records contain only a `vitalsSheet` link (spreadsheet ID and numeric sheet ID), not measurement values. Person/tab developer metadata and stable observation row markers preserve linkage through tab renaming and row insertions.
- Separate spreadsheet columns retain measurement values/units, UTC times, author/editor IDs and names, and revision. Keep headers and metadata intact.
- Refuse unknown nonblank templates, duplicate bindings, missing markers, and stale row baselines instead of rewriting uncertain data.
- Creation retries reuse the same observation ID; edits target stable metadata rather than guessed row positions. Delete clears only that observation row after confirmation, retaining its marker so stale retries cannot resurrect it.
- Google Sheets still has the existing nontransactional freshness-check/write race; this frontend is not a transactional clinical backend. Keep all clients updated.

## Privacy and session handling

Read/write directly through authenticated Google Drive/Sheets APIs. No observation values, summaries or comments are written to localStorage, service-worker caches, GitHub, or static hosting. Observation mutation events contain action/person/entry IDs and actor metadata, not measurement values or comments.

Save failures retain the form for retry. Switching people while a draft is active resumes that draft rather than silently changing its patient. Logout/disconnect clears observation lists, summaries, picker labels, drafts, cached measurements and pending request state. Connection-epoch checks prevent a stale request from populating a later session.

## Optional Glasgow Coma Scale (0.21.0)

Store `gcsEye`, `gcsVerbal`, `gcsMotor` as optional string fields in three appended spreadsheet columns (22–24, zero based). Calculate the total from components; never maintain a separately editable total. All blank means no assessment. All three valid choices are required for any assessment, including a GCS-only observation. Display E/V/M breakdown and total; old observations omit this line entirely.

Read legacy 22-column tabs without changing them. Before a write, validate existing headers/rows and append only missing GCS headers, increasing grid column count if required. Unexpected data in the appended columns stops the upgrade. Existing observations, author IDs, revision fields and row metadata retain their positions. Original schemas still use their existing workbook marker; all clients must update together because earlier frontends do not interpret or validate the new fields.

Descriptions use the adult eye/verbal/motor responses. A component that cannot be assessed should remain unsubmitted; this version does not invent a numeric value for untestable responses. The brief total interpretation describes a score range, not a diagnosis.

## Fresh GCS forms (0.22.0)

Hidden input values reflect back to their HTML value attributes, so `form.reset()` alone retains previously selected GCS values. Reset all three values/defaults explicitly when creating a new observation and on save/cancel/session cleanup. Populate GCS only from the specific observation opened for editing. Regression coverage creates fresh entries for both the same patient and a second patient after a GCS save, then reopens the original observation to verify its stored scores are intact.
