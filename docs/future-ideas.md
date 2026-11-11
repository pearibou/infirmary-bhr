# Future BHR ideas

Discussion inventory, updated 2026-11-10. These items are not implemented or approved implementation tasks. The project supports practical care coordination and recordkeeping for small community infirmaries; keep documentation burden low.

## Practical additions suggested

- **Person-linked follow-up tasks:** task text, optional due date, assigned person and completion checkbox, with a combined desktop to-do view.
- **Handoff view:** recent clinical quick notes, upcoming appointments and outstanding tasks across residents for someone covering the infirmary.
- **Practical care information:** mobility aids, hearing/vision needs, communication preferences, dietary restrictions and usual assistance needs.
- **Resident document checklist:** availability/links and last-reviewed date for advance directives, healthcare decision-maker paperwork, insurance cards and similar documents.
- **Combined emergency printout:** demographics, emergency contacts, allergies, active medications and medical history in a concise report. Existing separate printouts do not constitute this combined report.
- **Complete backup and restore:** include directory, spreadsheet records and attachments. The existing directory JSON export alone does not capture the whole workspace.

## Earlier, longer-term discussions

- **Central access backend:** server-enforced permissions and independent staff sessions with a separately managed central Drive connection. Current individual Google logins and persistent display names are already implemented; see [authentication/storage transition](authentication-and-storage-transition.md).
- **Portable offline edition/local storage:** one application with an intentional storage choice; a self-contained executable could embed SQLite and keep attachments in a local folder. Local accounts, backups and any LAN access would need deliberate design. No offline executable or SQLite storage adapter exists yet.
- **Drawing in clinical note editors:** sticky drawing exists; extending it to clinical notes remains discussion only. See [note drawing](note-drawing-design.md).
- **Optional medical-history status:** previously deferred; no active/resolved status field at present.

## Already implemented, not pending

Read-only printable vital-sign trends (0.30.0), shared Drive presence across browsers (0.29.0), individual Google sign-in, persistent staff display names, organization branding settings, medications/refill tracking and shared in-app refill alerts, medical history with local ICD-10-CM search, immunizations/master view, vital signs/GCS, weekly appointments, clinical-note viewing/editing, sticky drawing/editing and Event Log.

## Outside the current scope

- Pharmacy/RxLocal integrations: explicitly set aside. Enter dispensing/refill information manually.
- External medication notifications: not planned; alerts remain inside BHR.

This list preserves possibilities; it does not rank or commit to developing them.
