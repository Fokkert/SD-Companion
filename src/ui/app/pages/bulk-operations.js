(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { head, noServer } = A.View,
    { conditionEditor, actionEditor, actionOptions } = A.RuleViews;

  const unitOptions = unit => ['seconds', 'minutes', 'hours']
    .map(value => A.option(value, value[0].toUpperCase() + value.slice(1), unit === value))
    .join('');

  const delayEditor = rule => {
    const unit = rule.randomDelay?.unit || 'seconds';
    return `<div class="rule-section">` +
      `<div class="section-title">Default action delay</div>` +
      `<div class="time-pair section-gap">` +
      `<div class="field">` +
      `<label>Minimum delay</label>` +
      `<input class="input" type="number" min="0" step="1" data-rule-time="delay-min" value="${A.esc(SD.Utils.timeFromSeconds(rule.randomDelay?.minSeconds || 0, unit))}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Maximum delay</label>` +
      `<input class="input" type="number" min="0" step="1" data-rule-time="delay-max" value="${A.esc(SD.Utils.timeFromSeconds(rule.randomDelay?.maxSeconds || 0, unit))}">` +
      `</div>` +
      `<div class="field time-unit-field">` +
      `<label>Unit</label>` +
      `<select class="select" data-rule-time-unit="delay">${unitOptions(unit)}</select>` +
      `</div>` +
      `</div>` +
      `<div class="list-meta section-gap">The bulk operation starts immediately. These delays, and any per-action overrides or After previous delays, are still respected.</div>` +
      `</div>`;
  };

  const previewCard = preview => {
    if (!preview) return `<div class="card">` +
      `<div class="section-title">Preview</div>` +
      `<div class="empty compact-empty section-gap">Preview the operation to see which Jira issues currently match before running it.</div>` +
      `</div>`;

    const rows = (preview.issues || []).map(issue => `<div class="list-item">` +
      `<div>` +
      `<div class="list-title">${A.esc(issue.key)}</div>` +
      `<div class="list-meta">${A.esc(issue.status || '')}${issue.projectKey ? ` · ${A.esc(issue.projectKey)}` : ''}</div>` +
      `<div class="activity-detail">${A.esc(issue.summary || '')}</div>` +
      `</div>` +
      `</div>`).join('');

    return `<div class="card">` +
      `<div class="row-between">` +
      `<div>` +
      `<div class="section-title">Preview</div>` +
      `<div class="list-meta">${preview.count || 0} matching issue${preview.count === 1 ? '' : 's'}</div>` +
      `</div>` +
      `</div>` +
      `<div class="field section-gap">` +
      `<label>Effective JQL</label>` +
      `<textarea class="textarea mono" readonly>${A.esc(preview.jql || '')}</textarea>` +
      `</div>` +
      `<div class="list compact-list section-gap">${rows || '<div class="empty compact-empty">No matching issues.</div>'}</div>` +
      `</div>`;
  };

  A.pageBulkOperations = () => {
    const site = A.site(), profile = A.profile();
    if (!site || !profile) return noServer();

    const rule = A.ensureBulkDraft(),
      group = rule.logic?.groups?.[0] || SD.Defaults.group(),
      sourceMode = rule.source?.mode === 'jql' ? 'jql' : 'conditions',
      filters = site.filters || [],
      chain = { cancelled: 'continue', skipped: 'continue', failed: 'continue', ...(rule.chainDependency || {}) };

    return `<section class="page rules-page bulk-operations-page">` +
      `${head('Bulk Operations', 'Create a one-time Jira operation. It is not saved as a rule and runs only when you click Run now.', `<button class="btn btn-small" data-page="rules">Back to Rules</button>`)}` +
      `<div class="card notice warn">` +
      `<b>One-time execution</b>` +
      `<div class="help">The filter and action chain on this page are temporary. Running the operation queues actions immediately while respecting configured delays, approval requirements and global safety limits.</div>` +
      `</div>` +
      `<div class="card rule-inline-editor editor-card">` +
      `<div class="rule-section detection-source-section">` +
      `<div class="field detection-method-field"><label>Detection method</label><select class="select detection-method-select" data-rule-source-mode="true"><option value="conditions" ${sourceMode === 'conditions' ? 'selected' : ''}>Manual</option><option value="jql" ${sourceMode === 'jql' ? 'selected' : ''}>JQL</option></select></div>` +
      `${sourceMode === 'jql' ? `<div class="grid-2 section-gap rule-jql-grid"><div class="field rule-filter-field"><label>Saved Jira filters</label>${A.glassMulti(filters, x => String(x.id || ''), x => x.name || x.id || 'Filter', rule.source?.filterIds || [], 'data-multi-scope="rule" data-multi-prop="source.filterIds"', 'No saved filters synchronized.', 'Search filters')}</div><div class="field rule-jql-field"><label>Additional JQL</label><textarea class="textarea mono rule-additional-jql" maxlength="${SD.Constants.LIMITS.JQL_MAX_CHARS}" data-rule-prop="source.jql" placeholder="project = IT AND status = Open">${A.esc(rule.source?.jql || '')}</textarea></div></div>` : `<div class="row-between section-gap"><div><div class="section-title small-section-title">Condition groups</div></div><button class="btn btn-small" data-action="add-condition-group">+ Group</button></div><div class="condition-groups section-gap">${(rule.logic?.groups || []).map((g,i)=>`<div class="condition-group-card"><div class="row-between"><div class="row"><span class="sequence-number">${i+1}</span><strong>Group ${i+1}</strong><select class="select compact-select" data-group-op="${g.id}"><option value="AND" ${g.operator !== 'OR' ? 'selected' : ''}>Match all</option><option value="OR" ${g.operator === 'OR' ? 'selected' : ''}>Match any</option></select></div>${(rule.logic?.groups||[]).length>1?`<button class="btn btn-small btn-danger" data-action="delete-condition-group" data-id="${g.id}">Delete</button>`:''}</div>${conditionEditor(g,site)}</div>`).join('')}</div>`}` +
      `</div>` +
      `<div class="rule-section rule-editor-focus">` +
      `<div class="row-between">` +
      `<div>` +
      `<div class="section-title">Action chain</div>` +
      `<div class="list-meta">Actions use the same configuration and preflight checks as rule actions.</div>` +
      `</div>` +
      `<select id="addActionType" class="select compact-select">` +
      `<option value="">+ Add action</option>${actionOptions()}` +
      `</select>` +
      `</div>` +
      `<div class="chain-policy-card section-gap">` +
      `<div class="section-title small-section-title">Chained action dependency</div>` +
      `<div class="grid-3 chain-policy-grid section-gap">` +
      `<div class="field"><label>Previous cancelled</label><select class="select" data-rule-prop="chainDependency.cancelled"><option value="continue" ${chain.cancelled !== 'stop' ? 'selected' : ''}>Continue chain</option><option value="stop" ${chain.cancelled === 'stop' ? 'selected' : ''}>Cancel next action</option></select></div>` +
      `<div class="field"><label>Previous skipped</label><select class="select" data-rule-prop="chainDependency.skipped"><option value="continue" ${chain.skipped !== 'stop' ? 'selected' : ''}>Continue chain</option><option value="stop" ${chain.skipped === 'stop' ? 'selected' : ''}>Cancel next action</option></select></div>` +
      `<div class="field"><label>Previous failed</label><select class="select" data-rule-prop="chainDependency.failed"><option value="continue" ${chain.failed !== 'stop' ? 'selected' : ''}>Continue chain</option><option value="stop" ${chain.failed === 'stop' ? 'selected' : ''}>Cancel next action</option></select></div>` +
      `</div>` +
      `</div>` +
      `<div class="stack section-gap">${(rule.actions || []).map((action, index) => actionEditor(action, site, profile, index, rule)).join('') || '<div class="empty">No actions configured.</div>'}</div>` +
      `</div>` +
      `${delayEditor(rule)}` +
      `<div class="rule-section">` +
      `<div class="row">` +
      `<button class="btn" data-action="bulk-preview">Preview matches</button>` +
      `<button class="btn btn-primary" data-action="bulk-run">Run now</button>` +
      `<button class="btn btn-danger" data-action="bulk-reset">Reset</button>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `${previewCard(A.bulkPreview)}` +
      `</section>`;
  };
})();
