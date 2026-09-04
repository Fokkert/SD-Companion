# V2 Build 2.1.1 Test Report

## Result

- JavaScript regression files: 64/64 passed.
- Static architecture/security test: passed.
- JavaScript syntax validation: passed.
- JSON parsing validation: passed.

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
