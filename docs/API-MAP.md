# Jira REST/API Map — V2 build 2.5.3

Normal Jira REST/API endpoints are called relative to the configured Jira base URL with the user's
PAT. The sole browser-session request exists only in the default **Full Workflow Map (Recommended)**
transition handling method: read-only `GET /browse/ISSUE`, used to obtain Jira's server-rendered
workflow name. The PAT is never attached to that browser-session lookup.

## Connection / capabilities

- `GET /rest/api/2/myself` — authoritative PAT/user validation and health check.
- `GET /rest/api/2/serverInfo` — optional server metadata/capability.
- `GET /rest/api/2/mypermissions` — permission matrix where available.

When the per-server connection-loss alarm is enabled, independent health checks run at least once
per minute while the connection is being watched. Outage duration and consecutive failed
health-check counters are local SD Companion state; recovery resets both.

## Stage 1 discovery

- projects: `/rest/api/2/project` with `/rest/api/2/project/search` fallback where available;
- personal/favorite filters: `/rest/api/2/filter/my?includeFavourites=true`;
- filter search/owner aggregation: `/rest/api/2/filter/search` where supported.

Filter discovery does not depend on whether a filter currently returns issues.

## Selected-project Stage 2 discovery

For only the configured project scope:

- project details;
- project issue-type/status matrix;
- assignable users;
- visible global field metadata via one `GET /rest/api/2/field` request when Fields are requested;
- priorities and resolutions;
- transition metadata according to the server's selected transition handling method.

### Transition handling methods

**Full Workflow Map (Recommended)**

- one bounded representative-issue search per `Project + Issue Type`;
- worker-session `GET /browse/ISSUE-KEY` with `credentials: include` to extract `workflowName`;
- PAT-authenticated `GET /rest/workflowDesigner/latest/workflows?name=...&draft=false`;
- one graph fetch per unique workflow name per synchronization, then contextual projection by
  project / issue type / source status.

**Issue-Based Transition Discovery**

- bounded status-stratified searches/counts for the configured project / issue-type / source-status
  contexts;
- `GET /rest/api/2/issue/{key}/transitions` for the selected sample issues;
- no unbounded project issue crawl.

**Target Status + Runtime Choice** and **Manual Transition Name** do not require a synchronized
transition catalog. Existing cached catalog data is retained rather than erased when one of these
runtime-only methods is selected.

Roles, versions and components are not synchronized.

## Issue querying

Issues are fetched only for constrained enabled rules, explicit one-time Bulk Operations, and bounded
transition metadata work required by the selected protocol. Bulk Operations use the same bounded Jira
search path and require a saved filter, JQL, or queryable typed condition; they do not open a generic
issue crawl. There is no generic issue inventory crawl and no
`Number.MAX_SAFE_INTEGER`/unbounded transition scan.

During continuous monitoring, cursor-based constrained searches are used for action planning. A
separate full **current-match** query is also performed for enabled rules so the Home Current
detections list and radar reflect what matches now rather than what merely appeared in the
incremental cursor window.

## Transition execution

Immediately before a transition write, SD Companion fetches `GET
/rest/api/2/issue/{key}/transitions` for the exact issue.

- Workflow Designer / Issue extraction: the configured contextual transition ID must be present; no
  target-status fallback is used.
- Target-status mode: available transitions are filtered by destination status; zero fails, one is
  used, multiple matching transitions are randomly selected as explicitly configured by that
  protocol.
- Manual-name mode: available transitions are matched by trimmed, case-insensitive exact name; zero
  fails and multiple matches fail as ambiguous.

The selected transition is then executed through Jira's issue transition write resource with the
configured transition fields JSON.

## Transport

All Jira API requests originate from the extension service worker. There is no Jira-tab API
transport or certificate-bypass path. The Workflow Designer name lookup uses browser-session cookies
via `credentials: include`; Jira API/workflow-graph calls use the PAT. SD Companion deliberately
does not set Fetch `targetAddressSpace` for Jira requests; Chrome/Edge classify the resolved
destination and enforce Local Network Access/CORS policy. TLS/SSL validation remains controlled by
Windows/Chrome. If Fetch fails before an HTTP response, SD Companion fails closed with
`NETWORK_REQUEST_FAILED`; because browsers generally expose these failures to JavaScript only as a
generic Fetch rejection, the diagnostic lists LNA/CORS, TLS, DNS, proxy/VPN and reachability as
possible causes instead of asserting a certificate failure.
