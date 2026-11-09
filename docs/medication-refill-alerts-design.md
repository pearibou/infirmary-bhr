# In-BHR medication refill alerts — discussion notes

Status: implemented in 0.25.0. The sections below preserve the original design discussion; see Implementation decisions for the shipped behavior. See [refill tracking](medication-refill-tracking-design.md).

## Scope

Keep alerts inside BHR. No external notifications are planned. Alerts must not change clinical medication status or appear on printed medication lists.

## Suggested indicator

Use a small retro **medicine bottle with an exclamation-point badge** in the top menu bar. A pale amber badge distinguishes it from ordinary medication navigation; a compact count can indicate medications needing review. This is a proposed design, not yet a chosen asset.

- Gently blink/pulse only when there are new, unacknowledged alerts. Avoid rapid flashing or making the entire menu bar blink.
- Acknowledge stops blinking. Keep the indicator steady while unresolved conditions remain, so acknowledgment is not mistaken for resolution.
- New or materially changed conditions can blink again. An ordinary refresh or daily countdown should not repeatedly re-arm an already acknowledged issue.
- Provide a clear accessible name and text count. Honor reduced-motion preferences by using a steady attention badge instead of animation. Color and motion must not be the only indication.
- Clicking opens a compact alert pane/list grouped by person, with medication, estimated days left, dispensing pharmacy, and the specific reason for attention. Link to that medication's refill history.
- A compact startup notice such as “4 medications need refill review” is possible; avoid one popup per medication.

## Configurable thresholds and control placement

Suggested shared clinic defaults, starting from current warning thresholds:

| Setting | Initial value |
| --- | --- |
| Low estimated supply | 7 days or less |
| Prescription expiring soon | Within 30 days |
| Flag no refills remaining | Enabled |

Suggested primary location: **Mepkin Abbey Infirmary menu → Preferences… → Medication alerts**. A small settings button in the alert pane can open that same preferences section. Neither route exists yet; use a single shared settings source, not independent copies of the controls.

- Store shared thresholds in private Drive configuration, so different devices/staff do not silently use different clinic defaults.
- Explain that PRN medicines use pharmacy-dispensed days supply, consistent with existing refill tracking.
- Missing days supply, dates or refills are unknown, not zero. Do not fabricate an exhausted-supply warning from missing information.
- Keep warning reasons distinct: supply low/exhausted/overdue, prescription expiring/expired, and no refills remaining.
- Validate day thresholds as sensible whole numbers. Whether to allow per-medication overrides can be considered separately; do not require them for the initial design.
- Once staff roles exist, settings changes could be restricted to administrators. Do not imply that the current frontend has enforceable administrator roles.

## Acknowledgment versus refill action

Keep these separate:

1. **Acknowledge:** someone has seen the alert. Record who and when; stop its blinking without changing supply, remaining refills, prescription expiration, or medication status.
2. **Refill requested:** record the request date and staff identity, optionally with a short comment. Display the pending request so another staff member does not duplicate the request.
3. **Remind me on…:** optionally defer attention until a chosen date. Clarify in the UI whether this is shared across staff or personal; the initial suggestion is a shared team reminder.
4. **Record dispensing:** add the actual new refill record. Recompute the applicable alert conditions from the saved information; do not assume that every warning is resolved.

Suggested acknowledgments and refill-request state are shared across the team in private Google storage, with actor/time attribution. Acknowledging or dismissing an alert must never mean “refilled,” and refill requests must never increase estimated supply.

## Refresh, persistence and integrity

- Evaluate on connection/startup, when opening the alert list, and after relevant refill saves or settings changes. Recalculate while the app is open as needed for a calendar-day boundary; no always-running external service is needed.
- Identify issues using stable person/medication/refill IDs and warning reason, so renamed medications keep the right acknowledgment and a new fill can be evaluated independently.
- Decide how existing acknowledgments behave when a warning becomes more urgent (for example, low supply becomes overdue) or a threshold changes. Avoid re-alerting on every refresh.
- A failed read must show that alert evaluation is incomplete, not an all-clear or a misleading zero count.
- Prevent duplicate refill requests and stale acknowledgments from overwriting newer activity; preserve attribution and metadata-only Event Log entries.
- Keep alert data, request comments and pharmacy details out of repository files, app-shell caches and printed medication lists. Clear rendered alerts and drafts at logout, consistent with other protected BHR information.

## Decisions to confirm before implementation

- Final bottle/exclamation artwork and position in the menu bar.
- Whether startup uses only the indicator or also a one-time compact notice.
- Exact acknowledgment and reminder controls, re-alert rules, and treatment of discontinued medications.
- Initial settings-edit permissions under the current shared Google connection.
- Shared configuration schema and concurrency approach for alert/request records.

## Implementation decisions (0.25.0)

- Use the compact bottle/exclamation/count beside sync in the top bar. Indicator only at startup; no extra startup popups or external notifications.
- Include active medications for living patients. Count medications, with distinct reasons within each card. Missing values are not zero.
- Shared defaults are 7 supply days / 30 expiration days / no-refills enabled. All connected Drive editors can change these; no administrator role is claimed.
- Acknowledge each current reason; defer all current reasons to a shared team reminder date. Low→exhausted→overdue and expiring→expired are distinct stages. Daily countdowns and medication renames preserve acknowledgments. Relevant data/threshold changes use new stable issue tokens; new refill IDs create independent issues.
- Pending requests are per medication/current dispensing context, shared and separate from acknowledgement. Record the pharmacy request manually; no API contacts the pharmacy. Duplicate concurrent request events reduce to one visible pending state while preserving attribution. A fresh sync/read precedes writes; changed issues/settings/pending requests require review.
- Store immutable action/settings events in optional `refillAlertEvents` inside the private directory JSON, preserving older directory/clinical/refill schemas. No medication/refill sheet columns are changed. Merge unions events and refuses conflicting mutations of an existing ID. Existing directory write races remain reduced, not fully transactional; all clients should update together.
- Scan medication/refill sheets in read-only batches at connection/open, relevant local changes and tab visibility; recalculate date-based conditions from session memory every minute. Failed/partial reads remain explicitly incomplete. State and comments follow existing protected browser-storage cleanup; full scanned medication/refill/pharmacy values remain memory-only.
- Refill tracking warnings and alerts use the same settings. Printed clinical lists never include alert/request/refill fields.
