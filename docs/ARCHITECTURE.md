# Architecture

SD Companion V2 is an API-first Manifest V3 extension organized into shared models, a Jira REST
client, background automation services, and one reusable popup/side-panel application surface.

## Data path

1. A configured Jira Server stores URL, metadata scope, request policy, transition handling method
   and other non-secret settings.
2. The PAT is stored separately from exported normal configuration.
3. Jira networking runs only from the extension service worker. There is no Jira-tab REST fallback.
   Chromium/OS network and TLS validation are authoritative. SD Companion does not force a Local
   Network Access `targetAddressSpace`; Chrome/Edge determine the resolved address space. Any
   pre-HTTP network-policy/reachability failure stops the current operation.
4. Project/filter discovery is Stage 1.
5. Deep metadata synchronization is limited to the per-project datasets explicitly enabled by the
   user.
6. Transition handling is selected per Jira server:
   - **Full Workflow Map (Recommended)** (default): one browser-session `/browse/ISSUE` metadata
     lookup identifies the workflow name, then the PAT retrieves the complete read-only workflow
     graph once per unique workflow name.
   - **Issue-Based Transition Discovery**: the legacy bounded status-stratified issue sampling
     protocol observes transitions exposed by Jira's issue-transition API.
   - **Target Status + Runtime Choice**: no transition catalog is required; the destination status
     is stored in the rule and resolved against the exact issue at execution time.
   - **Manual Transition Name**: no transition catalog is required; the configured exact name is
     resolved against the exact issue at execution time.
7. Metadata is built as a temporary snapshot and atomically committed only after validation of the
   discovery-scope revision. Workflow Designer per-context refresh failure retains the prior
   transition cache for that context and marks it stale. Runtime-only transition handling methods
   preserve cached transition data instead of wiping it.

## Monitoring engine

Each profile owns its own Monitoring state and polling cadence. Enabled rules are evaluated only
when their explicit schedule gate is active. Rules use saved filters, JQL and/or queryable typed
conditions to produce constrained Jira searches. There is no generic issue crawl.

Incremental cursors reduce repeated action-planning work during continuous monitoring. **Current
detections and radar use a separate full current-match snapshot on every normal cycle**, because
cursor-based incremental results cannot answer “what matches right now?” reliably. This means a
radar marker is removed by ordinary polling as soon as its issue stops matching.

## Connection monitoring

Each server may enable a connection-loss alarm. Connection health checks and outage tracking run
only while at least one profile for that server has Monitoring ON, and turning Monitoring on
triggers an immediate check. Health monitoring maintains the first failed-check timestamp and
consecutive failed health-check count. The alarm threshold may use duration, failed checks, or
either. When due, SD Companion plays the active profile's profile alarm settings sound once for that
outage. It does not interrupt an already-active alarm; subsequent health ticks can retry the
connection-loss alarm. A successful health check clears the outage state and rearms monitoring for a
future outage.

## Execution engine

Matched issues are planned into ordered jobs. The planner applies global safety limits, rule
priority/conflict policy, execution policy, per-action conditions, optional random action pools and
the idempotency ledger. Ordinary delays are relative to the detection cycle. An action configured as
**After previous action** receives a stable initial estimate and waits on its dependency without
mutating the user-visible `scheduledAt` during internal wakeups. Once the predecessor reaches a
terminal state, the exact due time is anchored once to `predecessor completedAt + dependency delay`.
Rules separately choose Continue or Stop for predecessor **cancelled**, **skipped/not-run**, and
**failed/error** outcomes. Skipped configured actions can be traversed to the nearest actually
scheduled predecessor. Continuing after a non-success dependency does not disable preflight.
Preflight is action-specific: transitions guard source status, assignments assignee, priority
actions priority, label edits labels, and generic field edits the fields they modify; explicit
action conditions are also re-evaluated. Comments/alarms/notifications have no unrelated status
lock.

Transition execution is protocol-specific and does not silently cross-fallback:

- catalog protocols require the configured transition ID in the current issue's Jira transition
  response;
- target-status mode filters the current issue's available transitions by destination and randomly
  selects only if several matches remain;
- manual-name mode requires one exact case-insensitive current name match and fails on ambiguity.

Jira-changing actions use a two-phase ledger reservation. If a service worker is interrupted after a
write may have started, the job becomes `uncertain` rather than being automatically replayed.
Per-issue locks prevent two jobs from concurrently modifying the same Jira issue.

## Timing

Long delays use `chrome.alarms`. Short action delays use a short timer with a Chrome Alarm fallback,
preserving second-level user configuration without losing recovery behavior if the worker is
suspended.

## Metadata auto-sync

A dedicated metadata-sync alarm tracks the next due configured server. Periodic synchronization uses
the same transactional discovery pipeline as manual synchronization and honors the current
per-project dataset scope and transition handling method.

## UI state consistency

Configuration writes use a monotonically increasing `configRevision`. UI writes may supply an
expected revision, and stale writes are rejected with `STATE_REVISION_CONFLICT` rather than
overwriting newer background state.

Long-running operations have operation IDs and cancellation. Progress messages are transient UI
state and do not repeatedly overwrite configuration forms. Boolean settings use switch controls;
set/multi-choice data such as project datasets, weekdays and filter pools retain selection-specific
controls.

## Action queue cancellation

Each Pending action can be processed immediately or cancelled independently from Home. Pending jobs
are unscheduled and finalized as `cancelled`. Running jobs use cooperative cancellation checkpoints
during read-only/pre-write work. Immediately before an irreversible Jira write, browser
notification, or local alarm dispatch, the queue atomically marks the running context as dispatched;
subsequent cancellation requests are refused because SD Companion cannot guarantee rollback after
the remote/local side effect has begun. Cancelled jobs retain a `cancelled` idempotency ledger entry
so the same execution-policy occurrence is not immediately recreated by the next poll. Bulk
cancellation is a separate explicitly scoped worker operation: it requires `siteId + profileId`,
optionally an `issueKey`, and cancels only Pending jobs. This powers confirmed **Cancel all
upcoming** controls for one issue or the active profile without ever broadening a missing scope to
all extension jobs.


### Manual Process semantics

The worker exposes explicitly scoped single/bulk Process operations for Pending jobs. A manual
Process bypasses only the job due time and current rule schedule window, then runs the normal
action-specific preflight/write path. Rules store `manualProcess.relativeSchedule`: `update` causes
a dependent After previous job to anchor to the manually processed predecessor's actual completion
time; `preserve` records dependency resolution without rewriting the dependent job's existing
`scheduledAt`.
