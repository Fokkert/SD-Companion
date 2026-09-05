(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { EXECUTION_POLICY, CONFLICT_MODE } = SD.Constants,
    { head, noServer } = A.View,
    { conditionEditor, actionEditor, actionOptions } = A.RuleViews;
  const ruleIcons = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="7"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-7 11h6l-1 9 7-12h-6z"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7z"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h3l2-6 4 12 2-6h3"/><path d="M4 4h16v16H4z"/></svg>'
  ];
  const ruleIcon = rule => {
    const seed = `${rule?.id || ''}:${rule?.name || ''}`,
      index = Math.abs(Number(A.hash(seed)) || 0) % ruleIcons.length;
    return `<span class="rule-entry-icon">${ruleIcons[index]}</span>`;
  };
  const unitOptions = u => ['seconds', 'minutes', 'hours'].map(x => A.option(x, x[0].toUpperCase() + x.slice(1), u === x)).join('');
  const timePair = (labelA, labelB, minSeconds, maxSeconds, unit, attrsA, attrsB, unitAttr) => `<div class="time-pair">` +
    `<div class="field">` +
    `<label>${labelA}</label>` +
    `<input class="input" type="number" min="0" step="1" ${attrsA} value="${A.esc(SD.Utils.timeFromSeconds(minSeconds, unit))}">` +
    `</div>` +
    `<div class="field">` +
    `<label>${labelB}</label>` +
    `<input class="input" type="number" min="0" step="1" ${attrsB} value="${A.esc(SD.Utils.timeFromSeconds(maxSeconds, unit))}">` +
    `</div>` +
    `<div class="field time-unit-field">` +
    `<label>Unit</label>` +
    `<select class="select" ${unitAttr}>${unitOptions(unit)}</select></div></div>`;
  const tab = (id, label, current) => `<button type="button" class="rule-editor-tab ${current === id ? 'active' : ''}" data-action="rule-editor-section" data-section="${id}">${label}</button>`;
  const editor = (r, s, p) => {
    const preview = SD.RuleQuery.preview(r, null),
      c = r.runtime?.counters || {},
      repeatUnit = r.executionPolicy?.repeatUnit || 'minutes',
      cursorUnit = r.polling?.cursorOverlapUnit || 'minutes',
      delayUnit = r.randomDelay?.unit || 'seconds',
      section = A.ruleEditorSection || 'setup';
    let body = '';
    if (section === 'setup') body = `<div class="rule-section">` +
      `<div class="section-title">Rule</div>` +
      `<div class="grid-2 section-gap">` +
      `<div class="field">` +
      `<label>Name</label>` +
      `<input class="input" maxlength="100" data-rule-prop="name" value="${A.esc(r.name)}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Priority</label>` +
      `<input class="input" type="number" min="1" max="10000" data-rule-prop="priority" value="${r.priority}">` +
      `</div>` +
      `</div>` +

      `</div>
<div class="rule-section">` +
      `<div class="section-title">Schedule</div>` +
      `<div class="grid-2 section-gap">` +
      `<div class="field">` +
      `<label>Availability</label>` +
      `<select class="select" data-rule-prop="schedule.mode">` +
      `<option value="always" ${r.schedule?.mode !== 'scheduled' ? 'selected' : ''}>Always on</option>` +
      `<option value="scheduled" ${r.schedule?.mode === 'scheduled' ? 'selected' : ''}>Schedule(s)</option></select></div>${r.schedule?.mode === 'scheduled' ? `<div class="field rule-schedule-multi">` +
        `<div class="row-between">` +
        `<label>Schedules</label>` +
        `<span class="freshness-chip">${(r.schedule?.scheduleIds || []).length} selected</span></div>${A.glassMulti(p.schedules, x => x.id, x => x.name, r.schedule?.scheduleIds || [], `data-multi-scope="rule" data-multi-prop="schedule.scheduleIds" data-rule-schedule-multi="true"`, 'Create a schedule first.')}</div>` : '<div class="schedule-always"><span class="status-dot online"></span><strong>Always eligible</strong></div>'}</div>` +
      `</div>
<div class="rule-section">` +
      `<div class="section-title">Manual processing</div>` +
      `<div class="field section-gap">` +
      `<label>Relative actions after Process now</label>` +
      `<select class="select" data-rule-prop="manualProcess.relativeSchedule">` +
      `<option value="update" ${r.manualProcess?.relativeSchedule !== 'preserve' ? 'selected' : ''}>Relative update</option>` +
      `<option value="preserve" ${r.manualProcess?.relativeSchedule === 'preserve' ? 'selected' : ''}>Preserve schedule</option></select></div></div>
`;
    else if (section === 'conditions') {
      const sourceMode = r.source?.mode === 'jql' ? 'jql' : 'conditions';
      body = `<div class="rule-section detection-source-section"><div class="field detection-method-field"><label>Detection method</label><select class="select detection-method-select" data-rule-source-mode="true"><option value="conditions" ${sourceMode === 'conditions' ? 'selected' : ''}>Manual</option><option value="jql" ${sourceMode === 'jql' ? 'selected' : ''}>JQL</option></select></div>${sourceMode === 'jql' ? `<div class="grid-2 section-gap rule-jql-grid"><div class="field rule-filter-field"><label>Saved filters · optional</label>${A.glassMulti(s.filters, x => String(x.id), x => x.name, (r.source?.filterIds || []).map(String), `data-multi-scope="rule" data-multi-prop="source.filterIds"`, 'No filters synchronized.', 'Search fetched filters…')}</div><div class="field rule-jql-field"><label>Additional JQL · optional</label><textarea class="textarea mono rule-additional-jql" data-rule-prop="source.jql" placeholder="project = KEY AND status = Open">${A.esc(r.source?.jql || '')}</textarea></div></div>` : `<div class="rule-section-inner section-gap"><div class="row-between"><div class="row"><b>Condition groups</b><select class="select compact-select" data-rule-root-op="true"><option value="AND" ${r.logic?.operator !== 'OR' ? 'selected' : ''}>Match all groups</option><option value="OR" ${r.logic?.operator === 'OR' ? 'selected' : ''}>Match any group</option></select></div><button class="btn btn-small" data-action="add-condition-group">+ Group</button></div><div class="condition-groups section-gap">${(r.logic?.groups || []).map((g,i) => `<div class="condition-group-card"><div class="row-between"><div class="row"><span class="sequence-number">${i+1}</span><strong>Group ${i+1}</strong><select class="select compact-select" data-group-op="${g.id}"><option value="AND" ${g.operator !== 'OR' ? 'selected' : ''}>Match all</option><option value="OR" ${g.operator === 'OR' ? 'selected' : ''}>Match any</option></select></div>${(r.logic?.groups || []).length > 1 ? `<button class="btn btn-small btn-danger" data-action="delete-condition-group" data-id="${g.id}">Delete</button>` : ''}</div>${conditionEditor(g,s)}</div>`).join('')}</div></div>`}<div class="source-preview"><span>Effective JQL</span><code>${A.esc(preview.baseJql || 'No safe query constraint yet')}</code></div></div>`;
    }
    else if (section === 'actions') {
      const randomness = r.actionRandomness || { enabled: false, pools: [] },
        chain = { cancelled: 'continue', skipped: 'continue', failed: 'continue', ...(r.chainDependency || {}) },
        pools = randomness.pools || [],
        poolRows = pools.map(pool => `<div class="action-pool-row">` +
          `<input class="input" maxlength="60" data-action-pool="${pool.id}" data-pool-prop="name" value="${A.esc(pool.name || 'Pool')}">` +
          `<div class="field pool-count-field">` +
          `<label>Run</label>` +
          `<input class="input" type="number" min="1" max="50" data-action-pool="${pool.id}" data-pool-prop="pickCount" value="${Math.max(1, Number(pool.pickCount) || 1)}">` +
          `</div>` +
          `<button class="btn btn-small btn-danger" data-action="delete-action-pool" data-id="${pool.id}">Delete</button></div>`).join('');
      body = `<div class="rule-section rule-editor-focus">` +
        `<div class="row-between">` +
        `<div class="section-title">Actions</div>` +
        `<select id="addActionType" class="select compact-select">` +
        `<option value="">+ Add action</option>${actionOptions()}</select>` +
        `</div>` +
        `<div class="setting-line section-gap">` +
        `<span>Random action selection</span>` +
        `<label class="master-switch">` +
        `<input type="checkbox" data-rule-prop="actionRandomness.enabled" ${randomness.enabled ? 'checked' : ''}>` +
        `<span>` +
        `</span>` +
        `</label>` +
        `</div>` +
        `<div class="chain-policy-card section-gap">` +
        `<div class="row-between">` +
        `<div>` +
        `<div class="section-title small-section-title">Local alert rate limit</div>` +
        `</div>` +
        `<label class="master-switch">` +
        `<input type="checkbox" data-rule-prop="alertThrottle.enabled" ${r.alertThrottle?.enabled ? 'checked' : ''}>` +
        `<span></span>` +
        `</label>` +
        `</div>${r.alertThrottle?.enabled ? `<div class="grid-2 chain-policy-grid section-gap">` +
          `<div class="field"><label>Maximum alerts</label><input class="input" type="number" min="1" max="${SD.Constants.LIMITS.ALERT_THROTTLE_MAX_ALERTS}" step="1" data-rule-prop="alertThrottle.maxAlerts" value="${A.esc(r.alertThrottle?.maxAlerts || 1)}"></div>` +
          `<div class="field"><label>Window (minutes)</label><input class="input" type="number" min="1" max="${SD.Constants.LIMITS.ALERT_THROTTLE_WINDOW_MAX_MINUTES}" step="1" data-rule-prop="alertThrottle.windowMinutes" value="${A.esc(r.alertThrottle?.windowMinutes || 5)}"></div></div>` : ''}</div>` +
        `<div class="chain-policy-card section-gap">` +
        `<div class="row-between">` +
        `<div>` +
        `<div class="section-title small-section-title">Chained action dependency</div>` +
        `</div>` +
        `</div>` +
        `<div class="grid-3 chain-policy-grid section-gap">` +
        `<div class="field">` +
        `<label>Previous cancelled</label>` +
        `<select class="select" data-rule-prop="chainDependency.cancelled">` +
        `<option value="continue" ${chain.cancelled !== 'stop' ? 'selected' : ''}>Continue chain</option>` +
        `<option value="stop" ${chain.cancelled === 'stop' ? 'selected' : ''}>Cancel next action</option>` +
        `</select>` +
        `</div>` +
        `<div class="field">` +
        `<label>Previous not run / skipped</label>` +
        `<select class="select" data-rule-prop="chainDependency.skipped">` +
        `<option value="continue" ${chain.skipped !== 'stop' ? 'selected' : ''}>Continue chain</option>` +
        `<option value="stop" ${chain.skipped === 'stop' ? 'selected' : ''}>Cancel next action</option>` +
        `</select>` +
        `</div>` +
        `<div class="field">` +
        `<label>Previous failed / error</label>` +
        `<select class="select" data-rule-prop="chainDependency.failed">` +
        `<option value="continue" ${chain.failed !== 'stop' ? 'selected' : ''}>Continue chain</option>` +
        `<option value="stop" ${chain.failed === 'stop' ? 'selected' : ''}>Cancel next action</option></select></div></div></div>${randomness.enabled ? `<div class="action-pools">` +
          `<div class="row-between">` +
          `<label>Action pools</label>` +
          `<button class="btn btn-small" data-action="add-action-pool">+ Pool</button>` +
          `</div>${poolRows || '<div class="empty compact-empty">Create a pool, then assign actions to it.</div>'}</div>` : ''}<div class="stack section-gap">${(r.actions || []).map((a, i) => actionEditor(a, s, p, i, r)).join('') || '<div class="empty">No actions configured.</div>'}</div></div>`;
    }
    else body = `<div class="rule-section">` +
      `<div class="section-title">Execution</div>` +
      `<div class="grid-2 section-gap">` +
      `<div class="field">` +
      `<label>Execution policy</label>` +
      `<select class="select" data-rule-prop="executionPolicy.mode">` +
      `<option value="${EXECUTION_POLICY.ONCE_ISSUE}" ${r.executionPolicy?.mode === EXECUTION_POLICY.ONCE_ISSUE ? 'selected' : ''}>Once per issue</option>` +
      `<option value="${EXECUTION_POLICY.ONCE_STATUS}" ${r.executionPolicy?.mode === EXECUTION_POLICY.ONCE_STATUS ? 'selected' : ''}>Once per issue status</option>` +
      `<option value="${EXECUTION_POLICY.ONCE_UPDATE}" ${r.executionPolicy?.mode === EXECUTION_POLICY.ONCE_UPDATE ? 'selected' : ''}>Once per issue update</option>` +
      `<option value="${EXECUTION_POLICY.REPEAT}" ${r.executionPolicy?.mode === EXECUTION_POLICY.REPEAT ? 'selected' : ''}>Repeat after interval</option></select></div>${r.executionPolicy?.mode === EXECUTION_POLICY.REPEAT ? `<div class="time-value-row">` +
        `<div class="field">` +
        `<label>Repeat interval</label>` +
        `<input class="input" type="number" min="1" step="1" data-rule-time="execution-repeat" value="${A.esc(SD.Utils.timeFromSeconds(r.executionPolicy.repeatSeconds || 3600, repeatUnit))}">` +
        `</div>` +
        `<div class="field time-unit-field">` +
        `<label>Unit</label>` +
        `<select class="select" data-rule-time-unit="execution-repeat">${unitOptions(repeatUnit)}</select></div></div>` : '<div></div>'}<div class="field">` +
      `<label>Conflict policy</label>` +
      `<select class="select" data-rule-prop="conflict.mode">` +
      `<option value="${CONFLICT_MODE.CONTINUE}" ${r.conflict?.mode === CONFLICT_MODE.CONTINUE ? 'selected' : ''}>Continue</option>` +
      `<option value="${CONFLICT_MODE.STOP_LOWER}" ${r.conflict?.mode === CONFLICT_MODE.STOP_LOWER ? 'selected' : ''}>Stop lower-priority rules</option>` +
      `<option value="${CONFLICT_MODE.EXCLUSIVE}" ${r.conflict?.mode === CONFLICT_MODE.EXCLUSIVE ? 'selected' : ''}>Exclusive group</option></select></div>${r.conflict?.mode === CONFLICT_MODE.EXCLUSIVE ? `<div class="field"><label>Exclusive group</label><input class="input" maxlength="80" data-rule-prop="conflict.group" value="${A.esc(r.conflict?.group || '')}"></div>` : '<div></div>'}</div>` +
      `</div>` +
      `<div class="rule-section">` +
      `<div class="section-title">Timing</div>${timePair('Min delay', 'Max delay', r.randomDelay?.minSeconds || 0, r.randomDelay?.maxSeconds || 0, delayUnit, 'data-rule-time="delay-min"', 'data-rule-time="delay-max"', 'data-rule-time-unit="delay"')}<div class="time-value-row section-gap">` +
      `<div class="field">` +
      `<label>Cursor overlap</label>` +
      `<input class="input" type="number" min="1" step="1" data-rule-time="cursor-overlap" value="${A.esc(SD.Utils.timeFromSeconds(r.polling?.cursorOverlapSeconds || 600, cursorUnit))}">` +
      `</div>` +
      `<div class="field time-unit-field">` +
      `<label>Unit</label>` +
      `<select class="select" data-rule-time-unit="cursor-overlap">${unitOptions(cursorUnit)}</select>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="rule-section rule-metrics">` +
      `<div class="section-title">Counters</div>` +
      `<div class="grid-3 section-gap">` +
      `<div class="stat">` +
      `<strong>${c.matches || 0}</strong>` +
      `<span>Matches</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${c.planned || 0}</strong>` +
      `<span>Planned</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${c.skippedLedger || 0}</strong>` +
      `<span>Deduplicated</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${c.skippedSchedule || 0}</strong>` +
      `<span>Outside schedule</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${c.errors || 0}</strong>` +
      `<span>Errors</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${c.cycles || 0}</strong>` +
      `<span>Cycles</span>` +
      `</div>` +
      `</div>` +
      `</div>`;
    return `<div class="rule-inline-editor editor-card">` +
      `<div class="rule-editor-head">` +
      `<div class="section-title">${A.ruleDraftIsNew ? 'New rule' : 'Edit rule'}</div>` +
      `<div class="row">` +
      `<button class="btn btn-primary btn-small" data-action="save-rule">Save Rule</button>` +
      `<button class="btn btn-small" data-action="cancel-rule-edit">Cancel</button>${A.ruleDraftIsNew ? '' : `<button class="btn btn-danger btn-small" data-action="delete-rule">Delete</button>`}</div>` +
      `</div>` +
      `<div class="rule-editor-nav">${tab('setup', 'Setup', section)}${tab('conditions', 'Conditions', section)}${tab('actions', 'Actions', section)}${tab('advanced', 'Advanced', section)}</div>` +
      `<div class="rule-editor-body">${body}</div></div>`;
  };
  A.pageRules = () => {
    const s = A.site(), p = A.profile();
    if (!s || !p) return noServer();
    const rules = p.rules || [];
    if (A.selectedRuleId && !A.ruleDraft && !rules.some(r => r.id === A.selectedRuleId)) A.selectedRuleId = '';
    const rows = rules.map(x => {
      const editing = x.id === A.selectedRuleId;
      return `<div class="configured-object-stack">` +
        `<div class="list-item rule-card configured-object ${x.enabled ? 'enabled active-object' : ''} ${editing ? 'editing-object' : ''}" data-rule-card-id="${x.id}">` +
        `<div class="rule-card-main">` +
        `<div class="row rule-card-title-row">` +
        `${ruleIcon(x)}` +
        `<div class="list-title">${A.esc(x.name)}</div>` +
        `</div>` +
        `</div>` +
        `<div class="row rule-card-actions">` +
        `<button class="btn btn-small" data-action="${editing ? 'cancel-rule-edit' : 'edit-rule'}" data-id="${x.id}">${editing ? 'Close' : 'Edit'}</button>` +
        `<button class="btn btn-small" data-action="duplicate-rule" data-id="${x.id}">Duplicate</button>` +
        `<label class="master-switch" title="${x.enabled ? 'Disable rule' : 'Enable rule'}"><input type="checkbox" data-rule-enabled-id="${x.id}" ${x.enabled ? 'checked' : ''}><span></span></label>` +
        `</div></div>${editing && A.ruleDraft ? editor(A.ruleDraft, s, p) : ''}</div>`;
    }).join('');
    const newEditor = A.ruleDraftIsNew && A.ruleDraft ? `<div class="configured-object-stack new-rule-draft">${editor(A.ruleDraft, s, p)}</div>` : '';
    return `<section class="page rules-page">${head('Rules', '', `<div class="row"><button class="btn btn-primary btn-small" data-action="new-rule">+ Rule</button><button class="btn btn-small" data-page="bulk">Bulk Operations</button></div>`)}<div class="configured-section">` +
      `<div class="section-kicker">Configured rules</div>` +
      `<div class="card compact-configured-card">` +
      `<div class="list rule-list">${newEditor}${rows || (!newEditor ? '<div class="empty">No rules configured.</div>' : '')}</div></div></div></section>`;
  };
})();
