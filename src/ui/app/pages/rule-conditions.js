(() => {
  const A = globalThis.SDApp, SD = globalThis.SDCompanion, R = SD.ConditionRegistry;
  const opLabels = {
    "is-any-of": "is any of",
    "is-none-of": "is none of",
    "equals": "equals",
    "not-equals": "does not equal",
    "exists": "is set",
    "not-exists": "is empty",
    "contains": "contains",
    "not-contains": "does not contain",
    "contains-any": "contains any",
    "contains-all": "contains all",
    "gt": "is greater than",
    "gte": "is at least",
    "lt": "is less than",
    "lte": "is at most",
    "before": "is before",
    "on-or-before": "is on/before",
    "after": "is after",
    "on-or-after": "is on/after"
  };
  const sourceItems = (field, s, def = R.get(field, s)) => {
    if (field === 'project') return (s.projects || []).map(x => ({ v: String(x.key), l: `${x.key} · ${x.name}` }));
    if (field === 'issueType') return A.uniqueIssueTypes(s).map(x => ({ v: String(x.id), l: x.name }));
    if (field === 'status') return A.uniqueStatuses(s).map(x => ({ v: String(x.id), l: x.name }));
    if (field === 'assignee' || field === 'reporter' || def?.source === 'users') return (s.users || []).map(x => ({ v: SD.Utils.userKey(x), l: x.displayName || x.name || SD.Utils.userKey(x) }));
    if (field === 'priority') return (s.priorities || []).map(x => ({ v: String(x.id), l: x.name }));
    if (field === 'resolution') return (s.resolutions || []).map(x => ({ v: String(x.id), l: x.name }));
    const f = (s.fields || []).find(x => String(x.id || x.key) === String(field)),
      allowed = f?.allowedValues || f?.values || [],
      items = [];
    const walk = (rows, prefix = '') => {
      for (const x of rows || []) {
        const raw = x && typeof x === 'object' ? (x.id ?? x.value ?? x.key ?? x.name ?? x.displayName) : x,
          label = x && typeof x === 'object' ? (x.name ?? x.value ?? x.displayName ?? x.key ?? x.id) : x;
        if (raw !== undefined && raw !== null && String(raw) !== '') items.push({ v: String(raw), l: `${prefix}${String(label ?? raw)}` });
        if (x && typeof x === 'object' && Array.isArray(x.children)) walk(x.children, `${String(label ?? raw)} → `);
      }
    };
    walk(allowed);
    return [...new Map(items.map(x => [x.v, x])).values()];
  };
  const attrs = (c, scope, actionId, prop) => scope === 'action' ? `data-action-cond="${c.id}" data-action-cond-action="${actionId}" data-prop="${prop}"` : `data-cond="${c.id}" data-prop="${prop}"`;
  const valueEditor = (c, s, scope = 'rule', actionId = '') => {
    const def = R.get(c.field, s) || R.get('project'),
      mode = R.valueMode(c.field, c.operator),
      a = p => attrs(c, scope, actionId, p);
    if (mode === 'none') return `<div class="condition-empty-value">No value</div>`;
    const items = sourceItems(c.field, s, def);
    if (def.kind === 'choices' && items.length) {
      if (mode === 'multi') return A.glassMulti(items, x => x.v, x => x.l, R.conditionValues(c), `data-multi-scope="${scope === 'action' ? 'action-condition' : 'condition'}" data-multi-id="${c.id}" ${scope === 'action' ? `data-action-id="${actionId}"` : ''} data-multi-prop="values"`, 'No synchronized options.', 'Search options…');
      const current = R.conditionValues(c)[0] || '';
      return `<select class="select" data-searchable="true" ${a('value')}><option value="">Select one</option>${items.map(x => A.option(x.v, x.l, String(current) === String(x.v))).join('')}</select>`;
    }
    if (mode === 'multi') return `<input class="input" maxlength="2000" ${a('valuesText')} value="${A.esc(R.conditionValues(c).join(', '))}" placeholder="Value 1, Value 2">`;
    if (def.kind === 'number') return `<input class="input" type="number" ${def.min !== undefined ? `min="${def.min}"` : ''} ${def.max !== undefined ? `max="${def.max}"` : ''} ${a('value')} value="${A.esc(R.conditionValues(c)[0] || '')}" placeholder="Number">`;
    if (def.kind === 'date') return `<input class="input" type="date" ${a('value')} value="${A.esc(R.conditionValues(c)[0] || '')}">`;
    if (def.kind === 'datetime') return `<input class="input" type="datetime-local" ${a('value')} value="${A.esc(String(R.conditionValues(c)[0] || '').replace(/Z$/, '').slice(0, 16))}">`;
    if (def.kind === 'boolean') return `<select class="select" ${a('value')}>` +
      `<option value="">Select</option>` +
      `<option value="true" ${R.conditionValues(c)[0] === 'true' ? 'selected' : ''}>True</option>` +
      `<option value="false" ${R.conditionValues(c)[0] === 'false' ? 'selected' : ''}>False</option></select>`;
    return `<input class="input" maxlength="2000" ${a('value')} value="${A.esc(R.conditionValues(c)[0] || '')}" placeholder="Value">`;
  };
  const conditionRows = (g, s, scope = 'rule', actionId = '') => (g.conditions || []).map(c => {
    const d = R.get(c.field, s) || R.get('project'),
      fieldAttrs = attrs(c, scope, actionId, 'field'),
      opAttrs = attrs(c, scope, actionId, 'operator'),
      del = scope === 'action' ? `data-action="delete-action-condition" data-id="${actionId}" data-cond="${c.id}"` : `data-action="delete-condition" data-group="${g.id}" data-cond="${c.id}"`;
    return `<div class="condition-row">` +
      `<select class="select" data-searchable="true" ${fieldAttrs}>${R.fields(s).map(f => A.option(f.id, `${f.label}${f.dynamic ? ` · ${f.kind}` : ''}`, c.field === f.id)).join('')}</select>` +
      `<select class="select" ${opAttrs}>${d.operators.map(o => A.option(o, opLabels[o] || o, c.operator === o)).join('')}</select>` +
      `<div class="condition-value">${valueEditor(c, s, scope, actionId)}</div>` +
      `<button class="btn btn-small btn-danger condition-delete" ${del} title="Remove condition">×</button></div>`;
  }).join('') || '<div class="empty compact-empty">No conditions yet.</div>';
  const conditionEditor = (g, s) => `<div class="condition-simple" data-group-id="${g.id}"><div class="condition-list">${conditionRows(g, s)}</div><button class="btn btn-small" data-action="add-condition" data-group="${g.id}">+ Condition</button></div>`;
  const actionConditionEditor = (a, s) => {
    const logic = a.when?.logic || { operator: 'AND', groups: [SD.Defaults.group()] },
      g = logic.groups?.[0] || SD.Defaults.group(),
      matchOperator = g.operator === 'OR' ? 'OR' : 'AND';
    return `<div class="action-conditions">` +
      `<div class="action-condition-head">` +
      `<label>Apply action when</label>` +
      `<select class="select compact-select action-condition-match" data-action-id="${a.id}" data-action-when-op="true">` +
      `<option value="AND" ${matchOperator !== 'OR' ? 'selected' : ''}>Match all</option>` +
      `<option value="OR" ${matchOperator === 'OR' ? 'selected' : ''}>Match any</option>` +
      `</select>` +
      `</div>` +
      `<div class="condition-list">${conditionRows(g, s, 'action', a.id)}</div>` +
      `<button class="btn btn-small action-condition-add" data-action="add-action-condition" data-id="${a.id}">+ Condition</button></div>`;
  };
  A.RuleViews = { ...(A.RuleViews || {}), conditionEditor, actionConditionEditor };
})();
