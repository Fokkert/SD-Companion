(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { head, projectLogo } = A.View,
    { LIMITS: L, TRANSITION_METHOD } = SD.Constants;
  const iconFor = x => x.icon?.mode === "auto" && x.icon.url ? `<img src="${A.esc(x.icon.url)}" data-favicon data-fallback="../../../icons/server-${A.esc(x.icon?.preset || "emerald")}.svg">` : `<img src="../../../icons/server-${A.esc(x.icon?.preset || "emerald")}.svg">`;
  const addForm = () => `<div class="card editor-card">` +
    `<div class="row-between">` +
    `<div class="section-title">Add Jira server</div>` +
    `<button class="btn btn-small" data-action="cancel-add-server">Close</button>` +
    `</div>` +
    `<div class="stack editor-fields">` +
    `<div class="grid-2">` +
    `<div class="field">` +
    `<label>Friendly name</label>` +
    `<input id="newServerName" class="input" maxlength="80" placeholder="Service Desk Production">` +
    `</div>` +
    `<div class="field">` +
    `<label>Jira base URL</label>` +
    `<input id="newServerUrl" class="input mono" placeholder="https://jira.example.local">` +
    `</div>` +
    `</div>` +
    `<div class="field">` +
    `<label>Personal Access Token</label>` +
    `<input id="newServerPat" class="input mono" type="password" autocomplete="off" placeholder="PAT">` +
    `</div>` +
    `<div class="grid-2">` +
    `<div class="field">` +
    `<label>PAT storage</label>` +
    `<select id="newServerPersistence" class="select">` +
    `<option value="local">Remember in browser</option>` +
    `<option value="session">This browser session</option>` +
    `</select>` +
    `</div>` +
    `<div class="field">` +
    `<label>Icon</label>` +
    `<select id="newServerIcon" class="select">` +
    `<option value="auto">Jira favicon</option>` +
    `<option value="emerald">Emerald</option>` +
    `<option value="teal">Teal</option>` +
    `<option value="violet">Violet</option>` +
    `<option value="amber">Amber</option>` +
    `<option value="rose">Rose</option>` +
    `<option value="ice">Ice</option>` +
    `</select>` +
    `</div>` +
    `</div>` +
    `<div class="row">` +
    `<button class="btn btn-primary" data-action="add-server">Connect</button>` +
    `<button class="btn" data-action="cancel-add-server">Cancel</button>` +
    `</div>` +
    `</div>` +
    `</div>`;
  const datasetDefs = [['users', 'Users'], ['fields', 'Fields'], ['issueTypes', 'Types'], ['statuses', 'Statuses'], ['transitions', 'Transitions']];
  const unitOptions = u => ['seconds', 'minutes', 'hours'].map(x => A.option(x, x[0].toUpperCase() + x.slice(1), u === x)).join('');
  const transitionMethods = [
    [TRANSITION_METHOD.WORKFLOW_DESIGNER, 'Full Workflow Map (Recommended)'],
    [TRANSITION_METHOD.ISSUE_EXTRACTION, 'Issue-Based Transition Discovery'],
    [TRANSITION_METHOD.TARGET_STATUS_RANDOM, 'Target Status + Runtime Choice'],
    [TRANSITION_METHOD.MANUAL_NAME, 'Manual Transition Name']
  ];
  const cfg = (s, key) => ({ ...SD.Defaults.projectDatasets(false), ...(s.inventorySettings?.projectDatasets?.[key] || {}) });
  const projectMatrix = s => `<div class="discovery-matrix">` +
    `<div class="discovery-matrix-head">` +
    `<span>Project</span>${datasetDefs.map(([, l]) => `<span>${l}</span>`).join('')}</div>${(s.projects || []).map(p => {
      const c = cfg(s, p.key);
      return `<div class="discovery-project-row" data-project-row="${A.esc(p.key)}">` +
        `<div class="discovery-project-name" title="${A.esc(p.key)} · ${A.esc(p.name)}">${projectLogo(p)}<span>` +
        `<b>${A.esc(p.key)}</b>` +
        `<small>${A.esc(p.name)}</small></span></div>${datasetDefs.map(([k, l]) => `<label class="circle-check dataset-check" title="${A.esc(l)}"><input type="checkbox" data-project-key="${A.esc(p.key)}" data-project-dataset="${k}" ${c[k] ? 'checked' : ''}><span></span></label>`).join('')}</div>`;
    }).join('') || `<div class="glass-choice-empty">No projects discovered.</div>`}</div>`;
  const scopeCount = s => SD.Utils.discoveryProjectKeys(s.inventorySettings).length;
  const editor = s => {
    const hasPat = Boolean(A.credentialStatus?.[s.id]),
      rp = s.network?.requestPolicy || SD.Defaults.requestPolicy(),
      selected = scopeCount(s),
      global = s.inventorySettings?.globalDatasets || { priorities: true, resolutions: true },
      coverage = s.inventory?.filterCoverage || 'unknown',
      hu = rp.healthIntervalUnit || 'minutes',
      bu = rp.backoffUnit || 'seconds',
      hv = SD.Utils.timeFromSeconds(rp.healthIntervalSeconds || 300, hu),
      bv = SD.Utils.timeFromSeconds(rp.backoffMaxSeconds || 60, bu),
      tm = s.inventorySettings?.transitionMethod || TRANSITION_METHOD.WORKFLOW_DESIGNER,
      cl = { enabled: true, trigger: 'either', durationSeconds: 300, durationUnit: 'minutes', failedChecks: 5, ...(s.behavior?.connectionLossAlarm || {}) },
      clu = cl.durationUnit || 'minutes',
      clv = SD.Utils.timeFromSeconds(cl.durationSeconds || 300, clu),
      connectionLabel = !hasPat ? 'PAT missing' : s.runtime?.apiHealthy ? 'API online' : 'Check required';
    return `<div class="card editor-card server-editor">` +
      `<div class="server-editor-head">` +
      `<div class="server-editor-identity">` +
      `<span class="server-editor-icon">${iconFor(s)}</span>` +
      `<div>` +
      `<div class="section-title">${A.esc(s.name)}</div>` +
      `<div class="list-meta mono">${A.esc(s.baseUrl)}</div>` +
      `</div>` +
      `</div>` +
      `<div class="row server-editor-head-actions">` +
      `<span class="freshness-chip ${!hasPat || !s.runtime?.apiHealthy ? 'warn' : ''}">${connectionLabel}</span>` +
      `<button class="btn btn-small" data-action="close-server-editor">Done</button>` +
      `</div>` +
      `</div>` +
      `<div class="server-settings-stack">` +
      `<details class="glass-disclosure server-settings-section server-connection-section" open>` +
      `<summary>` +
      `<span>Connection & behavior</span>` +
      `<span class="disclosure-meta">${connectionLabel}</span>` +
      `</summary>` +
      `<div class="disclosure-body">${hasPat ? '' : `<div class="notice warn credential-missing-notice">` +
        `<b>PAT missing</b>` +
        `<span>This server cannot make authenticated Jira API requests until a PAT is saved below. Monitoring, health checks, sync and connection-loss alarms are paused.</span>` +
        `</div>`}${s.runtime?.lastErrorCode === 'NETWORK_REQUEST_FAILED' ? `<div class="notice bad">` +
          `<b>Jira API unreachable</b>` +
          `<br>The browser did not receive an HTTP response from Jira. Check Jira reachability, Local Network Access/CORS policy, TLS trust, DNS, proxy or VPN routing. SD Companion does not bypass browser security checks or use a Jira tab for REST.</div>` : ''}` +
      `<div class="server-settings-group">` +
      `<div class="server-settings-group-title">Identity</div>` +
      `<div class="grid-2 server-identity-grid">` +
      `<div class="field">` +
      `<label>Friendly name</label>` +
      `<input id="serverNameEdit" class="input" maxlength="80" value="${A.esc(s.name)}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Icon</label>` +
      `<select id="serverIconEdit" class="select">` +
      `<option value="auto" ${s.icon?.mode === 'auto' ? 'selected' : ''}>Jira favicon</option>${['emerald', 'teal', 'violet', 'amber', 'rose', 'ice'].map(x => `<option value="${x}" ${s.icon?.mode !== 'auto' && s.icon?.preset === x ? 'selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select>` +
      `</div>` +
      `<div class="field server-url-field">` +
      `<label>Jira base URL</label>` +
      `<input id="serverUrlEdit" class="input mono" autocomplete="off" spellcheck="false" value="${A.esc(s.baseUrl)}">` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="server-settings-group">` +
      `<div class="server-settings-group-title">Detection behavior</div>` +
      `<div class="connection-behavior-grid">` +
      `<div class="toggle-card server-behavior-toggle" title="Refresh Jira tab on new detection">` +
      `<label class="master-switch">` +
      `<input id="autoRefreshOnDetection" type="checkbox" ${s.behavior?.autoRefreshJiraTabsOnDetection ? 'checked' : ''}>` +
      `<span></span>` +
      `</label>` +
      `<span><strong>Refresh Jira tab on new detection</strong></span>` +
      `</div>` +
      `<div class="toggle-card server-behavior-toggle" title="Focus Jira tab on new detection">` +
      `<label class="master-switch">` +
      `<input id="focusJiraTabOnDetection" type="checkbox" ${s.behavior?.focusJiraTabOnDetection ? 'checked' : ''}>` +
      `<span></span>` +
      `</label>` +
      `<span><strong>Focus Jira tab on detection</strong></span>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="server-settings-group connection-loss-settings">` +
      `<div class="row-between connection-loss-settings-head">` +
      `<div>` +
      `<div class="server-settings-group-title">Connection-loss alarm</div>` +
      `${s.runtime?.connectionLossStartedAt ? `<span class="freshness-chip warn">Outage since ${A.esc(SD.Utils.formatDateTime(s.runtime.connectionLossStartedAt))}</span>` : ''}` +
      `</div>` +
      `<label class="master-switch" title="Connection-loss alarm">` +
      `<input id="connectionLossAlarmEnabled" type="checkbox" ${cl.enabled ? 'checked' : ''}>` +
      `<span></span>` +
      `</label>` +
      `</div>` +
      `<div class="grid-2 connection-loss-grid">` +
      `<div class="field">` +
      `<label>Alarm threshold</label>` +
      `<select id="connectionLossTrigger" class="select">` +
      `<option value="either" ${cl.trigger === 'either' ? 'selected' : ''}>Duration OR failed checks</option>` +
      `<option value="duration" ${cl.trigger === 'duration' ? 'selected' : ''}>Duration only</option>` +
      `<option value="failures" ${cl.trigger === 'failures' ? 'selected' : ''}>Failed checks only</option>` +
      `</select>` +
      `</div>` +
      `<div class="field">` +
      `<label>Failed health checks</label>` +
      `<input id="connectionLossFailures" class="input" type="number" min="${L.CONNECTION_LOSS_FAILURES_MIN}" max="${L.CONNECTION_LOSS_FAILURES_MAX}" value="${A.esc(cl.failedChecks || 5)}">` +
      `</div>` +
      `<div class="time-value-row connection-loss-duration-row">` +
      `<div class="field">` +
      `<label>Connection-loss duration</label>` +
      `<input id="connectionLossDuration" class="input" type="number" min="1" step="1" value="${A.esc(clv)}">` +
      `</div>` +
      `<div class="field time-unit-field">` +
      `<label>Unit</label>` +
      `<select id="connectionLossDurationUnit" class="select">${unitOptions(clu)}</select>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="row server-settings-actions">` +
      `<button class="btn btn-primary" data-action="save-server-settings">Save Server</button>` +
      `<button class="btn" data-action="refresh-health" ${hasPat ? '' : 'disabled'}>Test API</button>` +
      `<button class="btn" data-action="open-jira">Open Jira</button>` +
      `</div>` +
      `</div>` +
      `</details>` +
      `<details class="glass-disclosure server-settings-section server-discovery-section">` +
      `<summary>` +
      `<span>Discovery & synchronized data</span>` +
      `<span class="disclosure-meta">${selected}/${s.projects.length} projects</span>` +
      `</summary>` +
      `<div class="disclosure-body">` +
      `<div class="row server-discovery-actions">` +
      `<button class="btn" data-action="discover-projects" ${hasPat ? '' : 'disabled'}>Refresh Projects & Filters</button>` +
      `<button class="btn btn-small" data-action="enable-all-project-data">All data</button>` +
      `<button class="btn btn-small" data-action="clear-project-data">Clear</button>` +
      `</div>${projectMatrix(s)}<div class="field transition-method-field">` +
      `<label>Transition Handling Method</label>` +
      `<select id="transitionMethodEdit" class="select">${transitionMethods.map(([v, l]) => A.option(v, l, tm === v)).join('')}</select>` +
      `</div>` +
      `<div class="global-dataset-row">` +
      `<span>Shared Jira data</span>` +
      `<label class="circle-check text-check">` +
      `<input type="checkbox" data-global-dataset="priorities" ${global.priorities !== false ? 'checked' : ''}>` +
      `<span></span>Priorities</label>` +
      `<label class="circle-check text-check">` +
      `<input type="checkbox" data-global-dataset="resolutions" ${global.resolutions !== false ? 'checked' : ''}>` +
      `<span></span>Resolutions</label>` +
      `</div>` +
      `<div class="row server-discovery-footer">` +
      `<button id="syncSelectedDataBtn" class="btn btn-primary" data-action="sync-data" ${selected && hasPat ? '' : 'disabled'}>Sync Configured Data</button>` +
      `<span id="discoverySelectedCount" class="freshness-chip">${selected}/${s.projects.length} projects configured</span>` +
      `<span class="freshness-chip ${coverage === 'favourites-only' ? 'warn' : ''}">Filters: ${coverage === 'owned-and-favourites' ? 'owned + favourites' : coverage === 'favourites-only' ? 'favourites only' : coverage}</span>` +
      `</div>` +
      `</div>` +
      `</details>` +
      `<details class="glass-disclosure server-settings-section server-api-section">` +
      `<summary>` +
      `<span>API pacing & health</span>` +
      `<span class="disclosure-meta">${rp.maxRequestsPerMinute}/min</span>` +
      `</summary>` +
      `<div class="disclosure-body">` +
      `<div class="grid-2 server-api-grid">` +
      `<div class="field">` +
      `<label>Min request spacing (ms)</label>` +
      `<input id="requestSpacing" class="input" type="number" min="${L.REQUEST_SPACING_MIN_MS}" max="${L.REQUEST_SPACING_MAX_MS}" step="50" value="${rp.spacingMs}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Request jitter (%)</label>` +
      `<input id="requestJitter" class="input" type="number" min="0" max="${L.REQUEST_JITTER_MAX}" value="${rp.jitterPercent}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Max requests / minute</label>` +
      `<input id="requestMaxPerMinute" class="input" type="number" min="${L.REQUESTS_PER_MINUTE_MIN}" max="${L.REQUESTS_PER_MINUTE_MAX}" value="${rp.maxRequestsPerMinute}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Max concurrent requests</label>` +
      `<input id="requestConcurrency" class="input" type="number" min="${L.CONCURRENCY_MIN}" max="${L.CONCURRENCY_MAX}" value="${rp.maxConcurrent}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Timeout (ms)</label>` +
      `<input id="requestTimeout" class="input" type="number" min="${L.REQUEST_TIMEOUT_MIN_MS}" max="${L.REQUEST_TIMEOUT_MAX_MS}" step="1000" value="${rp.timeoutMs}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Retries</label>` +
      `<input id="requestRetries" class="input" type="number" min="0" max="${L.REQUEST_RETRIES_MAX}" value="${rp.retries}">` +
      `</div>` +
      `<div class="time-value-row">` +
      `<div class="field">` +
      `<label>Health heartbeat</label>` +
      `<input id="healthInterval" class="input" type="number" min="1" step="1" value="${hv}">` +
      `</div>` +
      `<div class="field time-unit-field">` +
      `<label>Unit</label>` +
      `<select id="healthIntervalUnit" class="select">${unitOptions(hu)}</select>` +
      `</div>` +
      `</div>` +
      `<div class="time-value-row">` +
      `<div class="field">` +
      `<label>Backoff ceiling</label>` +
      `<input id="backoffMax" class="input" type="number" min="1" step="1" value="${bv}">` +
      `</div>` +
      `<div class="field time-unit-field">` +
      `<label>Unit</label>` +
      `<select id="backoffUnit" class="select">${unitOptions(bu)}</select>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="row server-settings-actions">` +
      `<button class="btn btn-primary" data-action="save-server-settings">Save API Pacing</button>` +
      `</div>` +
      `</div>` +
      `</details>` +
      `<details class="glass-disclosure server-settings-section server-credentials-section">` +
      `<summary>` +
      `<span>Credentials & deletion</span>` +
      `<span class="disclosure-meta">${hasPat ? 'PAT stored' : 'PAT missing'}</span>` +
      `</summary>` +
      `<div class="disclosure-body">${hasPat ? '' : `<div class="notice warn credential-missing-notice compact"><b>Authentication required</b><span>Paste a PAT here to enable API operations for this imported server.</span></div>`}<div class="field">` +
      `<label>${hasPat ? 'Replacement PAT' : 'Personal Access Token'}</label>` +
      `<input id="serverPatEdit" class="input mono" type="password" autocomplete="off">` +
      `</div>` +
      `<div class="row server-settings-actions">` +
      `<button class="btn" data-action="change-pat">Replace & Test PAT</button>` +
      `<button class="btn btn-danger" data-action="delete-server">Delete Server</button>` +
      `</div>` +
      `</div>` +
      `</details>` +
      `</div>` +
      `</div>`;
  };
  A.pageServers = () => {
    const sites = A.state.jiraSites || [];
    const rows = sites.map(s => {
      const editing = A.serverEditId === s.id, hasPat = Boolean(A.credentialStatus?.[s.id]);
      return `<div class="configured-object-stack">` +
        `<div class="list-item server-card configured-object ${s.id === A.site()?.id ? 'active-object' : ''} ${editing ? 'editing-object' : ''}">` +
        `<span class="server-icon">${iconFor(s)}</span>` +
        `<div>` +
        `<div class="list-title">${A.esc(s.name)}</div>` +
        `<div class="list-meta">${A.esc(s.baseUrl)} · ${scopeCount(s)} projects configured</div>` +
        `</div>` +
        `<div class="row">` +
        `<span class="object-state ${hasPat && s.runtime?.apiHealthy ? 'online' : hasPat ? 'offline' : 'missing'}" title="${hasPat ? (s.runtime?.apiHealthy ? 'API online' : 'API offline') : 'PAT missing'}">` +
        `</span>` +
        `<button class="btn btn-small" data-action="select-server" data-id="${s.id}">${s.id === A.site()?.id ? 'Selected' : 'Use'}</button>` +
        `<button class="btn btn-small" data-action="${editing ? 'close-server-editor' : 'edit-server'}" data-id="${s.id}">${editing ? 'Done' : 'Edit'}</button></div></div>${editing ? editor(s) : ''}</div>`;
    }).join('');
    return `<section class="page">${head('Jira Servers', '', `<button class="btn btn-primary btn-small" data-action="toggle-add-server">+ Server</button>`)}${A.serverAddOpen ? addForm() : ''}<div class="configured-section">` +
      `<div class="section-kicker">Configured servers</div>` +
      `<div class="list server-list">${rows || `<div class="empty">No configured servers.</div>`}</div></div></section>`;
  };
})();
