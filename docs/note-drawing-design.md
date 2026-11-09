# Drawing tools in note editors

## Current scope: shared desktop sticky notes

Implemented for sticky notes only in 0.15.0. The existing clinical quick-note and rich-text clinical-note editors do not have drawing tools.

- A small pencil/palette button opens a compact floating tools pane and stays visibly depressed while drawing mode is active.
- Basic ink colors: black, red, blue, green and purple. Fine, medium and broad brush sizes.
- Draw in the sticky editor's drawing area with a mouse, finger or stylus. Turning the pencil off disables drawing but retains the artwork.
- Text and drawing can coexist; a drawing-only sticky is allowed. An entirely empty sticky cannot be saved.
- Undo removes the last stroke; Clear drawing clears the drawing, leaving the text. Cancel leaves the saved sticky unchanged.
- Store bounded vector strokes with normalized coordinates, color and brush size, rather than base64 images. This keeps drawings resizable and validates data before rendering.
- Drawings are protected runtime information, synced inside the sticky record in private Drive directory JSON. No real drawing belongs in frontend assets, test fixtures, logs or the repository.
- All connected users can edit shared stickies and delete them through the existing permanent-delete confirmation. Creator identity remains intact; edits record their editor and time. This shared permission does not change clinical note ownership rules.
- Minimized stickies occupy a strip immediately below the menu bar. Restore them by clicking. Minimization is per browser session, not a change to the shared note; it does not hide the note for other staff.
- Clear editor strokes, canvas pixels, context menus and minimized labels on logout/disconnection. Log edit metadata without copying message text or stroke data to the Event Log.

## Future note-editing contexts — discussion only

The same compact pencil/palette interaction could later be considered for other note editors. Do not add it to those editors as part of the sticky-note work.

Before extending it, decide:

- Whether drawings appear in a separate area, inline with formatted text, or as annotations. The sticky implementation uses a separate area within its editor.
- Placement and scaling in browser printouts, including legibility and page boundaries.
- How selection, moving drawings, erasing, redo and keyboard-accessible alternatives should work.
- Whether stylus pressure or additional brushes are useful; current drawing uses fixed widths.
- How clinical note author-only editing/deletion and revision records apply to drawings.
- Storage limits and whether larger drawings should become separate private Drive attachments.

Clinical note permissions must remain independent from shared sticky-note permissions. Extending the feature requires a separate implementation request.
