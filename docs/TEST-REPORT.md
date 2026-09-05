# V2 Build 2.5.4 Test Report

## Result

- JavaScript regression files: 74/74 passed.
- Static architecture/security test: passed.
- JavaScript syntax validation: 114/114 passed.
- JSON parsing validation: passed.

## V2.5.4 focused coverage

- Connection-loss duration is a bounded value/unit pair rather than a full-width nested grid, with a fixed Unit width and protected gutter at narrow Side Panel widths.
- Action Completion Tone is no longer a bordered settings card; it renders as plain inline text with its toggle on a separate Operational Feedback row.
- Collapsed Action cards use block card geometry plus a single centered flex summary, removing the hidden grid-row gap that visually biased controls toward the top.
- Searchable multi-select option rows retain normal height when filtering leaves a single visible result.
- Release archives remain validated to ensure `SD-Companion-v2.5.4/` is the sole top-level folder.

## V2.5.1 focused coverage

- Navigation regression coverage verifies that clean editors are collapsed/discarded when leaving their page while dirty Rule, Schedule, Server, Settings, Appearance, Alarm Profile, and Profile editors block page/context navigation until resolved.
- JQL saved-filter migration preserves `filterIds`, filter-only legacy rules are inferred as JQL rules, and Manual/JQL is rendered as a single-choice select rather than concurrent tabs.
- Method switching clears only the previous method configuration at the time of the switch: JQL sources are cleared when moving to Manual, and Manual condition logic is reset when moving to JQL.
- Transition API Data rows no longer render the +/- disclosure bubble and use the standard compact metadata-row density.
- Alarm Profile editing exposes a default-profile checkbox and preserves the invariant that every profile has exactly one default Alarm Profile.
- Appearance includes Black, Aurora Night, Cyber Night, and Slate & Gold while Violet Dusk and Amber Smoke are retired and migrated to supported replacements.
- Action Completion Tone uses a compact settings row and configured Schedule activity dots precede schedule description text.
- Release archives remain validated to ensure `SD-Companion-v2.5.1/` is the sole top-level folder.

## V2.2.1 focused coverage

- Help topics render without custom arrows/chevrons, and Rules list entries render deterministic local SVG icons.
- Detections & Actions has one per-issue action-bearing list; the duplicate standalone detections list and its secondary list heading are absent.
- Current/Recent activity views operate on issues that have recorded jobs, while active jobs remain visible in Current even if the issue is no longer in the latest detection snapshot.
- Monitoring renders Detected, Actions, and Rules statistics and no longer renders the Evaluated tile or rule-count ribbon.
- Home card hierarchy/alignment, Detections & Actions toolbar alignment, symmetric soft-select menu gutters, and boxed Security indicators are covered by the v2.2.1 UI regression.
- Release documentation verifies the versioned top-level extraction folder layout.

## V2.2.0 focused coverage

- Removed empty-schedule and action-refresh helper text while keeping the useful primary Home states.
- Scan Now / Check now and background monitoring are blocked when no enabled rules exist.
- Server/profile ribbon structure, dark-theme choices, Settings main-tab styling, Back navigation, and immediate Side Panel opening are covered by the v2.2.0 UI regression.
- Device-local protection explanatory copy is absent from Settings while the security implementation remains unchanged.

## V2.1.1 focused coverage

- Combined Home Detections & Actions rendering, Current/Recent controls and profile-wide action controls are covered by source/render regressions.
- Show completed verifies whole-issue filtering while retaining completed action context for issues that still have active work.
- Rules owns the Bulk Operations entry point; Home no longer exposes the Bulk button.
- Active Schedule wording, compact Last Cycle error rendering and removal of left-edge list accents are statically covered.
- Profile duplication verifies fresh identifiers, remapped schedule/pool references, reset runtime state and Monitoring disabled on the copy.
- Settings Automation subpages and removal of the protected-actions Security panel are covered; Help retains the protected-action explanation.
- Handled UI action errors no longer use `console.warn`, avoiding redundant Chrome extension Errors entries for failures already handled by toast/logging.

## V2.1.0 focused coverage

- Bulk Operations generate transient `bulk-operation` jobs with embedded rule snapshots and unique
  one-time ledger keys; the bulk definition is not required to exist in saved profile rules.
- Per-action **Needs approval** plans `awaiting-approval` jobs. Single approval preserves due time and
  bulk approval arms only chain roots while dependent children remain dependency-gated.
- Global local-alarm cancellation covers both Pending and Awaiting approval alarm jobs without
  cancelling Notification jobs.
- Per-rule local-alert throttling covers Alarm/Notification actions across multiple matching issues
  and considers recent existing local-alert jobs.
- Action History source contracts verify Approve all, Show completed, active-first/newest-first
  ordering, and the Bulk Operations entry surface.
- Stable browser action-notification identity and stop-all audio generation/cancellation integration
  are statically covered.

## V2.0.12 focused coverage

- Device-local extension lock stores only a salted PBKDF2-SHA256 verifier; plaintext PIN/password
  storage is explicitly regression-tested against.
- PIN lock/unlock, explicit Lock Now state, session-duration updates, disable flow, and short-lived
  sensitive-action token validation are covered.
- Popup and side-panel lock overlays plus the dedicated Settings → Security tab are statically
  verified.
- Worker-side lock enforcement and mandatory re-authentication for sensitive actions are covered.

## V2.0.11 focused coverage

- Large secure backup encryption/decryption round-trips a 750 KB payload without argument-stack
  overflow.
- Secure backup Base64 conversion uses bounded chunks instead of spreading the entire ciphertext
  into `String.fromCharCode`.
- Regular profile import with no PAT cannot inherit a stale exported API Online state; imported
  runtime health becomes PAT missing.
- Imports with a PAT or an already-stored credential start at Check required until a live Jira
  health check succeeds.
- Top badge, Home, Health, Jira Servers, and API Data all derive PAT presence from the real
  credential store.
- Monitoring cycles, health heartbeats, periodic metadata sync, and connection-loss alarms are gated
  by actual credential presence; missing PAT is not treated as a Jira outage.
- Import preview uses bounded server/profile cards, an authentication/count summary table, and
  separate wrapping rule/schedule/comparison cards.
- Serverless profile import remains supported with zero configured Jira servers.
- V2.0.8 schedule-selector, selected-first-list, and immutable Action History ordering regressions
  remain covered.

## V2.0.7 focused coverage

- Individual **Process** executes a Pending action immediately even when its queued due time is in
  the future.
- Confirmed **Process all** supports one issue or all Pending jobs in the active server/profile and
  rejects missing scope.
- Manual processing bypasses only the queued due time/current schedule window; action-specific
  preflight is still invoked.
- **Relative update** re-anchors an After previous child to manual predecessor completion +
  configured dependency delay.
- **Preserve schedule** resolves the dependency without rewriting the child `scheduledAt`.
- Comment actions are not cancelled merely because Jira status changed.
- Transition actions cancel when their planned/derived source status changed.
- Assignment actions cancel when assignee changed; Priority watches priority; Labels watches labels;
  Edit Fields watches only modified fields.
- Explicit action-level conditions remain execution-time requirements.
- Chained actions can inherit successful predecessor results for the same guarded field so SD
  Companion's own change is not mistaken for an external conflict.

## Preserved regression contracts

The suite continues to cover worker-only Jira REST, no Jira-tab transport fallback, TLS/browser
validation, no forced targetAddressSpace, contextual workflow transitions, schedule drafts/multiple
schedules, radar marker snapshot refresh with continuous V1 sweep, monitoring toggle serialization,
profile import/export security, queue cancellation boundaries, anchored relative scheduling, and
dependency cancelled/skipped/failed policies.

- `tests/v211-final-ui-test.js` covers the final Home/status consolidation, no-rule scan guard, context ribbon, Settings navigation, side-panel opening, and dark-only theme set.
