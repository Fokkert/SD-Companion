(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {}, L = root.Constants.LIMITS;
  const num = (v, min, max, label, errors) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) errors.push(`${label} must be between ${min} and ${max}.`);
  };
  const validZone = z => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: z || undefined }).format(new Date());
      return true;
    } catch {
      return false;
    }
  };
  const validateAction = (a, rule, errors) => {
    const d = a.delay || {};
    if (d.mode === 'override' || d.mode === 'after-previous') {
      num(d.minSeconds, 0, L.ACTION_DELAY_MAX_SECONDS, 'Action minimum delay', errors);
      num(d.maxSeconds, 0, L.ACTION_DELAY_MAX_SECONDS, 'Action maximum delay', errors);
      if (Number(d.maxSeconds) < Number(d.minSeconds)) errors.push('Action maximum delay must be >= minimum delay.');
    }
    if (a.type === 'comment') {
      const templates = (a.templates || []).filter(Boolean);
      if (templates.length > L.COMMENT_TEMPLATE_COUNT_MAX) errors.push(`Rule '${rule.name}' has too many comment templates.`);
      if (templates.some(x => String(x).length > L.COMMENT_TEMPLATE_MAX_CHARS)) errors.push(`Rule '${rule.name}' has a comment template longer than ${L.COMMENT_TEMPLATE_MAX_CHARS} characters.`);
    }
    if (rule.enabled && a.enabled !== false) {
      if (a.type === 'assign' && a.mode === 'specific' && !a.specificUserKey) errors.push(`Rule '${rule.name}' needs a specific assignee.`);
      if (a.type === 'assign' && a.mode === 'random' && !(a.randomUserKeys || []).length) errors.push(`Rule '${rule.name}' needs users in its random assignment pool.`);
      if (a.type === 'comment' && !(a.templates || []).filter(Boolean).length) errors.push(`Rule '${rule.name}' comment action needs at least one template.`);
      if (a.type === 'transition' && !a.transitionId && !a.toStatusId && !String(a.manualTransitionName || '').trim()) errors.push(`Rule '${rule.name}' transition action needs a transition, target status, or manual transition name.`);
      if (a.type === 'priority' && !a.priorityId) errors.push(`Rule '${rule.name}' priority action needs a synchronized priority.`);
    }
  };
  const validateRule = r => {
    const errors = [];
    if (!r?.name?.trim()) errors.push('Rule name is required.');
    if (String(r?.name || '').length > 100) errors.push('Rule name must be 100 characters or shorter.');
    num(r.priority ?? 100, 1, 10000, `Rule '${r.name}' priority`, errors);
    if (r.enabled && r.schedule?.mode === 'scheduled' && !(r.schedule.scheduleIds || []).length) errors.push(`Rule '${r.name}' must select at least one schedule or use Always On.`);
    if (r.executionPolicy?.mode === root.Constants.EXECUTION_POLICY.REPEAT) num(r.executionPolicy?.repeatSeconds, L.REPEAT_SECONDS_MIN, L.REPEAT_SECONDS_MAX, `Rule '${r.name}' repeat interval`, errors);
    if (r.conflict?.mode === root.Constants.CONFLICT_MODE.EXCLUSIVE && !String(r.conflict?.group || '').trim()) errors.push(`Rule '${r.name}' needs an exclusive-group name.`);
    if (String(r.source?.jql || '').length > L.JQL_MAX_CHARS) errors.push(`Rule '${r.name}' JQL is too long.`);
    num(r.randomDelay?.minSeconds, 0, L.ACTION_DELAY_MAX_SECONDS, `Rule '${r.name}' minimum delay`, errors);
    num(r.randomDelay?.maxSeconds, 0, L.ACTION_DELAY_MAX_SECONDS, `Rule '${r.name}' maximum delay`, errors);
    if (Number(r.randomDelay?.maxSeconds) < Number(r.randomDelay?.minSeconds)) errors.push(`Rule '${r.name}' maximum delay must be >= minimum delay.`);
    num(r.polling?.cursorOverlapSeconds, L.CURSOR_OVERLAP_MIN_SECONDS, L.CURSOR_OVERLAP_MAX_SECONDS, `Rule '${r.name}' cursor overlap`, errors);
    if ((r.actions || []).length > L.RULE_ACTION_COUNT_MAX) errors.push(`Rule '${r.name}' can contain at most ${L.RULE_ACTION_COUNT_MAX} actions.`);
    for (const key of ['cancelled', 'skipped', 'failed']) if (!['continue', 'stop'].includes(r.chainDependency?.[key] || 'continue')) errors.push(`Rule '${r.name}' has an invalid chained-action dependency policy.`);
    if (!['update', 'preserve'].includes(r.manualProcess?.relativeSchedule || 'update')) errors.push(`Rule '${r.name}' has an invalid manual chained-schedule policy.`);
    for (const [i, a] of (r.actions || []).entries()) {
      validateAction(a, r, errors);
      if (i === 0 && a.delay?.mode === 'after-previous') errors.push(`Rule '${r.name}' cannot chain its first action after a previous action.`);
    }
    if (r.actionRandomness?.enabled) {
      const ids = new Set(), assigned = new Map();
      for (const a of r.actions || []) if (a.randomPoolId) assigned.set(a.randomPoolId, (assigned.get(a.randomPoolId) || 0) + 1);
      for (const p of r.actionRandomness.pools || []) {
        if (!p?.id || ids.has(p.id)) errors.push(`Rule '${r.name}' has an invalid or duplicate action pool.`);
        ids.add(p.id);
        num(p?.pickCount, 1, L.RULE_ACTION_COUNT_MAX, `Rule '${r.name}' action-pool count`, errors);
        const members = assigned.get(p.id) || 0;
        if (members && Number(p.pickCount) > members) errors.push(`Rule '${r.name}' action pool '${p.name || 'Pool'}' cannot run ${p.pickCount} action(s) because only ${members} action(s) are assigned to it.`);
      }
      for (const a of r.actions || []) if (a.randomPoolId && !ids.has(a.randomPoolId)) errors.push(`Rule '${r.name}' has an action assigned to a missing random pool.`);
    }
    if (r.enabled && root.RuleQuery && !root.RuleQuery.preview(r, null).hasConstraint) errors.push(`Rule '${r.name}' needs a saved filter, JQL, or queryable condition before it can be enabled.`);
    return errors;
  };
  const validateProfile = p => {
    const errors = [];
    if (!p?.name?.trim()) errors.push('Profile name is required.');
    if (String(p?.name || '').length > 80) errors.push('Profile name must be 80 characters or shorter.');
    if (!p?.siteId) errors.push('Profile must be bound to a Jira server.');
    num(p?.monitoring?.intervalSeconds, L.POLL_MIN_SECONDS, L.POLL_MAX_SECONDS, 'Polling interval', errors);
    num(p?.monitoring?.pollJitterPercent, 0, L.POLL_JITTER_MAX, 'Polling jitter', errors);
    const alarm = p?.alarmDefaults || {};
    num(alarm.durationSeconds ?? 12, 1, 86400, 'Profile alarm duration', errors);
    num(alarm.volume ?? .8, 0, 1, 'Profile alarm volume', errors);
    if (!root.Constants.ALARM_PRESETS.some(x => x.id === (alarm.preset || 'radar'))) errors.push('Profile alarm sound is invalid.');
    if (!root.Constants.ALARM_STOP_METHODS.some(x => x.id === (alarm.stopMethod || 'duration-or-controls'))) errors.push('Profile alarm stop method is invalid.');
    const scheduleIds = new Set((p?.schedules || []).map(s => s.id));
    for (const s of p?.schedules || []) {
      if (!s?.name?.trim()) errors.push('Schedule name is required.');
      if (!root.Schedule?.validTime(s.startTime) || !root.Schedule?.validTime(s.endTime)) errors.push(`Schedule '${s.name}' must use HH:MM:SS.`);
      if (!validZone(s.timeZone)) errors.push(`Schedule '${s.name}' has an invalid timezone.`);
      if ((s.days || []).some(d => !Number.isInteger(Number(d)) || Number(d) < 0 || Number(d) > 6)) errors.push(`Schedule '${s.name}' has an invalid day.`);
    }
    for (const r of p?.rules || []) {
      errors.push(...validateRule(r));
      if (r.enabled && r.schedule?.mode === 'scheduled') {
        const missing = (r.schedule.scheduleIds || []).filter(id => !scheduleIds.has(id));
        if (missing.length) errors.push(`Rule '${r.name}' references a schedule that no longer exists.`);
      }
    }
    return errors;
  };
  const validateRequestPolicy = p => {
    const errors = [];
    num(p.spacingMs, L.REQUEST_SPACING_MIN_MS, L.REQUEST_SPACING_MAX_MS, 'Request spacing', errors);
    num(p.jitterPercent, 0, L.REQUEST_JITTER_MAX, 'Request jitter', errors);
    num(p.timeoutMs, L.REQUEST_TIMEOUT_MIN_MS, L.REQUEST_TIMEOUT_MAX_MS, 'Request timeout', errors);
    num(p.retries, 0, L.REQUEST_RETRIES_MAX, 'Retries', errors);
    num(p.maxRequestsPerMinute, L.REQUESTS_PER_MINUTE_MIN, L.REQUESTS_PER_MINUTE_MAX, 'Requests/minute', errors);
    num(p.maxConcurrent, L.CONCURRENCY_MIN, L.CONCURRENCY_MAX, 'Concurrent requests', errors);
    num(p.healthIntervalSeconds, 60, 7200, 'Health interval', errors);
    num(p.backoffMaxSeconds || 60, 5, L.BACKOFF_MAX_SECONDS, 'Backoff ceiling', errors);
    return errors;
  };
  const validateSafety = s => {
    const errors = [];
    num(s?.maxIssuesPerCycle, 1, L.RULE_MAX_ISSUES, 'Global issues/cycle', errors);
    num(s?.maxActionsPerCycle, 1, L.RULE_MAX_ACTIONS, 'Global actions/cycle', errors);
    num(s?.maxCommentsPerHour, 0, L.RULE_MAX_HOURLY, 'Global comments/hour', errors);
    num(s?.maxAssignmentsPerHour, 0, L.RULE_MAX_HOURLY, 'Global assignments/hour', errors);
    num(s?.maxTransitionsPerHour, 0, L.RULE_MAX_HOURLY, 'Global transitions/hour', errors);
    return errors;
  };
  const validateAutoSync = a => {
    const errors = [];
    if (a?.enabled) num(a.intervalSeconds, L.METADATA_SYNC_MIN_SECONDS, L.METADATA_SYNC_MAX_SECONDS, 'Metadata sync interval', errors);
    return errors;
  };
  const validateConnectionLossAlarm = a => {
    const errors = [];
    if (!['duration', 'failures', 'either'].includes(a?.trigger || 'either')) errors.push('Connection-loss alarm trigger is invalid.');
    num(a?.durationSeconds ?? 300, L.CONNECTION_LOSS_MIN_SECONDS, L.CONNECTION_LOSS_MAX_SECONDS, 'Connection-loss alarm duration', errors);
    num(a?.failedChecks ?? 5, L.CONNECTION_LOSS_FAILURES_MIN, L.CONNECTION_LOSS_FAILURES_MAX, 'Connection-loss failed checks', errors);
    return errors;
  };
  const validateTransitionMethod = method => Object.values(root.Constants.TRANSITION_METHOD).includes(method || root.Constants.TRANSITION_METHOD.WORKFLOW_DESIGNER) ? [] : ['Transition handling method is invalid.'];
  const validateState = state => {
    const errors = [...validateSafety(state?.system?.safety || root.Defaults.safety())];
    num(state?.system?.activityRefreshSeconds ?? 3, L.ACTIVITY_REFRESH_MIN_SECONDS, L.ACTIVITY_REFRESH_MAX_SECONDS, 'Home activity refresh interval', errors);
    for (const s of state?.jiraSites || []) {
      if (!s?.name?.trim()) errors.push('Server name is required.');
      if (String(s?.name || '').length > 80) errors.push('Server name must be 80 characters or shorter.');
      errors.push(...validateRequestPolicy(s.network?.requestPolicy || {}));
      errors.push(...validateAutoSync(s.inventorySettings?.autoSync || {}));
      errors.push(...validateConnectionLossAlarm(s.behavior?.connectionLossAlarm || {}));
      errors.push(...validateTransitionMethod(s.inventorySettings?.transitionMethod));
    }
    for (const p of state?.profiles || []) if (p.siteId) errors.push(...validateProfile(p));
    return errors;
  };
  root.Validators = Object.freeze({ validateProfile, validateRule, validateAction, validateRequestPolicy, validateSafety, validateAutoSync, validateConnectionLossAlarm, validateTransitionMethod, validateState });
})();
