# Default resident folders

Implemented in 0.31.0. New profile photos and manually uploaded resident files default to a resident folder directly within the selected Infirmary-BHR directory. Create it on first photo/file upload, not merely on opening a chart. A readable surname/given-name folder name is backed by stable person-ID app metadata; names do not establish identity.

Reuse the marked folder even after a resident is renamed or an upload/create response is lost. Coalesce simultaneous requests in one browser; if cross-browser first use produces duplicate marked folders, deterministically select a folder on later discovery rather than mixing residents by name. Do not merge/delete duplicate folders automatically.

The default folder is linked in the chart's Drive folders section. Upload file offers it as the default even when no external folder is attached. Explicitly selecting another attached destination overrides the default for that upload. The profile-photo destination remains automatic.

Existing external attachments and old profile photos are not moved/copied. Replacing a photo uploads the new image to the BHR resident folder without deleting the old image. Desktop notes and clinical-document ownership/attachment rules are unchanged.

This helps future backups remain contained to BHR. No ZIP backup/restore is implemented by this change, and external archives remain external dependencies.
