# Community Rundown

Implemented in 0.31.0. A manually curated handoff document, not an automatically assembled report. The desktop icon is a canted clipboard with bullets and a small running figure.

- Create a new titled/dated document or select an archived one. Date entry accepts MM/DD/YYYY; read/print shows, for example, Tuesday, 10 November 2026.
- Insert a resident heading from the directory (display name and available DOB), then freely type beneath it. Headings are editable snapshots; later chart changes do not silently rewrite an old rundown.
- Add a General community section. Reorder/remove sections within the draft without modifying any chart.
- Bold, italic, underline, bullets, numbering, list indent/outdent and controlled yellow highlighting. Pasted text is plain; saved/read/printed markup uses a strict sanitizer with no executable HTML, links or arbitrary styles.
- Saved documents open in viewing mode. Edit is explicit. All users with the workspace's Google editing permissions may maintain this shared handoff document. Clinical-note creator permissions remain unchanged.
- Start from previous copies the selected saved rundown into a new dated draft with fresh document/section IDs. Earlier documents remain untouched. Unsaved document switches offer save/discard/cancel; minimizing/closing the window retains its draft for reopening within that session.
- Private JSON files live directly in Infirmary-BHR with a dedicated app marker, stable document ID, attribution and timestamps. No document body is saved in localStorage, public assets or Event Log entries. Retry-safe creation and stale-file/ETag checks follow the existing calendar pattern; these checks reduce races but are not a fully transactional backend.
- Compact print-only letterhead (27pt emblem, smaller organization name/title), tight section/list spacing and normal browser printing. Do not clip or aggressively shrink long documents. Estimate whether more than one Letter page is needed and tell the user to check print preview.
- Logout/disconnect clears the archive, bodies, draft, headings, selection and print frame. Late results cannot populate a later session.

No appointments, medication changes or recent notes are pulled into the content automatically.
