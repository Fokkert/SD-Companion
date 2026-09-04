(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { ACTION, LIMITS: L, TRANSITION_METHOD } = SD.Constants;
  const actionLabels = Object.freeze({
    [ACTION.ALARM]: 'Alarm',
    [ACTION.ASSIGN]: 'Assign',
    [ACTION.COMMENT]: 'Comment',
    [ACTION.EDIT_FIELDS]: 'Edit fields',
    [ACTION.LABELS]: 'Labels',
    [ACTION.NOTIFICATION]: 'Notification',
    [ACTION.PRIORITY]: 'Priority',
    [ACTION.TRANSITION]: 'Transition'
  });
  const actionLabel = type => actionLabels[type] || String(type || 'Action');
  const actionOptions = () => Object.values(ACTION)
    .map(value => ({ value, label: actionLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(item => A.option(item.value, item.label))
    .join('');
  const unitOptions = u => ['seconds', 'minutes', 'hours'].map(x => A.option(x, x[0].toUpperCase() + x.slice(1), u === x)).join('');
  const delayEditor = (a, index) => {
    const u = a.delay?.unit || 'seconds',
      mode = a.delay?.mode || 'inherit',
      custom = mode === 'override' || mode === 'after-previous';
    return `<div class="action-delay">` +
      `<div class="field">` +
      `<label>Timing</label>` +
      `<select class="select" data-action-id="${a.id}" data-aprop="delay.mode">` +
      `<option value="inherit" ${mode === 'inherit' ? 'selected' : ''}>Use rule delay</option>` +
      `<option value="override" ${mode === 'override' ? 'selected' : ''}>Override</option>` +
      `<option value="after-previous" ${mode === 'after-previous' ? 'selected' : ''} ${index === 0 ? 'disabled' : ''}>After previous action</option></select></div>${custom ? `<div class="field">` +
        `<label>${mode === 'after-previous' ? 'After previous · min' : 'Minimum'}</label>` +
        `<input class="input" type="number" min="0" step="1" data-action-id="${a.id}" data-action-time="delay-min" value="${A.esc(SD.Utils.timeFromSeconds(a.delay?.minSeconds || 0, u))}">` +
        `</div>` +
        `<div class="field">` +
        `<label>${mode === 'after-previous' ? 'After previous · max' : 'Maximum'}</label>` +
        `<input class="input" type="number" min="0" step="1" data-action-id="${a.id}" data-action-time="delay-max" value="${A.esc(SD.Utils.timeFromSeconds(a.delay?.maxSeconds || 0, u))}">` +
        `</div>` +
        `<div class="field time-unit-field">` +
        `<label>Unit</label>` +
        `<select class="select" data-action-id="${a.id}" data-action-time-unit="delay">${unitOptions(u)}</select></div>` : ''}</div>`;
  };
  const transitionMethod = s => Object.values(TRANSITION_METHOD).includes(s?.inventorySettings?.transitionMethod) ? s.inventorySettings.transitionMethod : TRANSITION_METHOD.WORKFLOW_DESIGNER;
  const transitionRows = s => {
    const rows = [], seen = new Set();
    for (const ctx of s.transitionCatalog || []) for (const t of ctx.transitions || []) {
      const x = {
        id: String(t.id || ''),
        name: t.name || 'Transition',
        toStatusId: String(t.toStatusId || ''),
        toStatusName: t.toStatusName || '',
        projectId: String(ctx.projectId || ''),
        projectKey: ctx.projectKey || '',
        projectName: ctx.projectName || '',
        issueTypeId: String(ctx.issueTypeId || ''),
        issueTypeName: ctx.issueTypeName || '',
        fromStatusId: String(ctx.statusId || ''),
        fromStatusName: ctx.statusName || '',
        requiredFields: t.requiredFields || []
      },
        key = `${x.projectKey}|${x.issueTypeId}|${x.fromStatusId}|${x.id}|${x.toStatusId}|${x.name}`;
      if (x.id && !seen.has(key)) {
        seen.add(key);
        rows.push(x);
      }
    }
    return rows;
  };
  const statusRows = s => {
    const rows = [];
    for (const x of s.projectStatusMatrix || []) rows.push({
      toStatusId: String(x.statusId || x.id || ''),
      toStatusName: x.statusName || x.name || '',
      projectId: String(x.projectId || ''),
      projectKey: x.projectKey || '',
      projectName: x.projectName || '',
      issueTypeId: String(x.issueTypeId || ''),
      issueTypeName: x.issueTypeName || ''
    });
    for (const x of s.statuses || []) rows.push({
      toStatusId: String(x.statusId || x.id || ''),
      toStatusName: x.statusName || x.name || '',
      projectId: String(x.projectId || ''),
      projectKey: x.projectKey || '',
      projectName: x.projectName || '',
      issueTypeId: String(x.issueTypeId || ''),
      issueTypeName: x.issueTypeName || ''
    });
    for (const x of transitionRows(s)) rows.push({
      toStatusId: x.toStatusId,
      toStatusName: x.toStatusName,
      projectId: x.projectId,
      projectKey: x.projectKey,
      projectName: x.projectName,
      issueTypeId: x.issueTypeId,
      issueTypeName: x.issueTypeName
    });
    const seen = new Set();
    return rows.filter(x => {
      const k = `${x.projectKey}|${x.issueTypeId}|${x.toStatusId}`;
      if (!x.toStatusId || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const cleanToken = v => String(v ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
  const splitValues = text => String(text || '').replace(/^\(|\)$/g, '').split(',').map(cleanToken).filter(Boolean);
  const parseJqlScope = jql => {
    const out = { project: new Set(), issueType: new Set(), status: new Set(), has: false },
      src = String(jql || '').replace(/\s+ORDER\s+BY\s+[\s\S]*$/i, ''),
      specs = [
        ['project', /\bproject\s*(?:=|in)\s*(\([^)]*\)|"[^"]*"|'[^']*'|[A-Za-z0-9_.-]+)/ig],
        ['issueType', /\b(?:issuetype|issueType|type)\s*(?:=|in)\s*(\([^)]*\)|"[^"]*"|'[^']*'|[A-Za-z0-9_.-]+)/ig],
        ['status', /\bstatus\s*(?:=|in)\s*(\([^)]*\)|"[^"]*"|'[^']*'|[A-Za-z0-9_.-]+)/ig]
      ];
    for (const [key, re] of specs) {
      let m;
      while ((m = re.exec(src))) {
        for (const v of splitValues(m[1])) out[key].add(v.toLowerCase());
        if (out[key].size) out.has = true;
      }
    }
    return out;
  };
  const intersect = (base, vals) => {
    const next = new Set(vals.map(x => String(x).toLowerCase()));
    if (!base) return next;
    return new Set([...base].filter(x => next.has(x)));
  };
  const logicScope = logic => {
    const out = { project: null, issueType: null, status: null, has: false },
      g = logic?.groups?.[0],
      conds = (g?.conditions || []).filter(c => !c.negate && ['project', 'issueType', 'status'].includes(c.field) && ['equals', 'is-any-of'].includes(c.operator));
    if (!conds.length) return out;
    if (g?.operator === 'OR') {
      const fields = new Set(conds.map(c => c.field));
      if (fields.size !== 1 || (g.conditions || []).length !== conds.length) return out;
      const field = conds[0].field, vals = conds.flatMap(c => SD.ConditionRegistry.conditionValues(c));
      out[field] = new Set(vals.map(x => String(x).toLowerCase()));
      out.has = out[field].size > 0;
      return out;
    }
    for (const c of conds) {
      const vals = SD.ConditionRegistry.conditionValues(c);
      if (!vals.length) continue;
      out[c.field] = intersect(out[c.field], vals);
      out.has = true;
    }
    return out;
  };
  const candidates = (ctx, key) => key === 'project' ? [ctx.projectId, ctx.projectKey, ctx.projectName] : key === 'issueType' ? [ctx.issueTypeId, ctx.issueTypeName] : [ctx.fromStatusId, ctx.fromStatusName];
  const scopeMatches = (ctx, scope, keys = ['project', 'issueType', 'status']) => {
    for (const key of keys) {
      const set = scope?.[key];
      if (set && set.size && !candidates(ctx, key).some(v => set.has(String(v || '').toLowerCase()))) return false;
    }
    return true;
  };
  const filterScopesFor = (s, rule) => {
    const selected = (rule?.source?.filterIds || []).map(String),
      filters = selected.map(id => s.filters?.find(f => String(f.id) === id)).filter(Boolean),
      scopes = filters.map(f => parseJqlScope(f.jql || '')),
      canRestrict = filters.length > 0 && scopes.length === filters.length && scopes.every(x => x.has);
    return { filters, scopes, canRestrict };
  };
  const relevantTransitionRows = (s, rule, action = null) => {
    const all = transitionRows(s);
    if (!rule) return all;
    const cond = logicScope(rule.logic),
      act = action?.when?.enabled ? logicScope(action.when.logic) : null,
      raw = parseJqlScope(rule.source?.jql || ''),
      fs = filterScopesFor(s, rule);
    return all.filter(ctx => scopeMatches(ctx, cond) && (!act || scopeMatches(ctx, act)) && scopeMatches(ctx, raw) && (!fs.canRestrict || fs.scopes.some(sc => scopeMatches(ctx, sc))));
  };
  const transitionChoices = (s, rule, action = null) => relevantTransitionRows(s, rule, action).map(t => ({ ...t, contextKey: `${t.projectKey}|${t.issueTypeId}|${t.fromStatusId}|${t.id}|${t.toStatusId}|${t.name}` }));
  const targetStatusChoices = (s, rule, action = null) => {
    const cond = logicScope(rule?.logic),
      act = action?.when?.enabled ? logicScope(action.when.logic) : null,
      raw = parseJqlScope(rule?.source?.jql || ''),
      fs = filterScopesFor(s, rule),
      keys = ['project', 'issueType'],
      rows = statusRows(s).filter(ctx => scopeMatches(ctx, cond, keys) && (!act || scopeMatches(ctx, act, keys)) && scopeMatches(ctx, raw, keys) && (!fs.canRestrict || fs.scopes.some(sc => scopeMatches(ctx, sc, keys)))),
      map = new Map();
    for (const x of rows) {
      if (!map.has(x.toStatusId)) map.set(x.toStatusId, { id: x.toStatusId, name: x.toStatusName || x.toStatusId });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  };
  const commentTemplates = a => `<div class="comment-template-list">${(a.templates || []).map((t, i) => `<div class="comment-template-row">` +
    `<div class="field">` +
    `<label>Comment ${i + 1}</label>` +
    `<textarea class="textarea" maxlength="${L.COMMENT_TEMPLATE_MAX_CHARS}" data-action-id="${a.id}" data-comment-template-index="${i}" placeholder="Working on {{issue.key}}">${A.esc(t)}</textarea>` +
    `</div>` +
    `<button class="icon-btn template-remove" type="button" data-action="delete-comment-template" data-id="${a.id}" data-index="${i}" title="Remove comment" aria-label="Remove comment">×</button></div>`).join('') || '<div class="empty compact-empty">No comments configured.</div>'}<button class="btn btn-small" type="button" data-action="add-comment-template" data-id="${a.id}" ${(a.templates || []).length >= L.COMMENT_TEMPLATE_COUNT_MAX ? 'disabled' : ''}>+ Comment</button></div>`;
  const transitionEditor = (a, s, rule) => {
    const method = transitionMethod(s),
      fs = filterScopesFor(s, rule),
      missingFilterJql = fs.filters.filter(f => !String(f.jql || '').trim()).length;
    let selector = '';
    if (method === TRANSITION_METHOD.WORKFLOW_DESIGNER || method === TRANSITION_METHOD.ISSUE_EXTRACTION) {
      const allCount = transitionRows(s).length,
        choices = transitionChoices(s, rule, a),
        source = method === TRANSITION_METHOD.WORKFLOW_DESIGNER ? 'Full Workflow Map' : 'Issue-Based Discovery';
      selector = `<div class="transition-context-summary">` +
        `<strong>${choices.length}</strong>` +
        `<span>relevant transitions</span>` +
        `<small>${allCount} synchronized · ${source}</small>` +
        `</div>` +
        `<div class="field">` +
        `<label>Transition</label>` +
        `<select class="select" data-searchable="true" data-action-id="${a.id}" data-aprop="transitionId">` +
        `<option value="">${choices.length ? 'Select relevant transition' : 'No relevant synchronized transitions'}</option>${choices.map(t => {
          const c = a.transitionContext || null,
            selected = String(a.transitionId) === String(t.id) && (!c || (String(c.projectKey || '') === String(t.projectKey || '') && String(c.issueTypeId || '') === String(t.issueTypeId || '') && String(c.fromStatusId || '') === String(t.fromStatusId || '') && String(c.toStatusId || '') === String(t.toStatusId || '')));
          return `<option value="${A.esc(String(t.id))}" data-project-key="${A.esc(t.projectKey || '')}" data-issue-type-id="${A.esc(t.issueTypeId || '')}" data-from-status-id="${A.esc(t.fromStatusId || '')}" data-to-status-id="${A.esc(t.toStatusId || '')}" data-transition-name="${A.esc(t.name || '')}" ${selected ? 'selected' : ''}>${A.esc(`${t.name} · ${t.projectKey || 'Project'} · ${t.issueTypeName || t.issueTypeId || 'Issue type'} · ${t.fromStatusName || t.fromStatusId || 'Status'}${t.toStatusName || t.toStatusId ? ` → ${t.toStatusName || t.toStatusId}` : ''}`)}</option>`;
        }).join('')}</select></div>${!choices.length ? '<div class="inline-note warn">No synchronized transition matches this rule/action context.</div>' : ''}`;
    }
    else if (method === TRANSITION_METHOD.TARGET_STATUS_RANDOM) {
      const states = targetStatusChoices(s, rule, a);
      selector = `<div class="transition-context-summary">` +
        `<strong>${states.length}</strong>` +
        `<span>contextual target statuses</span>` +
        `</div>` +
        `<div class="field">` +
        `<label>Target status</label>` +
        `<select class="select" data-searchable="true" data-action-id="${a.id}" data-aprop="toStatusId">` +
        `<option value="">${states.length ? 'Select target status' : 'No contextual statuses synchronized'}</option>${states.map(x => A.option(String(x.id), x.name, String(a.toStatusId) === String(x.id))).join('')}</select></div>`;
    }
    else selector = `<div class="transition-context-summary">` +
      `<strong>Manual</strong>` +
      `<span>transition-name resolver</span>` +
      `</div>` +
      `<div class="field">` +
      `<label>Exact transition name</label>` +
      `<input class="input" data-action-id="${a.id}" data-aprop="manualTransitionName" maxlength="200" placeholder="Resolve" value="${A.esc(a.manualTransitionName || '')}"></div>`;
    return `${selector}${missingFilterJql && (method !== TRANSITION_METHOD.MANUAL_NAME) ? `<div class="inline-note warn">${missingFilterJql} selected filter(s) do not expose JQL, so those filters cannot narrow this selector.</div>` : ''}<div class="field">` +
      `<label>Transition fields JSON</label>` +
      `<textarea class="textarea mono" data-action-id="${a.id}" data-aprop="fieldsJson">${A.esc(a.fieldsJson || '{}')}</textarea></div>`;
  };
  const actionEditor = (a, s, p, index, rule = null) => {
    let body = '';
    if (a.type === ACTION.ASSIGN) {
      body = `<div class="field">` +
        `<label>Mode</label>` +
        `<select class="select" data-action-id="${a.id}" data-aprop="mode">` +
        `<option value="me" ${a.mode === 'me' ? 'selected' : ''}>Myself</option>` +
        `<option value="specific" ${a.mode === 'specific' ? 'selected' : ''}>Specific user</option>` +
        `<option value="random" ${a.mode === 'random' ? 'selected' : ''}>Random user</option>` +
        `<option value="unassign" ${a.mode === 'unassign' ? 'selected' : ''}>Unassign issue</option></select></div>${a.mode === 'specific' ? `<div class="field">` +
          `<label>User</label>` +
          `<select class="select" data-searchable="true" data-action-id="${a.id}" data-aprop="specificUserKey">` +
          `<option value="">Select user</option>${A.multiOptions(s.users, x => SD.Utils.userKey(x), x => x.displayName, [a.specificUserKey || ''])}</select></div>` : ''}${a.mode === 'random' ? `<div class="field">` +
            `<label>User pool</label>${A.glassMulti(s.users, x => SD.Utils.userKey(x), x => x.displayName, a.randomUserKeys || [], `data-multi-scope="action" data-multi-id="${a.id}" data-multi-prop="randomUserKeys"`, 'No users synchronized.', 'Search users…')}</div>` : ''}`;
    }
    else if (a.type === ACTION.COMMENT) body = `<div class="field">` +
      `<label>Selection</label>` +
      `<select class="select" data-action-id="${a.id}" data-aprop="selection">` +
      `<option value="constant" ${a.selection === 'constant' ? 'selected' : ''}>Use first comment</option>` +
      `<option value="random" ${a.selection !== 'constant' ? 'selected' : ''}>Random comment</option></select></div>${commentTemplates(a)}`;
    else if (a.type === ACTION.TRANSITION) body = transitionEditor(a, s, rule);
    else if (a.type === ACTION.EDIT_FIELDS) body = `<div class="field"><label>Fields JSON</label><textarea class="textarea mono" data-action-id="${a.id}" data-aprop="fieldsJson">${A.esc(a.fieldsJson || '{}')}</textarea></div>`;
    else if (a.type === ACTION.LABELS) body = `<div class="grid-2">` +
      `<div class="field">` +
      `<label>Add labels</label>` +
      `<input class="input" data-action-id="${a.id}" data-aprop="addText" value="${A.esc((a.add || []).join(', '))}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Remove labels</label>` +
      `<input class="input" data-action-id="${a.id}" data-aprop="removeText" value="${A.esc((a.remove || []).join(', '))}"></div></div>`;
    else if (a.type === ACTION.PRIORITY) body = `<div class="field">` +
      `<label>Priority</label>` +
      `<select class="select" data-searchable="true" data-action-id="${a.id}" data-aprop="priorityId">` +
      `<option value="">Select priority</option>${s.priorities.map(x => A.option(String(x.id), x.name, String(a.priorityId) === String(x.id))).join('')}</select></div>`;
    else if (a.type === ACTION.ALARM) body = `<div class="alarm-action-simple"><strong>Play configured alarm</strong><span>Uses the current profile alarm from Settings → Automation.</span></div>`;
    else if (a.type === ACTION.NOTIFICATION) body = `<div class="field">` +
      `<label>Title</label>` +
      `<input class="input" maxlength="160" data-action-id="${a.id}" data-aprop="title" value="${A.esc(a.title || '')}">` +
      `</div>` +
      `<div class="field">` +
      `<label>Message</label>` +
      `<textarea class="textarea" maxlength="1000" data-action-id="${a.id}" data-aprop="message">${A.esc(a.message || '')}</textarea></div>`;
    const pools = rule?.actionRandomness?.pools || [],
      poolEditor = rule?.actionRandomness?.enabled && pools.length ? `<div class="field">` +
        `<label>Random action pool</label>` +
        `<select class="select" data-action-id="${a.id}" data-aprop="randomPoolId">` +
        `<option value="">Not pooled</option>${pools.map(x => A.option(x.id, x.name || 'Pool', a.randomPoolId === x.id)).join('')}</select></div>` : '';
    const approval = `<div class="setting-line action-when-toggle">` +
      `<span>Needs approval</span>` +
      `<label class="master-switch">` +
      `<input type="checkbox" data-action-id="${a.id}" data-aprop="needsApproval" ${a.needsApproval ? 'checked' : ''}>` +
      `<span>` +
      `</span>` +
      `</label>` +
      `</div>`;
    const when = `<div class="setting-line action-when-toggle">` +
      `<span>Conditional action</span>` +
      `<label class="master-switch">` +
      `<input type="checkbox" data-action-id="${a.id}" data-aprop="when.enabled" ${a.when?.enabled ? 'checked' : ''}>` +
      `<span>` +
      `</span>` +
      `</label>` +
      `</div>${a.when?.enabled ? (A.RuleViews.actionConditionEditor?.(a, s) || '') : ''}`;
    return `<div class="action-card configured-object">` +
      `<div class="action-head">` +
      `<div class="row">` +
      `<span class="sequence-number">${index + 1}</span>` +
      `<span class="action-type">${A.esc(actionLabel(a.type))}</span>` +
      `<span class="toggle-caption">Enabled</span>` +
      `<label class="master-switch">` +
      `<input type="checkbox" data-action-id="${a.id}" data-aprop="enabled" ${a.enabled !== false ? 'checked' : ''}>` +
      `<span>` +
      `</span>` +
      `</label>` +
      `</div>` +
      `<div class="row">` +
      `<button class="btn btn-small" data-action="move-action-up" data-id="${a.id}" ${index === 0 ? 'disabled' : ''}>↑</button>` +
      `<button class="btn btn-small" data-action="move-action-down" data-id="${a.id}">↓</button>` +
      `<button class="btn btn-small btn-danger" data-action="delete-action" data-id="${a.id}">Delete</button></div></div>${body}${poolEditor}${approval}${when}${delayEditor(a, index)}</div>`;
  };
  A.RuleViews = { ...(A.RuleViews || {}), actionEditor, actionLabel, actionOptions, transitionChoices, relevantTransitionRows, targetStatusChoices, transitionMethod };
})();
