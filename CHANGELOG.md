## V2 · Build 2.1.1 — Home consolidation and UI cleanup

- Combined Home **Detections** and **Issue Action History** into one **Detections & Actions** workspace with Check now, Current/Recent selection, Approve all, Process all, Cancel all upcoming and Show completed controls.
- Corrected **Show completed** semantics: with the toggle off, issue groups disappear only when every action for that issue is terminal; completed actions remain visible inside issue groups that still contain active work.
- Moved **Bulk Operations** from Home to Rules beside **+ Rule**.
- Simplified Last Cycle failures to a compact **Error occurred · see Logs / Audit** status so long connection/synchronization errors no longer expand the Home card. Synchronization warnings are also written to the audit journal.
- Replaced Home schedule wording that used “shift” with **Active Schedule / No Active Schedule**.
- Added a consistent readable control-label typography standard for text paired with toggles/buttons.
- Removed decorative left-edge color strips from list entries, including rules and detections.
- Repositioned profile Select/Selected controls to the vertically centered right side of profile cards.
- Added safe **Duplicate** profile support. Duplicates receive fresh nested identifiers, reset runtime state and start with Monitoring disabled.
- Removed the **Protected sensitive actions** panel from Settings → Security and moved that explanation to Help.
- Split Settings → Automation into **Sync & Refresh**, **Safety Limits** and **Alarm** subpages with less crowded spacing.
- Stopped handled UI-action failures from being redundantly mirrored with `console.warn`; users still receive the error toast and SD Companion's own log/audit reporting.

## V2 · Build 2.1.0 — Bulk operations, approvals and alert control

- Added Home → **Bulk Operations**, a transient one-time rule-style workflow with saved-filter/JQL
  targeting, typed conditions, preview, ordered actions, delays, dependencies and immediate queueing.
  Bulk definitions are not saved into profile rules.
- Added per-action **Needs approval**. Approval-gated jobs enter a dedicated **Awaiting approval**
  state and cannot be armed/executed until approved. Action History adds individual **Approve** and
  profile-wide **Approve all** controls.
- After approval, a future-due action becomes an ordinary Pending action with **Process** and
  **Cancel** controls; an already-due action is armed for immediate execution. Chained actions remain
  dependency-aware while approval is pending.
- Added per-rule **Local alert rate limit** settings for Alarm and Notification actions. Users can
  configure the maximum number of local alerts allowed in a rolling minute window.
- Hardened alarm stopping: the top stop-alarm control now cancels queued/approval-gated Alarm jobs as
  well as the active sound, and playback uses a cancellation generation guard to close the race where
  a concurrently starting alarm could restart immediately after Stop was pressed.
- Browser action notifications now use one stable notification ID so newer action notifications
  replace older ones instead of accumulating indefinitely across rules.
- Improved Home → Issue Action History ordering so Awaiting approval / Running / Pending work appears
  first and newer activity precedes older terminal history. Added **Show completed** to hide/show
  succeeded, failed, cancelled and skipped actions.
- Bumped stored schema to 33 and build/manifest version to 2.1.0. Existing rules migrate with approval
  disabled and local-alert throttling disabled, preserving previous behavior until explicitly enabled.
- Added V2.1.0 regression coverage for bulk planning, approval queue states, approve-all chain
  behavior, alert throttling, global queued-alarm cancellation and action-history controls.
- Invalid/untrusted server-certificate bypass was intentionally not added: Chromium extensions cannot
  disable server TLS verification per Jira server. Private/internal CAs must be trusted by the
  operating system/browser, or the Jira certificate must be corrected.

## V2 · Build 2.0.12 — Extension lock and sensitive-action re-authentication

- Added an optional device-local SD Companion lock using either a 4–12 digit PIN or an 8–128
  character password.
- The plaintext PIN/password is never stored. A random salt and PBKDF2-SHA256 verifier are stored
  locally; unlock state and short-lived sensitive-action authorization tokens live in
  `chrome.storage.session`.
- Added a configurable unlock-session duration from 1 minute to 7 days. The extension automatically
  locks again when the session expires and after a browser restart.
- Added a full-screen unlock gate to both popup and side-panel surfaces, plus **Lock Now**.
  Background Jira monitoring/automation continues while the UI is locked.
- Added mandatory fresh re-authentication for sensitive operations when the lock is enabled,
  including Process Now / Process All, bulk queue cancellation, PAT replacement, Jira URL changes,
  profile import, encrypted credential backup, server/profile deletion, cache/runtime clearing,
  log/audit clearing, and factory reset.
- Sensitive-action authorization is also enforced in the service worker with short-lived random
  tokens; it is not merely a visual prompt.
- Extension lock settings are device-local and are deliberately excluded from profile exports,
  including encrypted profile backups.
- Added rate limiting after repeated incorrect unlock attempts.
- Added V2.0.12 regression coverage for plaintext-secret exclusion, PIN verification, lock/unlock
  state, session timeout changes, risk-token validation, UI lock surfaces, and worker-enforced
  sensitive actions.

## V2 · Build 2.0.11 — Large encrypted backup reliability

- Fixed `Maximum call stack size exceeded` during secure profile export when the encrypted payload
  is large.
- Replaced the unbounded `String.fromCharCode(...ciphertext)` conversion with bounded chunked Base64
  encoding, preventing Chrome/JavaScript argument-stack overflow while preserving the existing
  PBKDF2 + AES-GCM backup format.
- Base64 decoding now fills the output byte array iteratively instead of relying on a large callback
  conversion.
- Added a large secure-backup encrypt/decrypt regression test so realistic inventory/profile sizes
  are covered rather than only tiny fixtures.

## V2 · Build 2.0.10 — PAT truth and import preview cleanup

- API Online is now gated by the actual credential store. A stale imported runtime snapshot can no
  longer show API Online when no PAT exists.
- Regular imports explicitly enter PAT missing state; secure/existing-credential imports enter Check
  required until a live Jira health check succeeds.
- Missing PAT is treated as configuration, not an outage: monitoring cycles, API heartbeats,
  periodic metadata sync, and connection-loss alarms are paused for that server.
- Added PAT missing indicators across the top API badge, Home, Health, Jira Servers, and API Data;
  sync/health controls are disabled until credentials are configured.
- Rebuilt Profile Import preview with structured server/profile cards, a summary table, bounded
  rule/schedule/comparison cards, wrapping chips, and an explicit authentication warning.
- Added V2.0.10 regression coverage for credential-truth gating, stale imported health sanitization,
  background alarm/timer gating, and import-preview layout.

## V2 · Build 2.0.9 — Serverless profile import

- Profiles can now be opened and imported even when no Jira server is configured.
- Import preview remains available before applying the backup.
- Applying an export with no local server restores the saved Jira server shell from the backup
  automatically; a PAT/connection is not required just to import.
- Normal secure-import, duplicate-server, state-validation, and credential protections remain
  unchanged.

## V2 · Build 2.0.8 — Stable list ordering and schedule selector cleanup

- Rule schedule selection now displays only each schedule name; schedule descriptions are no longer
  appended inside the selector, and the selector is constrained to its card width.
- Multi-choice lists now promote selected items to the top while preserving their original relative
  order. Search still filters normally: selected items outside the current search context remain
  hidden, while matching selected items appear before matching unselected items.
- Issue Action History now uses an immutable `historyOrderAt` captured when a job is first queued.
  Manual processing and downstream relative re-anchoring can change execution times without
  rearranging the history rows. Existing queued jobs fall back to their immutable creation time for
  stable display.
- Added V2.0.8 regression coverage for schedule labels, selected-first list behavior, and
  action-history order stability.

## V2 · Build 2.0.7 — Process now and action-specific preflight

- Added **Process** beside each Pending action, **Process all** for one issue, and profile-wide
  **Process all** in Home → Issue Action History. Bulk processing is explicitly server/profile
  scoped and requires confirmation.
- Added Rule Setup → **Manual processing** with **Relative update** and **Preserve schedule**.
  Relative update re-anchors downstream After previous actions to the manually processed
  predecessor's actual completion time; Preserve schedule leaves their existing displayed due times
  unchanged.
- Manual processing bypasses only the queued time / current rule schedule window. The selected
  action still performs configuration, Jira permission, action-condition and action-specific
  state/no-op checks immediately before dispatch.
- Replaced the old universal planned-status/source/rule-match lock with action-specific optimistic
  preconditions. Transitions watch status; assignments watch assignee; priority actions watch
  priority; label actions watch labels; Edit Fields watches only fields it modifies. Comments,
  alarms and browser notifications are no longer cancelled merely because an unrelated Jira status
  changed.
- Chained actions inherit successful predecessor results for the same guarded field (for example
  Assign → Assign or Labels → Labels), preventing SD Companion's own earlier action from being
  mistaken for an external conflicting change.
- Added V2.0.7 regression coverage for immediate individual/bulk processing, relative-update versus
  preserve-schedule behavior, manual schedule bypass, and smart per-action stale-state cancellation.

# SD Companion V2.0.7

## V2 · Build 2.0.6 — Anchored chained actions and bulk cancellation

- Fixed chained **After previous action** schedules drifting forward indefinitely.
  Waiting/contention wakeups no longer rewrite the job's visible `scheduledAt`; a stable estimate is
  shown until the predecessor becomes terminal, then the exact due time is anchored once to
  predecessor completion plus the configured relative delay.
- Added per-rule dependency policy for **Previous cancelled**, **Previous not run / skipped**, and
  **Previous failed / error**. Each outcome can independently **Continue chain** or **Cancel next
  action**. New and migrated rules default to Continue for all three.
- Conditional/random/not-applicable actions that are not scheduled now leave dependency-skip
  metadata so later chained actions can continue through them to the nearest actually scheduled
  predecessor when policy allows it.
- Continuing after a non-success predecessor still re-fetches and revalidates the current Jira
  issue, source membership, rule conditions, and action conditions immediately before dispatch.
- Added confirmed **Cancel all upcoming** controls in Home for one issue and for all Pending jobs in
  the active profile. The bulk worker operation is explicitly server/profile scoped and
  Pending-only; Running work retains the existing individual cancellation safety path.
- Added V2.0.6 regression coverage for stable dependency scheduling, cancelled/skipped/failed
  policies, conditional-skip chaining, scoped bulk cancellation, and preserved queue safety.

# SD Companion V2.0.6

## V2 · Build 2.0.5 — Monitoring toggle race fix

- Replaced Home Monitoring ON/OFF full-state saves with a dedicated atomic worker operation.
- Rapid ON/OFF changes no longer reuse the same configuration revision and therefore no longer
  trigger the false “Configuration changed elsewhere” warning.
- Monitoring changes update only the selected profile's monitoring flag and next-cycle runtime
  value; unrelated configuration is not rewritten.
- The UI keeps immediate toggle/radar feedback and ignores stale asynchronous responses from older
  rapid clicks.
- Existing configuration revision protection remains enabled for normal settings/rule/profile saves.

# SD Companion V2.0.5

- Centralized profile alarm configuration under Settings → Automation; Alarm rule actions now simply
  play the configured profile alarm.
- Moved Detection Source from Rule Setup into Conditions.
- Fixed shared toggle thumb geometry and general editor/card spacing.
- Tightened conditional-action layout (Apply action when / Match all-any / condition button
  spacing).
- Added safe Jira server URL editing with URL normalization and duplicate-server rejection while
  preserving the existing server identity, PAT and profiles.

# SD Companion V2.0.3

- Fixed the Unit-selector runtime exception caused by incorrectly scoped `u` / `card` variables in
  rule/action time-unit handlers. Unit changes again preserve the visible number and reinterpret it
  in the newly selected unit.
- Monitoring now changes the Home radar visual state immediately when the switch is toggled instead
  of waiting for the state-save round trip.
- Periodic Home refresh updates radar counters and detection markers in place instead of replacing
  the radar DOM. The V1 sweep animation therefore remains continuously mounted and no longer
  jumps/restarts every activity refresh.
- Slightly enlarged the one shared Home/Settings toggle from 52×30 to 56×32 with a 24px thumb, and
  increased spacing between **Scan Now** and the monitoring switch.

# SD Companion V2.0.2

- Restored the V1.5.22 radar DOM and compact 140px monitor geometry exactly, including rings, axes,
  the full rotating sweep, core, and marker behavior; removed the oversized V2.0.1 pseudo-classic
  radar override.
- Reworked Settings navigation into horizontal page-title tabs while retaining the three richer
  settings sections and explicit Save/Reset semantics.
- Fixed Data search focus/caret loss by updating only the inventory result region while typing
  instead of re-rendering the entire page for every keystroke.
- Added clear card boundaries to every Data dataset selector (Projects, Filters, Users, Issue Types,
  Statuses, Transitions, Fields, Priorities, Resolutions).

# SD Companion V2.0.1

- Reworked the top ribbon brand to **SD Companion V2** and removed the obsolete V1 / API Automation
  subtitle.
- Restored the classic radar and removed the V2 map overlay.
- Promoted Active Shift to a dedicated Home card.
- Added persistent UI-event logging so transient notices, warnings, and errors are retained in Logs
  and the Audit Journal; expanded action, health-check, monitoring-cycle, and worker-failure
  logging.
- Reduced Appearance to six visibly distinct themes: Emerald Dark, Midnight, Graphite, Violet Dusk,
  Amber Smoke, and Frost Light. Legacy near-duplicate theme IDs migrate to the closest retained
  palette.
- Consolidated Settings from five sparse sections into General, Automation, and System & Support.
- Reorganized API Data summary information into a table and widened the metadata catalog/content
  layout for readability.
- Added execution-time action preconditions. Every action re-fetches the issue, verifies the planned
  status, re-evaluates rule/action conditions and the saved filter/JQL source, and cancels safely
  when the issue is stale. Stale cancellations are shown as Cancelled with a short reason rather
  than Failed.
- Chained actions validate against a successful predecessor transition's destination status so
  intentional transition sequences remain valid.
- Added no-op protection for already-unassigned issues, already-selected assignees/priorities,
  already-applied label changes, and transitions already at their configured target status.
- Assignee `is empty` remains the canonical unassigned condition (`assignee is EMPTY`).
- State schema advanced to 30.

# SD Companion V2.0.0

- Promoted the extension to **SD Companion V2** (`2.0.0`, state schema 29) while retaining the
  V1.5.22 worker-only Jira transport, transition protocols, saved schedule semantics, cancellation
  safety, and shared UI toggle contracts.
- Added four dark themes: Midnight, Graphite, Obsidian, and Crimson Night.
- Connection-loss checks/alarms now run only while Monitoring is ON for that Jira server; enabling
  monitoring triggers an immediate connection check and disabling it clears outage tracking / stops
  an active connection-monitor alarm.
- Jira fields synchronized from canonical `/rest/api/2/field` retain schema metadata and are exposed
  as typed rule conditions. Text, number, date/datetime, boolean, user/choice, and array fields
  receive type-appropriate editors/operators and dynamic fields used by a rule are explicitly
  requested during issue search.
- Added **Duplicate** for rules. Duplicates receive fresh rule/group/condition/action/pool
  identifiers, retain configuration, reset runtime state, and start disabled.
- Home now displays active named schedules as the active shift, or **No active shift**.
- Hardened contextual status/transition presentation so duplicate rows are removed by exact
  contextual identity rather than transition name.
- Added **After previous action** timing. Dependent actions wait for the immediately preceding
  planned action to succeed and then apply their own X–Y delay; failed/cancelled/skipped
  predecessors cause the dependent action to be skipped. Ordinary override/rule delays remain
  relative to the detection cycle.
- Added optional random action pools with a configurable number of matching actions selected per
  pool.
- Added action-level conditions, including project / issue type / status conditions, so different
  actions in the same rule can apply to different detected issue contexts. Transition and
  target-status selectors incorporate both rule and action context.
- Unit selectors no longer live-convert visible values when the unit changes.
- Added **Unassign issue** assignment mode.
- Added search to long/explicitly searchable single-value selectors (users, statuses, transitions,
  priorities, sounds, fields, etc.) while retaining searchable multi-select pools.
- Added a lightweight CSS-only world layer/pulse to the radar with reduced-motion support; no canvas
  loop, network asset, or additional JavaScript timer is used.
- Profile export/import now round-trips the complete selected profile, related server
  configuration/inventory/runtime snapshot, appearance, and system settings. Normal exports
  intentionally omit the PAT; password-encrypted secure backups can include it.
- Security hardening: imported JSON is recursively stripped of prototype-pollution keys,
  secure-backup KDF/AES-GCM metadata is bounded and validated before decryption, and fatal UI
  exceptions are rendered with `textContent` rather than HTML injection.
- Added V2 regression coverage for typed fields, action conditions, chaining/dependency behavior,
  randomness, unassign, monitoring gating, searchable selectors, themes, radar behavior, and
  security assertions.

# SD Companion V1.5.22

- Schedule editors now use explicit Save Schedule / Cancel drafts; field/day toggles no longer
  persist on click.
- Rules explicitly support one or more named schedules with OR eligibility semantics.
- Alarm Studio preserves the selected sound during Test Alarm and hot-switches the active test alarm
  when the preset changes.
- Added per-server Focus Jira Tab On Detection behavior.

# SD Companion V1.5.21

## 1.5.21 — Per-action queue cancellation

- Added a **Cancel** control beside each Pending/Running action in Home → Issue Action History, so
  users no longer need to delete a Jira server to stop queued work.
- Pending jobs cancel immediately: their timer/alarm is removed, the job becomes `cancelled`, and
  the idempotency ledger records the cancellation so the same execution-policy occurrence is not
  immediately re-queued on the next poll.
- Running jobs use cooperative pre-write cancellation. Cancellation is accepted while the job is
  still validating/read-only preflight; the worker checks cancellation again after awaited
  preflight/reservation steps and immediately before every irreversible action.
- Once a Jira write/notification/alarm dispatch has started, cancellation is refused with
  `ACTION_ALREADY_DISPATCHED` rather than falsely claiming that a remote change was undone.
- Cancellation requests and outcomes are recorded in the Audit Journal. Cancelling one action does
  not implicitly cancel later independent jobs already queued for the same issue.
- Added regression coverage for queued cancellation, running pre-write cancellation, refusal after
  Jira dispatch, ledger behavior, and the Home cancellation control/message contract.

# SD Companion V1.5.20

## 1.5.20 — Cross-machine Jira network compatibility

- Removed the forced `targetAddressSpace: "local"` assertion from Jira worker requests. This avoids
  Chromium Local Network Access failures when the hostname is intranet-like but Chrome
  resolves/routes the request through an `unknown` address space (for example through a proxy, PAC,
  VPN or different DNS/network stack).
- Browser/OS network classification is now authoritative for both HTTPS API calls and
  browser-session workflow-name lookups.
- Replaced the misleading catch-all `SECURE_CONNECTION_FAILED` classification with
  `NETWORK_REQUEST_FAILED`. A Fetch rejection before an HTTP response can represent Local Network
  Access/CORS policy, TLS validation, DNS, proxy/VPN routing or reachability; JavaScript cannot
  reliably distinguish those cases.
- Pre-HTTP failures remain fail-closed and are not retried by the Jira client. No Jira-tab REST
  fallback or certificate bypass was introduced.
- Server Health now reports **Jira API unreachable** with policy/reachability troubleshooting
  instead of automatically blaming certificate trust.
- Added regression coverage that forbids `targetAddressSpace` in Jira requests and verifies the new
  network-failure classification.

# SD Companion V1.5.19

## 1.5.19 — Toggle alignment and alarm simplification

- Vertically centered the shared Home/Settings toggle thumb using a 50% anchor so both OFF and ON
  positions remain centered regardless of track rendering.
- Removed alarm escalation from Alarm Studio, per-rule Alarm actions, defaults, validation, rule
  execution payloads, and runtime scheduling.
- Migration removes legacy escalation fields from saved alarm defaults/actions. A one-time runtime
  cleanup clears any escalation timer left by an older build.


## Home refresh and readability hardening
- Fixed Home live polling so fresh state updates the radar, monitoring counters/timing,
  API/last-cycle/request health tiles, alarm panel, detections and issue-action history without
  requiring page navigation or manual refresh. Expanded issue-history rows remain open during
  refresh.
- Returning to Home now pulls a fresh worker state snapshot before rendering.
- Reduced the shared Home/Settings `.master-switch` to standard mobile-toggle proportions while
  retaining one implementation everywhere.
- Raised unreadably small operational/settings typography and reduced excessive bold weight on
  micro-text.
- Relaxed Rule card density, restored readable title/metadata/button sizes, and anchors Edit/Close
  controls to the right side of each card.
- Connection-loss system notifications and Jira-page alarm popups now identify the event as **API
  Unreachable** instead of a Jira issue detection.

# SD Companion V1.5.17

## Exact Home-toggle reuse
- Settings and other ordinary boolean controls now render the exact same `.master-switch` component
  used by the Home monitoring control; there is no separate Settings switch implementation or
  duplicated geometry.
- Removed the V1.5.16 checkbox-based imitation CSS that only copied Home dimensions and could render
  differently.
- Added a regression test that checks the actual Settings markup uses `.master-switch` and that no
  second checkbox switch implementation exists.

# SD Companion V1.5.15

## UI geometry and spacing hardening
- Reworked ordinary boolean switches and the Home monitoring switch to thicker Android/iOS-style
  mobile toggle proportions with a substantial circular thumb instead of the previous thin pill
  appearance.
- Inset/clipped scrollbars for rounded scrolling surfaces so scrollbar tracks/thumbs remain visually
  inside their owning boxes.
- Added editor flow-spacing invariants so buttons, rows, and adjacent boxes keep explicit clearance
  throughout rule/server/settings surfaces.
- Boxed every rule condition as its own compact condition card and separated the + Condition control
  from the condition list.
- Compacted and separated Settings synchronization metadata so Last/Next timestamps no longer
  concatenate (for example, AMNext).

# SD Companion V1.5.14

## UI polish and compatibility terminology
- Fixed Rules → Saved Filters live search and Enter-key filtering.
- Reworked boolean switch geometry to a conventional straight-track capsule with semicircular ends.
- Renamed transition handling modes and moved static explanatory copy out of operational screens
  into Help.
- Compacted server Connection controls and prevented their labels from wrapping.
- Removed redundant “Changes apply after Save” copy from Settings.
- Widened time-unit selectors so Seconds/Minutes/Hours remain fully visible.


- Added a configurable per-server Jira connection-loss alarm. It can trigger after a configured
  outage duration, a configured number of consecutive failed health checks, or either threshold; it
  uses the active profile's Alarm Studio sound and fires once per outage until connectivity
  recovers.
- Added searchable fetched Jira filters in Rule configuration.
- Slimmed Current/Recent detection cards and Rule cards to reduce vertical density while preserving
  their controls and status information.
- Fixed scheduled-poll radar/current-detection staleness: action planning remains incremental, but
  each normal cycle now refreshes a full current-match snapshot so markers disappear as soon as an
  issue no longer matches.
- Added spacing between the Data search bar and its inventory card.
- Reworked ordinary boolean settings into slider switches and fixed Alarm Studio Attention controls
  so labels stay inside their cards. Multi-select dataset/filter/day controls retain their
  selection-specific UI instead of being misrepresented as switches.
- Added a per-server transition handling method with four modes. Current UI names are **Full
  Workflow Map (Recommended)**, **Issue-Based Transition Discovery**, **Target Status + Runtime
  Choice**, and **Manual Transition Name**.
- Workflow Designer and Issue extraction keep the existing transition-ID rule architecture and
  contextual transition picker. Target-status mode resolves current executable transitions against
  the exact issue and randomly chooses only when more than one available transition reaches the
  selected target. Manual-name mode resolves an exact case-insensitive name and fails rather than
  guessing when multiple currently available transitions share that name.
- Rule fields for inactive transition handling methods are preserved, allowing a server to switch
  protocols without destroying previously configured transition/target/name values.
- Runtime transition execution never falls back across protocols: catalog modes require the
  configured transition ID, target-status mode resolves by destination, and manual-name mode
  resolves by exact name.

# SD Companion V1.5.12

- Replaced issue-sampling transition discovery with Jira's read-only Workflow Designer graph.
- For each project / issue type, one lightweight REST search finds an accessible representative
  issue; the extension worker fetches the server-rendered `/browse/KEY` page with the existing Jira
  browser session only to extract `workflowName`.
- The complete live workflow graph is then fetched with the PAT from
  `/rest/workflowDesigner/latest/workflows?name=...&draft=false`.
- Workflow graphs are cached by workflow name during synchronization, so issue types/projects
  sharing a workflow do not re-download the same graph.
- Existing contextual transition identity is preserved: project + issue type + source status +
  transition action ID + target status. No name-only/global deduplication was introduced.
- Initial/Create transitions are excluded; global transitions are projected into every normal
  source-status context; loop transitions are preserved.
- Existing Rule transition selection/filtering and runtime issue-transition revalidation are
  unchanged.
- Failed workflow refreshes retain the previous transition data for that project / issue type and
  mark it stale instead of wiping the catalog.
- Transition cards now describe Workflow Designer discovery rather than obsolete issue-sampling
  observations.
- Verified against Jira Data Center 10.3.9; other Jira versions are feature-detected because
  Workflow Designer's internal REST surface is not a stable public API contract.

# SD Companion V1.5.11

- Reworked transition discovery around issue-count-aware, status-stratified sampling.
- Issue types with fewer than 30 visible issues are scanned completely.
- Larger issue types use a bounded transition-probe budget below 50, distributed across current
  statuses.
- Samples are spread across the issue history using Jira search pagination instead of only
  newest/oldest issues.
- Transition identity remains contextual by project, issue type, source status, transition identity,
  and target status.
- Preserves the V1.5.10 expandable transition-card UI and worker-only Jira networking.

## 1.5.10 - Diversified transition discovery and transition cards

- Replaced hard-coded two-most-recent-issues transition probing with bounded diversified probing per
  exact project / issue-type / source-status context.
- Each context searches at most 20 lightweight candidate issues and probes at most 8 representative
  issues selected for metadata diversity; the project issue population is never crawled
  exhaustively.
- Transition observations are deduplicated only inside the same exact workflow context; transitions
  are never merged across projects, issue types or source statuses.
- Data → Transitions now uses styled expandable cards. Cards show a concise transition summary and
  expand to Project, Issue Type, Before Status, After Status, discovery observations and required
  fields. Transition IDs are no longer displayed.
- Kept worker-only REST networking, rules, actions, staged settings and execution mechanics
  unchanged.

## 1.5.9 - Settings message compatibility fix

- Fixed `Unknown message: SAVE_SETTINGS` when Chrome had a newer popup/side-panel UI open while an
  older extension service worker was still alive.
- New settings saves use the established revision-checked `GET_STATE` + `SAVE_STATE` contract,
  preserving transactional Save/Cancel semantics without relying on a newly introduced message type.
- Kept the `SAVE_SETTINGS` service-worker handler for backward compatibility with already-open
  V1.5.8 UI contexts during extension reload/update.
- Added UI/worker message-contract and settings rolling-compatibility regression tests.
- No Jira discovery, transition, rule, action, alarm, or networking mechanics changed in this
  release.

## 1.5.8
- Removed the Jira-tab REST transport and all REST fallback/injected-request code. Jira API traffic
  now originates only from the extension service worker.
- Removed the REST Transport, Network Destination, and Certificate Handling controls from Server
  settings.
- Local/intranet destination handling is automatic for recognized private hosts; there is no manual
  network-destination selector.
- TLS/SSL trust is delegated to Windows/Chrome. Secure-connection failures are fail-closed,
  non-retryable at the Jira client layer, and reported with `SECURE_CONNECTION_FAILED`.
- Kept Jira-tab usage only for independent UI features such as optional tab refresh and in-page
  alarm popup; tabs are no longer required for REST access.
- Updated state schema to 25 so legacy transport/address-space/certificate settings are discarded.

## 1.5.7
- Restored transition discovery to the documented Jira Data Center issue-transition endpoint used by
  the older build.
- Transition identity is contextual: project + issue type + before status + transition + after
  status.
- Removed global transition merging in the rule action picker.
- Added explicit Project / Issue Type / Before Status / Transition / After Status columns in API
  Data.
- Renamed discovery dataset label from States to Statuses and adjusted project-column padding.

## V1 · Build 1.5.6 — Contextual Transition Discovery Repair

- Restored the proven transition discovery shape from the earlier stability build: every selected
  project / issue type / source-status context is inspected, with only two representative issues per
  context.
- Added an optional Jira transition-metadata request using `includeUnavailableTransitions=true`;
  unsupported servers fall back to the standard transition endpoint automatically.
- Removed global transition collapsing from synchronization counts and the Data page. A transition
  is now represented together with its workflow context.
- Kept field synchronization, rule execution, settings, alarms, and Home activity refresh mechanics
  from 1.5.5 unchanged.

## V1 · Build 1.5.5 — Bounded Jira Metadata Synchronization

- Reverted the 1.5.4 full-issue transition crawl. Transition discovery now covers every selected
  project / issue-type / status context but probes at most five representative issues per context,
  matching Jira Data Center's issue-scoped transition API without enumerating the project's issue
  population.
- Jira field synchronization now uses one `GET /rest/api/2/field` request and stores each visible
  field once instead of duplicating create-metadata fields per project/issue-type context.
- Data → Transitions now collapses contextual reuse into unique transition definitions while the
  internal contextual catalog remains intact for rule filtering.
- Transition/field freshness and inventory counts now reflect unique synchronized entities rather
  than workflow-context duplication.
- Retains the 1.5.4 Home Detections / Action History auto-refresh fixes.

## V1 · Build 1.5.4 — Complete Transition Discovery / Reliable Home Refresh

- Transition synchronization now inspects every accessible issue in each selected project /
  issue-type / status workflow context instead of sampling only a few recent issues, then
  deduplicates all transitions visible to the PAT.
- Removed the obsolete per-context transition sampling control because synchronization is no longer
  sample-based.
- Monitoring cycles now publish the latest Current detections into profile runtime state.
- Home Detections and Issue Action History polling no longer pauses indefinitely while cards are
  hovered/focused; the configured refresh interval is honored continuously.
- Expanded Issue Action History rows are restored after an automatic refresh.

## V1 · Build 1.5.3 — Contextual Transitions / Staged Editing / Fast Activity Refresh

- Transition and target-state selectors now narrow synchronized workflow data using rule Project /
  Issue Type / Status conditions, raw JQL and selected Jira filter JQL.
- Filter discovery hydrates missing JQL through the individual filter resource when permitted.
- Changing a rule context automatically clears a transition/target selection that is no longer valid
  for that context.
- Rule editing is now a local draft with explicit **Save Rule** / **Cancel**; adding
  conditions/actions no longer writes partial rule configuration immediately.
- Rule editor is split into Setup, Conditions, Actions and Advanced views.
- Settings changes are staged behind explicit **Save** / **Reset**, including opening mode, global
  safety limits, metadata auto-sync, Home activity refresh and completion-tone preference.
- Periodic metadata synchronization uses a normal switch.
- Home Detections and Issue Action History refresh at a configurable interval; default is 3 seconds
  and refresh remains deferred while the user is interacting with/reading the activity cards.
- Added optional fixed low-volume soft completion tone after successful non-alarm actions.
- Home activity polling was lightened so the fast UI refresh does not repeatedly load the Audit
  Journal.
- Schema updated to 22.

## V1 · Build 1.5.2 — Transition Action Editor Hotfix

- Fixed the misleading `transition action needs a synchronized transition` error when adding a
  Transition action to an already-enabled rule.
- Configurable actions that require user input (Transition, Comment, Priority) are now added
  disabled when the rule is already enabled, allowing the editor to open before validation.
- Validation wording now distinguishes an unselected transition from missing synchronized metadata.
- Data → Transitions now counts/displays actual discovered transitions rather than
  transition-context containers.
- Transition action selector is built from the same transition catalog used by Data and shows a
  clear empty-inventory message when no transition choices exist.
- Added regression coverage for enabled-rule action creation and transition inventory
  representation.

## V1 · Build 1.5.1 — Rule Creation / Alarm Studio / Activity Refresh Fix

- Fixed new-rule creation so a disabled draft is persisted and opened before complete rule
  validation is required.
- Added a schema-21 migration that removes the legacy stock `Business Hours` / `Bussiness Hours`
  schedule and disables any enabled rule that depended only on that removed schedule.
- New Jira servers now bind their first profile as `Default Profile`; legacy auto-created profiles
  named exactly like their server are normalized during the 20 → 21 migration.
- Removed the long Jira filter-enumeration limitation notice from the Data workspace and moved the
  detailed explanation to Help.
- Reorganized Alarm Studio into Sound & playback, Stopping, and Attention sections. Escalation is
  now a selectable mode instead of a toggle.
- Clarified Stop behavior labels and retained existing stop semantics.
- Added a deferred 30-second Home refresh for Detections and Issue Action History. Refresh is
  postponed while an activity card is hovered/focused or an issue detail is expanded, then resumes
  after the user leaves/closes it.
- Packed the project discovery dataset matrix toward the project name so selector columns no longer
  drift far right; long project names ellipsize safely and the Transitions header stays inside the
  surface.
- Increased local control spacing where buttons directly follow fields/grids to prevent visual
  collisions without returning to oversized page spacing.

# Changelog

## V1 · build 1.5.0
- Removed the execution-mode switch; enabled rules now execute live.
- Moved safety limits to global Automation settings and strengthened same-cycle hourly cap
  enforcement.
- Removed automatic/default named schedules; rules explicitly choose Always On or user-created
  schedules.
- Added selectable time units across human-facing timing controls.
- Added periodic transactional project-metadata synchronization.
- Added per-issue action history with completed/pending/failure detail on Home.
- Reworked comment templates into separate entries and contextual Assignment controls.
- Made Rule and Server editors fully collapsible.
- Redesigned the Data workspace and compacted the Home monitoring/radar console.
- Fixed project discovery matrix sizing and bottom-navigation scroll clearance.
- Strengthened Jira-tab refresh matching, reload fallback and diagnostics.
- Added hybrid short-delay scheduling for sub-30-second action timing.
- Generalized Help content and removed current execution-mode labels.

# V1 / 1.4.8

- Fixed project discovery selection drift: per-project dataset switches are now the single source of
  truth for deep sync.
- Fixed Server and Data sync buttons disagreeing about whether a project is selected.
- Fixed false “Select at least one project” errors when datasets are configured.
- Migration repairs stale `selectedProjectKeys` compatibility cache from configured project
  datasets.
- Deep sync and scope hashing derive project scope directly from enabled datasets.

# V1.4.7

- Global optional Dry Run/LIVE switch.
- Condition operator cardinality fixed: single-value operators cannot retain multiple values.
- Duplicate Jira server URLs are rejected instead of silently reusing/replacing an existing server.

# Changelog

## V1 / 1.4.4
- Radar markers are unique per issue and now clear on a zero-detection scan.
- Radar uses a single sweep, thicker frame, more compact stats, and grays out when Monitoring is
  off.
- Pause controls and pause engine state removed.
- Alarm rule actions are allowed to play locally while all Jira-changing actions remain Dry Run
  blocked.

# Changelog

## V1 · Build 1.4.3 — Compact Operations & Detection Views

- Compacted Home, cards, lists, forms, context ribbon, and general spacing without changing the
  bottom-navigation icons.
- Replaced the Home pause-button cluster with one compact pause-duration selector plus Pause/Resume.
- Removed the duplicate Home Refresh button; the top-ribbon refresh now reloads extension state,
  while API Data refresh actions remain Jira API operations.
- Added explicit Server and Profile labels to the context ribbon.
- Added Current / Recent detection views. Current matches are refreshed through a read-only rule
  evaluation that never queues actions.
- Added Jira issue-type icons from API `iconUrl` when available, plus themed fallback icons for
  issue types, states, transitions, fields, filters and generic metadata.
- Added a small gap between bottom-navigation hover/active surfaces.
- Reduced excess Rules-page scroll space below the last card.
- Dry Run remains hard-locked.

## V1 · Build 1.4.2 — Settings & Surface Polish

- Rebuilt Settings as a category rail plus focused glass content workspace.
- Replaced the top-ribbon refresh artwork with a single restrained refresh glyph and matching
  control surface.
- Removed the radar sweep leading-line pseudo element so exactly one animated sweep remains.
- Fixed page-header action layout and the empty Add Jira server state so buttons cannot collide with
  headings/text.
- Reduced the side-panel narrow-layout guard by 20%, from 646 px to 517 px (rounded), while
  retaining the 980 px maximum centered canvas.
- Dry Run remains hard-locked.

## V1 · Build 1.4.1 — Discovery, Rules & Theme Stabilization

- Added independent per-project discovery switches for Users, Fields, Issue Types, States and
  Transitions.
- Added project/issue-type field discovery and strict project/dataset scope isolation.
- Improved saved-filter discovery diagnostics: owned-filter enumeration is attempted independently
  of issue results, favourites are merged, and REST coverage is recorded as owned+favourites,
  favourites-only, or unavailable.
- Simplified the Rules condition editor to one condition list with All conditions / Any condition
  semantics.
- Decoupled theme/log appearance saves from unrelated API request-policy validation and clamps
  legacy invalid request pacing values during migration.
- Removed residual Emerald-only structural colors from alternate themes.
- Replaced the radar quadrant sweep with a full-disc themed sweep.
- Redesigned the top refresh icon/control.
- Preserved transactional/cancellable discovery and the hard Dry Run write barrier.

## V1 · Build 1.4.0 — Reliability Architecture

- Added explicit per-rule execution policies, safety limits, idempotency ledger, per-issue locks and
  rule conflict handling.
- Added two-phase action reservation states for future live execution; Dry Run remains hard-locked
  in this build.
- Added transactional inventory snapshots, cancellable long operations and selected-project scope
  revision checks.
- Added optimistic configuration revisions so stale UI/background writes are rejected instead of
  overwriting newer settings.
- Added explicit Always On / Named Schedule rule gates and fail-closed scheduled-rule semantics.
- Added incremental rule polling cursors with overlap windows.
- Added adaptive per-server REST scheduling: spacing, jitter, requests/minute, concurrency, timeout,
  retries, backoff and health heartbeat.
- Added server capability and permission matrices, inventory freshness, Jira request statistics,
  user avatars and project logos.
- Added typed condition registry, effective JQL preview, action dependency validation and ordered
  action sequencing.
- Removed global action randomness; added rule-default Min/Max delay with per-action overrides.
- Rebuilt Home as an operational dashboard with a master Monitoring switch, Scan Now, pause/resume,
  counters, radar and alarm state.
- Added structured Audit Journal, log-level controls, JSON export, profile import preview,
  cache/profile-data clearing and Factory Reset.
- Added strict profile/server deletion cascades through jobs/cursors/ledger/logs/audit and
  credential state.
- Added alarm escalation and action-toolbar badge state.
- Increased the side-panel design floor to 646 px and bounded the application canvas to 980 px.
- Optimized idle CPU behavior: no recurring monitor wake-up is installed while all profile
  Monitoring switches are OFF.

## V1 · Build 1.3.8

- Portaled all custom dropdown menus to the document root with viewport-aware positioning so
  expanded lists stay above cards and do not get clipped by glass/backdrop-filter stacking contexts.
- Removed remaining Emerald-specific structural surface colors; controls, radar, overlays and panels
  now derive their colors from the active theme tokens.
- Fixed intermittent Rules rendering by adding missing normalized issue-type/status helpers, safe
  page rendering, and navigation/dropdown cleanup.
- Added a global interface-state refresh control plus explicit Stage 1 (Projects & Filters) and
  Stage 2 (Selected Data) refresh actions.
- Added bounded side-panel application sizing: a stable minimum design width and centered
  maximum-width canvas, while the theme background expands outside the app on wide panels.
- Dry Run remains forcibly locked; no live Jira write execution is possible in this build.

## V1 · Build 1.3.7

- Replaced all visible single-select dropdowns with Mail Beacon-inspired glass soft-select controls.
- Moved Popup / Side Panel selection into the redesigned Settings page.
- Fixed side-panel responsive sizing so the UI follows the browser divider dynamically.
- Increased the header application icon slightly.
- Ported the Mail Beacon V9 built-in alarm tone catalog and improved Alarm Studio controls.
- Removed the Radar topic and implementation-size copy from in-extension Help / Appearance.
- Dry Run remains forcibly enabled; no live Jira write actions are permitted.

## V1 build 1.3.6 — Project-Scoped Discovery & Glass Lists

- Replaced browser-native multi-select lists with rounded glass choice lists throughout Rules,
  Conditions, Shifts, assignment pools, and project discovery.
- Added circular themed checkbox styling globally.
- Changed server setup to two-stage discovery: projects + saved filters first, then deep
  synchronization only for explicitly selected projects.
- Persist selected project scope per Jira server and preserve valid selections after project-list
  refreshes.
- Removed roles, versions, and components from synchronization and from the Data inventory.
- Removed the global visible-user crawl from deep synchronization; user discovery is now scoped to
  selected projects through assignable-user APIs plus relevant owners/leads.
- Expanded saved-filter discovery by merging the current-user filter endpoint, owner-scoped filter
  search, and favorites. Filter discovery is independent of whether filters currently return issues.
- Saved filters are optional in Rules; constrained JQL can be derived from supported logical/Jira
  conditions.
- Collapsed server configuration into on-demand glass disclosure sections opened through Edit.
- Fixed live slider value labels for Alarm volume and per-rule Alarm volume using a shared
  slider-output handler.
- Dry Run remains forcibly enabled and Jira write actions remain blocked.

## V1 build 1.3.5 — Emergency Dry Run Safety Patch

- Reintroduced and forcibly enabled Dry Run.
- Jira write/action execution is hard-blocked in the job executor.
- Existing pending/running jobs are quarantined as simulated on startup.
- Existing rules are disabled once when migrating into build 1.3.5.
- Removed the factory `New Jira issue` rule and known factory comment templates.
- New profiles contain zero rules; new rules contain zero actions; new comment actions contain zero
  templates.
- Added visible DRY RUN indicators to Home, Rules, Settings, and the top bar.

## V1 · Build 1.3.4
- Modern glass list/control redesign.
- Removed blind issue inventory synchronization and the Data > Issues category.
- Detection no longer falls back to an unconstrained all-issues query.
- Added condition-derived JQL constraints for supported condition fields.
- Transition discovery now uses targeted context sampling only.
- Added Mail Beacon-style alarm stop methods and prominent Stop controls.
- Added system-notification alarm option, notification Stop button and additional Web Audio tone
  presets.
- Added comprehensive Help & Reference page.
- Added non-destructive operation overlays and sync progress messages.
- Side panel UI now uses 100% of available panel width.

## V1 · Build 1.3.2 — Toolbar Surface Fix

- Restored a true Chrome/Edge toolbar-attached action popup.
- Popup is now 800×600, the maximum supported action-popup size.
- Removed the floating `chrome.windows.create({type: "popup"})` control window.
- Side-panel mode now uses Chrome native `sidePanel.setPanelBehavior({openPanelOnActionClick:
  true})`.
- Closing the side panel no longer disables toolbar reopening; the toolbar icon toggles/opens it
  natively.
- Switching back to Popup mode restores `action.setPopup()` and disables side-panel-on-action
  behavior.
- Packaging corrected so the archive contains exactly one top-level `SD-Companion-V1/` root
  directory.

## V1 — Build 1.3.1 — Stabilization & Large-Surface Fix

- Replaced the height-limited browser-action popup with an extension popup window opened from the
  toolbar at approximately 820 × 900 px; Side Panel remains the alternate toolbar mode.
- Fixed the Rules page crash caused by an undefined `ACTION` constant.
- Removed Dry Run / Live Mode completely. Enabled rules execute live; execution-time Jira
  revalidation, limits, cooldowns, request pacing, and rule enable/disable remain.
- Removed the 30-second side-panel state reload that re-rendered forms while users were typing.
- Added serialized/transactional state updates so browser-tab and health updates cannot overwrite a
  freshly synchronized Jira inventory.
- Changed API inventory synchronization to commit its catalog atomically at the end instead of
  repeatedly persisting the entire state during progress updates.
- Added `unlimitedStorage` permission for large Jira metadata catalogs.
- Reduced storage pressure by capping logs, jobs, ledger history, and oversized log details.
- Added project discovery fallback from `/project` to paginated `/project/search`.
- Made full synchronization fail visibly when authentication succeeds but all core metadata
  endpoints fail instead of falsely reporting a successful empty catalog.
- Made transient health-check/network failures non-destructive: an already healthy server remains
  connected, enters a degraded-health state, and retries automatically every minute. Only Jira
  401/403 is treated as authentication failure.
- Increased fonts, cards, controls, spacing, radar size, list rows, and navigation sizes throughout
  the UI.
- Rounded all primary UI elements and added theme-aware custom range controls.
- Fixed the global randomness slider so its value changes live and uses the active theme instead of
  the browser's default blue styling.
- Debounced browser-tab status tracking to reduce background writes and state churn.
- State schema is version 7. Previous V1 states are migrated automatically, including removal of old
  Dry Run fields.

## V1 — Build 1.2.0 — Full Metadata Mirror and Advanced Rules

- Added broad Jira REST metadata synchronization, user aggregation, transition cataloging, advanced
  conditions, and reusable shifts.

## V1 — Build 1.1.2 — Dual REST Transport

- Added automatic REST fallback from the extension worker to an open Jira-tab REST bridge for
  intranet/browser-network cases.

## V1 — Build 1.1.0 — REST API Rebuild

- Replaced UI-click automation with Jira REST API v2 execution using PAT authentication.

## V1 · Build 1.3.3
- Replaced message-listener Jira-tab transport with direct `chrome.scripting.executeScript()`
  isolated-world REST transport.
- Jira-tab fallback now automatically opens an inactive Jira tab when no matching tab exists, then
  attempts API transport there.
- Popup width reduced exactly 25% from 800 px to 600 px; height remains Chrome's attached-popup
  maximum of 600 px.
- Side-panel application canvas reduced exactly 30% to 70% of the browser side-panel viewport.
- Replaced bottom navigation glyphs with consistent rounded line SVG icons.
- Renamed More to Settings.

## V1 internal build 1.4.6 — Live radar / alarm-control stabilization

- Jira-changing actions remain hard Dry Run locked; local Alarm actions remain live for testing.
- Scheduled monitoring cycles now broadcast completion to open SD Companion surfaces so Home/radar
  state updates without requiring manual Scan Now.
- Radar current markers are keyed by issue and retain their original detection timestamp while they
  remain in scope; the newest current marker is red and older current markers use the active theme
  color.
- Fixed the top-ribbon Stop Alarm control so it uses the same STOP_ALARM path as Alarm Studio,
  including Alarm Studio test alarms.
- Chrome notification alarms now record notification permission state, use a persistent notification
  with a Stop Alarm button, and log notification creation failures.
- Added a Mail Beacon-style glass alarm popup injected into open configured Jira tabs. It is
  display-only and does not inspect Jira DOM data; it contains a direct Stop Alarm control.
- Added per-server `Refresh Jira tab on new detection`. Only newly entering issue keys trigger a
  Jira-tab refresh; unchanged current matches do not create a refresh loop.
- Combined Monitoring, Scan Now, radar, Detections, Actions and Evaluated metrics into one compact
  Home operations card.
- Hardened UI event handling around early runtime messages, optional import controls, click targets
  and multi-choice groups.
- Server behavior settings are included in profile export/import.
## V1 internal build 1.4.6 — Alarm hard-stop hotfix

- Stop Alarm now force-closes the MV3 offscreen audio document after requesting a graceful stop,
  guaranteeing generated/custom alarm audio cannot continue because of a stale offscreen context.
- The offscreen document is recreated automatically on the next alarm.
- Stop also clears alarm timers, escalation timers, notification UI, Jira alarm popup, active-alarm
  runtime and toolbar badge state.
- Jira-page alarm Stop button now waits for a successful STOP_ALARM response instead of disappearing
  unconditionally.
