# Rules and Actions

## Rule schedule

Every rule explicitly chooses one of:
- **Always On**
- **Schedule(s)**

No schedule is created automatically. An enabled rule configured for schedules with no
selected schedule fails validation / fails closed.

## Detection method

Each rule chooses exactly one detection method:
- **Manual** — one or more condition groups built from synchronized Jira metadata; or
- **JQL** — one or more synchronized saved filters and/or Additional JQL.

Switching detection method clears the configuration that belongs to the previous method. If no safe
query constraint can be generated, the rule is skipped rather than issuing a broad Jira scan.

## Conditions

Manual rules contain one or more condition groups. Each group independently uses **Match all** or
**Match any**, and the rule independently chooses whether all groups or any group must match. Empty
condition groups are invalid and block **Save Rule**.

The condition registry determines valid operators, data source and cardinality from Jira field
schema. Text, number, date/datetime, boolean, user/choice and array fields receive type-appropriate
operators and editors. Single-value operators accept one value; set operators accept multiple
values; existence operators accept none. Rule editing is staged locally and is not applied until
**Save Rule** is pressed.


## Action variables

Comment templates, **Edit Fields** JSON, **Transition Fields JSON**, and Browser Notification title/message
can reference values from the current Jira issue with `{{...}}` variables. Comment and field/transition
JSON variables are expanded after the issue is re-fetched at execution time, so delayed Jira-write
actions use the latest available issue values. Browser Notification title/message variables are
expanded when the notification action is planned.

### Primary issue variables

| Variable | Value |
| --- | --- |
| `{{issue.id}}` | Jira issue ID |
| `{{issue.key}}` | Issue key, for example `IT-42` |
| `{{issue.filterId}}` | Synchronized saved-filter ID associated with the detection when available |
| `{{issue.summary}}` | Summary |
| `{{issue.description}}` | Description text when Jira exposes it as plain text |
| `{{issue.issueType}}` | Issue type name |
| `{{issue.issueTypeId}}` | Issue type ID |
| `{{issue.status}}` | Status name |
| `{{issue.statusId}}` | Status ID |
| `{{issue.projectKey}}` | Project key |
| `{{issue.projectId}}` | Project ID |
| `{{issue.projectName}}` | Project name |
| `{{issue.assignee}}` | Assignee display name |
| `{{issue.reporter}}` | Reporter display name |
| `{{issue.creator}}` | Creator display name |
| `{{issue.priority}}` | Priority name |
| `{{issue.priorityId}}` | Priority ID |
| `{{issue.resolution}}` | Resolution name |
| `{{issue.resolutionId}}` | Resolution ID |
| `{{issue.created}}` | Jira creation timestamp |
| `{{issue.updated}}` | Jira updated timestamp |
| `{{issue.dueDate}}` | Due date |
| `{{issue.labels}}` | Labels joined as comma-separated text in text templates |
| `{{issue.components}}` | Components; object/array values are rendered to readable text where possible |
| `{{issue.fields}}` | Complete fetched Jira fields object; mainly useful as an unquoted value in JSON templates |
| `{{issue.url}}` | Jira API self URL for the issue |
| `{{now}}` | Current ISO-8601 timestamp at variable-expansion time |

### User details

The normalized Assignee, Reporter, and Creator objects expose the following properties. Replace
`assignee` with `reporter` or `creator` as required.

| Variable | Value |
| --- | --- |
| `{{issue.assignee.displayName}}` | Display name |
| `{{issue.assignee.name}}` | Jira username/name when available |
| `{{issue.assignee.key}}` | Jira user key when available |
| `{{issue.assignee.accountId}}` | Account ID when available |
| `{{issue.assignee.emailAddress}}` | Email address when Jira exposes it |
| `{{issue.assignee.active}}` | Active-state value |
| `{{issue.assignee.avatarUrl}}` | Synchronized avatar URL |
| `{{issue.assignee.source}}` | Internal normalization source label |
| `{{issue.assignee.projectKeys}}` | Known project keys associated with the normalized user |

The short aliases `{{assignee.displayName}}`, `{{reporter.displayName}}`, and
`{{creator.displayName}}` are also accepted. `{{issue.assignee}}`, `{{issue.reporter}}`, and
`{{issue.creator}}` automatically prefer the object's display name.

### Project aliases

These aliases resolve from the current issue:

- `{{project.key}}` — project key;
- `{{project.name}}` — project name;
- `{{project.id}}` — project ID.

### Jira fields and custom fields

Any field present in the fetched Jira `fields` object can be referenced by path:

```text
{{issue.fields.<field-key>}}
```

Examples:

```text
{{issue.fields.customfield_12345}}
{{issue.fields.customfield_12345.value}}
{{issue.fields.assignee.displayName}}
{{issue.fields.fixVersions}}
```

Custom fields referenced with `{{issue.fields.customfield_12345}}` are automatically added to the
fields requested for rule evaluation/execution. Nested paths are supported when Jira returns an
object for that field. Arrays become comma-separated text in normal text templates.

### Shorthand paths

For issue properties, the `issue.` prefix is optional. For example, `{{key}}` and
`{{issue.key}}` resolve to the same value. The explicit `issue.` form is recommended in saved rules
because it is easier to read and avoids ambiguity.

### Variables inside JSON actions

**Edit Fields** and **Transition Fields JSON** use JSON-safe expansion. A variable inside a quoted JSON
string is escaped as text; an unquoted variable is serialized as its native JSON value when possible.
For example:

```json
{
  "description": "{{issue.key}} · {{issue.summary}}",
  "customfield_12345": "{{issue.fields.customfield_12345}}"
}
```

If a variable cannot be resolved, text templates receive an empty string. In JSON templates, an
unquoted unresolved variable becomes `null`.

## One-time Bulk Operations

Home → **Bulk Operations** reuses the rule condition/action model for an operation that runs only when
**Run now** is clicked. The user supplies a constrained saved-filter/JQL/condition source, can preview
the current Jira matches, and builds the normal ordered action chain. The transient definition is not
persisted in `profile.rules`. Bulk jobs carry a rule snapshot so delayed execution and Jira preflight
remain valid even though no saved rule exists. Normal global safety limits, action conditions, delays,
dependency policies and optional approval gates still apply.

## Execution policies

- Once per issue
- Once per status
- Once per issue update
- Repeat after a configured interval

The policy contributes to the idempotency fingerprint.

## Conflict policies

Rules are evaluated by priority. They may continue normally, stop lower-priority rules, or
participate in an exclusive group.

## Action sequencing

Actions are configured in displayed order. Each action can inherit the rule randomized min/max
delay, use an independent override, or use **After previous action**. A chained action keeps a
stable estimated due time while its predecessor is pending. When the predecessor reaches a terminal
state, the exact due time is anchored once to the predecessor completion time plus the chained
action's own min/max delay; internal queue/dependency retries do not rewrite that visible schedule.
Each rule independently chooses **Continue chain** or **Cancel next action** for three predecessor
outcomes: **Cancelled**, **Not run / skipped** (including an action whose condition did not match),
and **Failed / error**. Continuing after a non-success outcome does not bypass current-state safety;
the child still re-fetches Jira and applies its own action-specific preconditions and explicit
action conditions before dispatch. Manual **Process** can override the due time. **Relative update**
re-anchors later chained actions to manual completion; **Preserve schedule** leaves their existing
due times unchanged. Timing controls support selectable units without live numeric conversion.

Actions:
- Assignment: Myself / Specific user / Random pool / Unassign issue
- Comment: individual constant/random templates with variables
- Transition: the editor changes with the Jira server's transition handling method. Workflow
  Designer and Issue extraction keep the contextual synchronized-transition selector, narrowed by
  project, issue type, source status, raw JQL and selected-filter JQL. Target-status mode shows
  contextual destination statuses and resolves the exact issue at execution time; if several
  currently available transitions reach that destination, one is randomly selected. Manual-name mode
  accepts an exact name and fails if zero or multiple currently available transitions match.
  Optional fields JSON is preserved across protocols. Inactive protocol fields are retained when the
  server switches modes rather than being destroyed. The exact issue transitions are always
  re-fetched before execution.
- Edit fields
- Labels
- Priority
- Alarm
- Browser notification

Each action can optionally have its own typed conditions. This lets one rule detect a broad issue
set while individual actions apply only to the relevant project, issue type, status or other field
values. The Action Conditions selector chooses whether **Match all** or **Match any** of the configured
conditions is required, and that choice is persisted with the action. Optional random action pools can
select a configured number of matching actions from a pool.

Each individual action also has an optional **Needs approval** gate. When enabled, the planner creates
an `awaiting-approval` job instead of arming it for execution. Approval changes it to Pending without
changing its configured due time. If the due time has already passed it is armed immediately; if it is
still in the future, Action History exposes the normal **Process** and **Cancel** controls after
approval. Chained children remain blocked behind their predecessor until dependency resolution.

## Local alert rate limiting

Each rule can independently enable a **Local alert rate limit** for Alarm and Browser notification
actions. The rule stores a maximum alert count and rolling window in minutes. Existing queued/recent
local-alert jobs and newly planned local alerts are evaluated together so a planning cycle cannot
create an alert burst. Cancelled, skipped and failed alerts do not consume the limit. The setting is
disabled by default for migrated rules.

## Live safety

All enabled rule actions are live. Global safety limits cap work per cycle/hour. Before Jira writes,
the engine confirms the rule is still enabled and scheduled, re-fetches the issue, re-evaluates both
rule and action conditions and validates the action dependency.

## Approval and cancelling queued actions

Home → Detections & Actions exposes **Approve** on each Awaiting approval action and **Approve all**
for all approval-gated actions in the active server/profile. It exposes **Cancel** on each Awaiting
approval, Pending or Running action. A Pending action
is cancelled immediately. A Running action can be cancelled only while it is still in preflight;
once Jira/local dispatch has started, cancellation is rejected rather than reporting a false
rollback. Cancellation applies to the selected action only. Home also exposes confirmed **Cancel
all** controls for all Awaiting approval/Pending upcoming actions of one issue and for all upcoming
actions in the active profile. Bulk cancellation never claims to cancel Running work that may already be
approaching an irreversible dispatch. Chained children react to predecessor cancellation according
to the rule's configured dependency policy.


## Immediate processing and smart stale-state guards

Home → Detections & Actions provides **Process** for one Pending action plus confirmed **Process
all** at issue and active-profile scope. Immediate processing bypasses the queued timestamp/current
schedule window but keeps action-specific Jira checks. Transition watches status, Assignment watches
assignee, Priority watches priority, Labels watches labels, and Edit Fields watches only fields
being modified. Comment, Alarm and Notification do not cancel merely because status changed.
Explicit action-level conditions remain execution-time requirements.

## Detections & Actions visibility

Home → Detections & Actions groups action history by issue. **Show completed** hides whole issue groups only when all actions in that issue are terminal. If an issue still has Awaiting approval, Pending or Running work, completed actions for that same issue remain visible as execution context.
