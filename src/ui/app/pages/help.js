(() => {
  const A = globalThis.SDApp, SD = globalThis.SDCompanion, { head } = A.View;
  const topic = (id, title, html) => `<details class="help-topic" id="help-${id}"><summary><span>${title}</span></summary><div class="help-body">${html}</div></details>`;
  A.pageHelp = () => {
    const index = [
      ['start', 'Start'],
      ['servers', 'Servers'],
      ['discovery', 'Discovery'],
      ['monitor', 'Monitoring'],
      ['rules', 'Rules'],
      ['bulk', 'Bulk Operations'],
      ['conditions', 'Conditions'],
      ['actions', 'Actions'],
      ['schedules', 'Schedules'],
      ['safety', 'Safety'],
      ['api', 'API pacing'],
      ['alarms', 'Alarms'],
      ['profiles', 'Profiles'],
      ['security', 'Security'],
      ['health', 'Health'],
      ['diagnostics', 'Diagnostics'],
      ['storage', 'Data cleanup'],
      ['trouble', 'Troubleshooting']
    ];
    return `<section class="page help-page">${head('Help & Reference')}<div class="card help-intro">` +
      `<div class="help-version-row"><div class="section-title">SD Companion V2</div><span class="freshness-chip">Version ${A.esc(SD.Constants.BUILD_VERSION)}</span></div>` +
      `<div class="help-index">${index.map(([id, n]) => `<button class="help-chip" data-action="help-jump" data-id="${id}">${n}</button>`).join('')}</div></div>
${topic('start', '1. Initial setup', '<ol>' +
        '<li>Add a Jira server with its base URL, a friendly name and a Personal Access Token.</li>' +
        '<li>Run project/filter discovery.</li>' +
        '<li>For each discovered project, enable only the datasets that SD Companion should synchronize, then run the configured-data sync.</li>' +
        '<li>Create any schedules you need. A rule may alternatively use Always On.</li>' +
        '<li>Create rules, configure their conditions, execution policy, timing and ordered actions, then enable only the rules you want active.</li>' +
        '<li>Turn Monitoring on when the automation configuration is ready.</li>' +
        '</ol>')}
${topic('servers', '2. Jira servers', '<p>Each Server represents one Jira instance. Credentials, discovery scope, metadata, request pacing, health, capabilities and profiles are isolated per server.</p>' +
          '<ul>' +
          '<li>PATs are stored separately from normal profile configuration.</li>' +
          '<li>Server icons may use the Jira favicon or a bundled fallback icon.</li>' +
          '<li>The optional Jira-tab refresh setting reloads matching open Jira tabs when a new issue enters the detection set. The separate Focus Jira Tab On Detection option activates a matching Jira tab, preferring an already-open tab for the detected issue and otherwise using an existing tab for that Jira server.</li>' +
          '<li>The connection-loss alarm uses the active profile\'s default Alarm Profile from Settings → General and can trigger by outage duration, consecutive failed health checks, or either threshold.</li>' +
          '<li>Deleting a server removes its credential, profiles, synchronized cache and associated runtime data.</li>' +
          '</ul>')}
${topic('discovery', '3. API discovery', '<p>Discovery uses Jira REST API data and transactional snapshots. An incomplete or cancelled deep sync does not replace the last successful inventory.</p>' +
            '<ul>' +
            '<li>Stage 1 discovers accessible projects and available saved filters.</li>' +
            '<li>Some Jira Server/Data Center releases expose only favourite filters through the public REST API. If the server does not expose an owned-filter listing endpoint, non-favourite filters visible in Jira\'s Manage Filters page cannot be enumerated by the API-only extension. SD Companion reports the detected filter coverage instead of inferring filters from issue results.</li>' +
            '<li>Stage 2 synchronizes only the per-project datasets you enabled: Users, Fields, Issue Types, Statuses and Transitions.</li>' +
            '<li>API Data categories are: Projects (project directory), Filters (saved filters), Users (assignable users), Issue Types (project issue types), Statuses (workflow statuses), Transitions (workflow-context transitions), Fields (visible Jira fields), Priorities (shared priorities), and Resolutions (shared resolutions).</li><li>Every API Data entry is expandable. Individual synchronized items can be removed from the active snapshot. Removed items stay excluded on future synchronization unless Restore removed data on refresh is enabled for that server.</li>' +
            '<li>Priorities and Resolutions are optional server-wide datasets.</li>' +
            '<li>Roles, versions, components and a generic issue inventory are not synchronized.</li>' +
            '<li>Issue queries are performed only when rules or targeted transition discovery need them.</li>' +
            '<li>Project avatars, user avatars and issue-type icons are retained when Jira exposes them.</li>' +
            '<li>Periodic metadata synchronization can be configured under Settings → Automation.</li>' +
            '<li>' +
            '<b>Transition Handling Method</b> is configured per Jira server. <b>Full Workflow Map (Recommended)</b> uses Jira\'s read-only Workflow Designer graph and a signed-in browser Jira session only to resolve the workflow name; graph/API operations still use the PAT. <b>Issue-Based Transition Discovery</b> uses the older status-stratified issue sampling method. <b>Target Status + Runtime Choice</b> stores a destination status and, at execution time, uses the only available transition to that status or randomly chooses among multiple available transitions. <b>Manual Transition Name</b> resolves the exact transition name against the issue\'s currently available transitions and fails if zero or multiple exact-name matches exist.</li>' +
            '<li>Changing transition handling methods does not intentionally erase rule fields belonging to the other modes, so a server can switch compatibility modes without rebuilding every rule.</li>' +
            '</ul>')}
${topic('monitor', '4. Monitoring and Scan Now', '<p>Monitoring is the continuous rule-evaluation switch for the selected profile. While it is on, enabled rules are evaluated at the configured polling cadence and according to each rule\'s schedule. Scan Now performs one immediate cycle without changing Monitoring.</p>' +
              '<p>Home presents detected issues that produced actions in one <b>Detections &amp; Actions</b> workspace. Current/Recent selection, Check now, global queue controls and Show completed all operate on that combined issue/action history.</p>')}
${topic('rules', '5. Rule model', '<p>A rule defines what should match and what should happen.</p>' +
                '<ul>' +
                '<li>Priority determines evaluation order.</li>' +
                '<li>Schedule is explicit: Always On or one or more selected schedules. When several schedules are mapped to a rule, the rule is eligible while any selected schedule is active.</li>' +
                '<li>Choose exactly one detection method: JQL or Manual. JQL can use saved filters and/or Additional JQL; Manual uses condition groups. The two methods are not evaluated concurrently. Changing the detection method clears the previous method\'s configuration so only the selected method remains configured.</li>' +
                '<li>Execution Policy controls whether actions occur once per issue, once per status, once per update, or repeat after an interval.</li>' +
                '<li>Conflict Policy controls interaction with lower-priority rules.</li>' +
                '<li>Rule-level timing controls the default randomized action delay; an individual action may override it or wait a configured delay after the previous planned action succeeds.</li>' +
                '<li>Actions may have their own typed conditions, allowing different actions in one rule to apply to different issue types/statuses/projects or other fields.</li>' +
                '<li>Optional random action pools can choose a configured number of matching actions from a pool.</li>' +
                '<li>Local alert rate limiting caps Alarm/Notification actions from a rule within a configurable rolling time window.</li>' +
                '<li>The Effective JQL preview shows the query derived from the configured source and conditions.</li>' +
                '<li>Rule edits are staged locally. Use Save Rule to apply them; Cancel discards the draft.</li>' +
                '</ul>')}
${topic('bulk', '6. Bulk Operations', '<p>Rules → <b>Bulk Operations</b> is a one-time rule-style execution surface next to the + Rule control. It is not saved into the profile rules.</p>' +
                  '<ul>' +
                  '<li>Choose either JQL targeting (saved filters and/or Additional JQL) or Manual; the two detection methods are not evaluated concurrently. Switching methods clears the previous method\'s configuration.</li>' +
                  '<li>Build the normal ordered action chain, including delays, After previous dependencies and optional Needs approval gates.</li>' +
                  '<li>Preview matches before execution, then Run now to queue the operation immediately.</li>' +
                  '<li>Global safety limits and execution-time Jira preflight still apply.</li>' +
                  '</ul>')}
${topic('conditions', '7. Typed conditions', '<p>Conditions are type-aware. Jira field schema synchronized from the canonical field directory determines text, number, date/datetime, boolean, user/choice and array behavior. Changing the field updates the available operators and values and discards incompatible old values.</p>' +
                  '<ul>' +
                  '<li>Single-value operators such as Equals accept one value.</li>' +
                  '<li>Set operators such as Is Any Of accept multiple values.</li>' +
                  '<li>Existence operators require no value.</li>' +
                  '<li>Conditions are organized into groups. Each group can Match all or Match any of its rows, and the rule can separately Match all groups or Match any group.</li>' +
                  '<li>In Manual mode, SD Companion derives constrained JQL from supported conditions. A rule without a safe query constraint is skipped rather than issuing a broad Jira scan.</li>' +
                  '</ul>')}
${topic('actions', '8. Actions and sequencing', '<p>Actions execute in their displayed order.</p>' +
                    '<ul>' +
                    '<li>Assignment supports Myself, one Specific user, a Random user pool, or Unassign issue.</li>' +
                    '<li>Comments use separate template entries. Constant mode uses one configured template; random mode selects from the configured template set.</li>' +
                    '<li>Transitions use synchronized workflow data when the selected server method provides a catalog. The editor narrows transitions and target statuses by Project, Issue Type, Status, raw JQL, and synchronized JQL from selected filters, then revalidates against the exact target issue before execution.</li>' +
                    '<li>In Target Status + Runtime Choice mode, Jira is queried at execution time. If one available transition reaches the selected status it is used; if several do, one is selected randomly. Different transitions can have different screens, validators, conditions, or post-functions, so this mode is intentionally nondeterministic.</li>' +
                    '<li>In Manual Transition Name mode, matching is case-insensitive against transitions currently available on the issue. Zero matches fail and multiple exact-name matches fail as ambiguous.</li>' +
                    '<li>Edit Fields, Labels and Priority modify Jira fields using the configured values.</li>' +
                    '<li>Alarm and Notification are local attention actions.</li>' +
                    '<li>Any individual action can enable Needs approval. It then remains Awaiting approval until the user approves it from Home → Detections &amp; Actions.</li>' +
                    '<li>Each action may inherit the rule delay range, use its own independent min/max delay, or use After previous action. Chained action dependency decides separately whether cancelled, skipped/not-run, or failed predecessors continue or stop the next After previous action. Manual Process can either update later relative schedules from the actual manual completion time or preserve their existing schedule.</li>' +
                    '<li>Action-level conditions are revalidated against the exact issue immediately before execution. Stale-state checks are action-specific: transitions watch status, assignments assignee, priority actions priority, labels labels, and Edit Fields only the fields it modifies. Comments, alarms and notifications are not cancelled just because status changed.</li>' +
                    '</ul>')}
${topic('schedules', '9. Schedules, polling and time units', '<p>Schedules support days of week, start/end time, timezone, optional effective dates and overnight windows. Schedule edits are staged until Save Schedule is pressed; Cancel discards the draft. No schedule is created automatically; create only the schedules you need. Rules can always choose Always On.</p>' +
                      '<p>Polling, repeat intervals, cursor overlap, action delays, alarm duration and other human-facing time settings provide selectable time units where appropriate. Switching a unit keeps the visible numeric value and reinterprets it in the new unit; it does not live-convert the number.</p>' +
                      '<p>Home detection/action history refresh is configured under Settings → Automation. The default is 3 seconds; refresh is deferred while the user is actively reading or expanding the activity workspace. Settings → Automation is split into Sync & Refresh and Safety Limits; Alarm Profiles are managed from Settings → General so these controls are easier to navigate.</p>')}
${topic('safety', '10. Global execution safety', '<ul>' +
                        '<li>Safety limits are global and are configured under Settings → Automation.</li>' +
                        '<li>Limits cap issues and actions per cycle and comments, assignments and transitions per hour.</li>' +
                        '<li>The idempotency ledger prevents the same logical action from being replayed under the selected execution policy.</li>' +
                        '<li>A per-issue execution lock prevents concurrent workers from modifying the same issue at the same time.</li>' +
                        '<li>Awaiting approval, pending and running actions are visible from Home → Detections &amp; Actions so queued work can be reviewed operationally. Approve/Approve all release approval-gated work. Awaiting approval and Pending actions can be processed immediately, individually or with confirmed Process all at issue/profile scope. Each individual queued action can also be cancelled from Detections &amp; Actions. Pending actions cancel immediately; a running action is cancelled only while it is still in preflight. Once its Jira write has been dispatched, SD Companion refuses cancellation rather than pretending the remote change can be undone.</li>' +
                        '</ul>')}
${topic('api', '11. API pacing and rate limits', '<p>Each Jira server has an independent adaptive request policy.</p>' +
                          '<ul>' +
                          '<li>Minimum request spacing and jitter.</li>' +
                          '<li>Maximum requests per minute and maximum concurrent requests.</li>' +
                          '<li>Timeout, retry count and backoff ceiling.</li>' +
                          '<li>Retry-After handling for rate-limited or temporarily unavailable responses.</li>' +
                          '<li>Configurable health heartbeat.</li>' +
                          '<li>Request statistics show request, failure, retry, rate-limit and latency information.</li>' +
                          '</ul>')}
${topic('alarms', '12. Alarms', '<p>Alarm Profiles are owned by the active SD Companion profile and are managed under Settings → General. Each Alarm action selects which Alarm Profile to play, so different rules/actions can use different sounds, volumes, stop methods and custom audio.</p>' +
                            '<ul>' +
                            '<li>Built-in generated sounds and custom audio.</li>' +
                            '<li>Volume, duration, looping and stop behavior.</li>' +
                            '<li>Alarm stop methods are Keyboard Shortcut, Duration, Click anywhere and Popup. Browser Notification remains a separate rule action.</li>' +
                            '<li>Connection-loss alarms use the active profile\'s default Alarm Profile.</li>' +
                            '<li>The toolbar alarm control remains an emergency stop for the shared active alarm and queued/scheduled rule Alarm actions. A configured Keyboard Shortcut stops playback only when that Alarm Profile uses the Keyboard Shortcut stop method.</li>' +
                            '<li>Each rule can rate-limit its Alarm and Notification actions to avoid local alert floods.</li>' +
                            '</ul>')}
${topic('profiles', '13. Profiles and portability', '<p>A profile contains rules, schedules, monitoring configuration and Alarm Profiles for one Jira server.</p>' +
                              '<ul>' +
                              '<li>Normal export preserves the selected profile—including Alarm Profiles—plus related server configuration, synchronized-data exclusions/refresh policy, inventory/runtime snapshot, appearance and system settings, but intentionally excludes the PAT.</li>' +
                              '<li>Password-encrypted secure backup can include the PAT.</li>' +
                              '<li>Import is previewed before it is applied. Profiles can be imported even when no Jira server is configured; the saved server shell is restored from the backup and credentials can be configured later.</li>' +
                              '<li>Profiles can be duplicated. The duplicate receives new internal object IDs and clean runtime counters, while Monitoring starts off to prevent accidental duplicate execution.</li><li>Deleting a profile cascades through its rules, schedules, cursors, jobs, ledger and runtime state.</li>' +
                              '</ul>')}

${topic('security', '14. Security and protected actions', '<p>Settings → Security configures the optional device-local extension lock. The detailed sensitive-action list is documented here instead of crowding the Settings page.</p>' +
                                '<ul>' +
                                '<li>Processing queued Jira actions immediately, including Approve/Approve all and Process/Process all, requires sensitive-action confirmation when the extension lock is enabled.</li>' +
                                '<li>Bulk queue cancellation and other high-impact queue operations are protected.</li>' +
                                '<li>Changing a Jira server URL or PAT is protected.</li>' +
                                '<li>Applying encrypted configuration imports and creating credential-bearing encrypted backups are protected.</li>' +
                                '<li>Delete, clear-cache, clear-runtime and factory-reset operations are protected.</li>' +
                                '<li>The PIN/password itself is not stored; SD Companion keeps a salted verifier and issues short-lived authorization for protected operations.</li>' +
                                '</ul>')}
${topic('health', '15. Compatibility and permissions', '<p>Health shows connection status, authenticated identity, server capabilities, permissions and request statistics. SD Companion learns capabilities from the Jira endpoints that are actually available instead of assuming all Jira deployments expose identical APIs.</p>' +
                                '<p>PAT authentication does not require browser-session token renewal. Authentication failures are tracked separately from pre-HTTP network failures. SD Companion does not force a Local Network Access target address space; Chrome/Edge determine the resolved destination and enforce LNA/CORS/TLS/network policy.</p>')}
${topic('diagnostics', '16. Logs and Audit Journal', '<p>Logs are technical diagnostics and obey the configured log level. The Audit Journal records operational events such as synchronization, detection, job scheduling, execution, deduplication, cancellation and failure. Both can be exported as JSON and cleared independently.</p>' +
                                  '<p>Normal Settings edits are staged until Save is pressed. Reset restores the saved Settings state. The optional Action Completion Tone is a short low-volume completion cue that can be enabled or disabled under Settings → Automation.</p>')}
${topic('storage', '17. Data maintenance', '<ul>' +
                                    '<li>Clear Current Server Cache removes synchronized metadata while preserving server configuration and discovery choices.</li>' +
                                    '<li>Clear Current Profile Runtime Data clears counters, cursors, jobs and ledger state while preserving rules and schedules.</li>' +
                                    '<li>Factory Reset erases all SD Companion configuration, credentials, metadata, logs, audit and runtime data.</li>' +
                                    '<li>Deleting a profile or server removes data belonging to that object.</li>' +
                                    '</ul>')}
${topic('trouble', '18. Troubleshooting', '<ul>' +
                                      '<li>If metadata is missing, run Stage 1 first, enable the desired per-project datasets, then run the configured-data sync.</li>' +
                                      '<li>If a filter is missing, inspect filter coverage and Logs; Jira editions differ in which owned-filter enumeration endpoints they expose.</li>' +
                                      '<li>If Jira fails before returning HTTP, inspect the Health error and check Jira reachability, Chrome/Edge Local Network Access or CORS policy, certificate trust, DNS, proxy/PAC and VPN routing. SD Companion does not bypass those browser/network checks.</li>' +
                                      '<li>If a rule does not run, verify Enabled, Monitoring, schedule, Effective JQL, permissions, execution policy and global safety limits.</li>' +
                                      '<li>If a transition is missing, refresh the relevant project datasets and confirm an appropriate issue context exists for transition discovery.</li>' +
                                      '<li>Cancel long discovery/sync operations from the loading surface; incomplete snapshots are discarded.</li>' +
                                      '<li>To run queued work early, expand Home → Detections &amp; Actions and use Process beside a Pending action, or Process all for the issue/profile. To cancel, use Cancel beside the Pending/Running action. Cancelling one action does not automatically cancel later independent actions already queued for the same issue.</li>' +
                                      '</ul>')}
</section>`;
  };
})();
