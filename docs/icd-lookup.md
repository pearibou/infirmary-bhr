# ICD-10 Lookup

Open the desktop icon below Weekly Appts by double-clicking it, or focus it and press Enter. This public reference uses the U.S. ICD-10-CM FY2027 October 1 release, effective October 1, 2026 through September 30, 2027. It does not select a resident, assign diagnoses or write to any patient spreadsheet.

Search by dotted/undotted code, description, common abbreviation or everyday term. Prefixes and bounded spelling corrections use the same local search as Medical History. Related and spelling/prefix results are labeled. Search includes parent categories as well as reporting codes. Inspect the selected code and instructions before using it.

**Browse tabular** starts with the 22 chapters. Open a chapter, block or category to see its direct children. The path above the selected entry lets you move back up. The selected entry shows **Reportable** or **Choose a more specific code**, official notes, and separately labeled inherited guidance with its source. Reporting status is not a payment or coverage determination. This browser is not the separate Alphabetic Index or the complete official guidelines.

Use Copy code, Copy description or Copy both. Bookmarks store only code identifiers in this browser (up to 200). Submitted searches appear under Saved / recent for this signed-in session and are cleared on logout/disconnection; no search query is sent to an external lookup service or stored persistently.

Snap left or Snap right reserves workspace space for the reference. Drag the vertical edge to resize it, or focus the edge and use the arrow keys. Float restores the movable, resizable window. Side and panel width are remembered on this browser. Screens narrower than 960 pixels use a floating window; narrow or snapped windows switch between list and detail with Back to list. The saved side resumes on a wider screen. Close or minimize releases the reserved area. Clinical edit and confirmation dialogs remain modal.

The public tabular data downloads on first open, rather than during ordinary BHR startup, and becomes available offline after it has been cached. A failed load offers Retry. See [source verification](../data/ICD10-NOTICE.md) and `scripts/build-icd-tabular.py` for reproducibility. No private records belong in these data files.

Validation: `npm run check`, `npm test`, and `python3 tests/icd_lookup_browser.py` against a loopback server. Existing concurrent-viewer checks are in `tests/multiwindow_browser.py`.
