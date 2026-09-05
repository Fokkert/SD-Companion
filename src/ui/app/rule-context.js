(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    R = SD.ConditionRegistry,
    CONTEXT_FIELDS = new Set(['project', 'issueType', 'status']);

  const contextKey = x => `${x.projectKey || x.projectId || ''}|${x.issueTypeId || ''}|${x.statusId || ''}`;

  const addContext = (map, row) => {
    const normalized = {
      projectId: String(row?.projectId || ''),
      projectKey: String(row?.projectKey || ''),
      projectName: String(row?.projectName || ''),
      issueTypeId: String(row?.issueTypeId || ''),
      issueTypeName: String(row?.issueTypeName || ''),
      statusId: String(row?.statusId || row?.id || ''),
      statusName: String(row?.statusName || row?.name || '')
    };
    const key = contextKey(normalized);
    if (!map.has(key)) map.set(key, normalized);
    else {
      const existing = map.get(key);
      for (const prop of Object.keys(normalized)) {
        if (!existing[prop] && normalized[prop]) existing[prop] = normalized[prop];
      }
    }
  };

  const contextRows = site => {
    const map = new Map(),
      projects = new Map((site?.projects || []).map(x => [String(x.key || ''), x]));

    for (const row of site?.projectStatusMatrix || []) addContext(map, row);
    for (const row of site?.statuses || []) {
      const project = projects.get(String(row.projectKey || ''));
      addContext(map, {
        ...row,
        projectId: row.projectId || project?.id || '',
        projectName: row.projectName || project?.name || ''
      });
    }

    for (const issueType of site?.issueTypes || []) {
      const project = projects.get(String(issueType.projectKey || '')),
        pairPrefix = `${String(issueType.projectKey || '')}|${String(issueType.id || '')}|`;
      if (![...map.keys()].some(key => key.startsWith(pairPrefix))) {
        addContext(map, {
          projectId: project?.id || '',
          projectKey: issueType.projectKey || '',
          projectName: project?.name || '',
          issueTypeId: issueType.id || '',
          issueTypeName: issueType.name || ''
        });
      }
    }

    for (const project of site?.projects || []) {
      const prefix = `${String(project.key || '')}|`;
      if (![...map.keys()].some(key => key.startsWith(prefix))) {
        addContext(map, {
          projectId: project.id || '',
          projectKey: project.key || '',
          projectName: project.name || ''
        });
      }
    }

    return [...map.values()];
  };

  const candidatesFor = (ctx, field) => {
    if (field === 'project') return [ctx.projectId, ctx.projectKey, ctx.projectName].filter(Boolean);
    if (field === 'issueType') return [ctx.issueTypeId, ctx.issueTypeName].filter(Boolean);
    if (field === 'status') return [ctx.statusId || ctx.fromStatusId, ctx.statusName || ctx.fromStatusName].filter(Boolean);
    return [];
  };

  const contextConditionMatch = (condition, ctx) => {
    if (!condition || !CONTEXT_FIELDS.has(condition.field)) return null;
    const candidates = candidatesFor(ctx, condition.field).map(x => String(x).toLowerCase()),
      values = R.conditionValues(condition).map(x => String(x).toLowerCase());
    if (!candidates.length) return null;
    const hasValue = candidates.some(Boolean);
    let result;

    if (condition.operator === 'exists') result = hasValue;
    else if (condition.operator === 'not-exists') result = !hasValue;
    else if (!values.length) return null;
    else if (condition.operator === 'equals' || condition.operator === 'is-any-of') result = candidates.some(x => values.includes(x));
    else if (condition.operator === 'not-equals' || condition.operator === 'is-none-of') result = !candidates.some(x => values.includes(x));
    else return null;

    return condition.negate ? !result : result;
  };

  const groupAllowsContext = (group, ctx, { omitConditionId = '', recommendation = false } = {}) => {
    const conditions = (group?.conditions || []).filter(c => String(c.id || '') !== String(omitConditionId || ''));
    if (!conditions.length) return true;

    // OR siblings are alternatives, and negated groups invert the relationship between sibling
    // constraints. Neither can safely narrow the value list of the condition being edited.
    if (recommendation && omitConditionId && (group?.operator === 'OR' || group?.negate)) return true;

    const results = conditions.map(c => contextConditionMatch(c, ctx)),
      hasTrue = results.some(x => x === true),
      hasFalse = results.some(x => x === false),
      hasUnknown = results.some(x => x === null),
      isOr = group?.operator === 'OR';

    if (group?.negate) {
      // We are testing whether the original group *can be false*. Unknown non-contextual
      // conditions are treated conservatively because they may make a negated group match.
      return isOr ? !hasTrue : (hasFalse || hasUnknown);
    }

    if (isOr) {
      // A non-contextual condition could independently make the OR group true. In that case
      // narrowing project/type/status contexts would hide valid possibilities.
      return hasTrue || hasUnknown;
    }

    // Non-contextual conditions in an AND group do not alter the feasible Jira context.
    return !hasFalse;
  };

  const logicAllowsContext = (logic, ctx) => {
    const groups = logic?.groups || [];
    if (!groups.length) return true;
    const matches = groups.map(group => groupAllowsContext(group, ctx));
    return logic?.operator === 'OR' ? matches.some(Boolean) : matches.every(Boolean);
  };

  const recommendationContexts = (site, group, condition) => {
    const rows = contextRows(site);
    if (!rows.length) return [];
    return rows.filter(ctx => groupAllowsContext(group, ctx, {
      omitConditionId: condition?.id || '',
      recommendation: true
    }));
  };

  A.RuleContext = Object.freeze({
    CONTEXT_FIELDS,
    contextRows,
    candidatesFor,
    contextConditionMatch,
    groupAllowsContext,
    logicAllowsContext,
    recommendationContexts
  });
})();
