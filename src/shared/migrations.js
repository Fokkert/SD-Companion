(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {},
    { SCHEMA_VERSION, EXECUTION_POLICY, CONFLICT_MODE, LIMITS, TRANSITION_METHOD } = root.Constants;
  const FACTORY_COMMENTS = new Set([
    "Ticket {{issue.key}} is now under review.",
    "Ticket received and assigned for initial review.",
    "Initial triage has started. Further updates will follow.",
    "The request is now under review by the Service Desk."
  ]);
  const normalizeAlarmPreset = value => ({ soft: 'pulse', double: 'tripleBeep', bell: 'classic' }[value] || value || 'radar');
  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const normalizeUnit = (u, fallback = 'seconds') => ['seconds', 'minutes', 'hours'].includes(u) ? u : fallback;
  const sanitizeRequestPolicy = old => {
    const d = root.Defaults.requestPolicy(), p = { ...d, ...old };
    const oldHealth = Number(old?.healthIntervalSeconds) || Number(old?.healthIntervalMinutes) * 60 || d.healthIntervalSeconds;
    return {
      ...p,
      spacingMs: clamp(p.spacingMs, LIMITS.REQUEST_SPACING_MIN_MS, LIMITS.REQUEST_SPACING_MAX_MS, d.spacingMs),
      jitterPercent: clamp(p.jitterPercent, 0, LIMITS.REQUEST_JITTER_MAX, d.jitterPercent),
      timeoutMs: clamp(p.timeoutMs, LIMITS.REQUEST_TIMEOUT_MIN_MS, LIMITS.REQUEST_TIMEOUT_MAX_MS, d.timeoutMs),
      retries: clamp(p.retries, 0, LIMITS.REQUEST_RETRIES_MAX, d.retries),
      healthIntervalSeconds: clamp(oldHealth, 60, 7200, d.healthIntervalSeconds),
      healthIntervalUnit: normalizeUnit(old?.healthIntervalUnit, old?.healthIntervalMinutes ? 'minutes' : d.healthIntervalUnit),
      maxRequestsPerMinute: clamp(p.maxRequestsPerMinute, LIMITS.REQUESTS_PER_MINUTE_MIN, LIMITS.REQUESTS_PER_MINUTE_MAX, d.maxRequestsPerMinute),
      maxConcurrent: clamp(p.maxConcurrent, LIMITS.CONCURRENCY_MIN, LIMITS.CONCURRENCY_MAX, d.maxConcurrent),
      backoffMaxSeconds: clamp(p.backoffMaxSeconds, 5, LIMITS.BACKOFF_MAX_SECONDS, d.backoffMaxSeconds),
      backoffUnit: normalizeUnit(old?.backoffUnit, 'seconds')
    };
  };
  const sanitizeActions = (actions = [], ruleDelay = { minSeconds: 2, maxSeconds: 12 }) => (actions || []).map(a => {
    const x = { ...root.Defaults.action(a.type), ...structuredClone(a) };
    if (x.type === 'comment') x.templates = (x.templates || x.comments || []).filter(v => !FACTORY_COMMENTS.has(String(v).trim()));
    if (x.type === 'alarm') {
      for (const k of [
        'preset',
        'useCustom',
        'customDataUrl',
        'customName',
        'durationSeconds',
        'durationUnit',
        'volume',
        'loop',
        'stopMethod',
        'showSystemNotification',
        'showPagePopup',
        'escalationEnabled',
        'repeatEveryMinutes',
        'repeatEveryUnit',
        'maxRepeats'
      ]) delete x[k];
    }
    const rawMin = clamp(x.delay?.minSeconds ?? ruleDelay.minSeconds ?? 2, 0, LIMITS.ACTION_DELAY_MAX_SECONDS, 2),
      rawMax = clamp(x.delay?.maxSeconds ?? ruleDelay.maxSeconds ?? 12, 0, LIMITS.ACTION_DELAY_MAX_SECONDS, 12);
    const delayMode = ['inherit', 'override', 'after-previous'].includes(x.delay?.mode) ? x.delay.mode : 'inherit';
    x.delay = { mode: delayMode, minSeconds: Math.min(rawMin, rawMax), maxSeconds: Math.max(rawMin, rawMax), unit: normalizeUnit(x.delay?.unit, ruleDelay?.unit || 'seconds') };
    x.randomPoolId = String(x.randomPoolId || '');
    const when = x.when && typeof x.when === 'object' ? x.when : {},
      logic = normalizeLogic(when.logic || root.Defaults.group && { operator: 'AND', groups: [root.Defaults.group()] });
    if (logic?.groups?.length === 1) {
      const op = logic.groups[0].operator === 'OR' ? 'OR' : 'AND';
      logic.groups[0].operator = op;
      logic.operator = op;
    }
    x.when = { enabled: Boolean(when.enabled), logic };
    return x;
  });
  const isFactoryRule = r => {
    if (!r) return false;
    if (r.name === 'New Jira issue') return true;
    const sourceEmpty = !(r.source?.jql || '').trim() && !(r.source?.filterIds || []).length,
      comments = (r.actions || []).filter(a => a.type === 'comment').flatMap(a => a.templates || a.comments || []),
      hasFactoryComment = comments.some(v => FACTORY_COMMENTS.has(String(v).trim())),
      actionTypes = (r.actions || []).map(a => a.type).sort().join(',');
    return sourceEmpty && hasFactoryComment && ['alarm,assign,comment', 'assign,comment', 'comment'].includes(actionTypes);
  };
  const normalizeLogic = logic => {
    for (const g of logic?.groups || []) for (const c of g.conditions || []) root.ConditionRegistry?.normalizeCondition?.(c);
    return logic;
  };
  const preserveRuleLogic = logic => {
    const source = logic && typeof logic === 'object' ? structuredClone(logic) : {},
      incomingGroups = Array.isArray(source.groups) ? source.groups : [],
      groups = incomingGroups.map(group => {
        const base = root.Defaults.group(),
          incomingConditions = Array.isArray(group?.conditions) ? group.conditions : [];
        return {
          ...base,
          ...(group || {}),
          id: String(group?.id || base.id),
          operator: group?.operator === 'OR' ? 'OR' : 'AND',
          negate: Boolean(group?.negate),
          conditions: incomingConditions.map(condition => {
            const conditionBase = root.Defaults.condition();
            return { ...conditionBase, ...(condition || {}), id: String(condition?.id || conditionBase.id) };
          })
        };
      });
    if (!groups.length) groups.push(root.Defaults.group());
    return normalizeLogic({
      ...source,
      operator: source.operator === 'OR' ? 'OR' : 'AND',
      groups,
      needsReview: Boolean(source.needsReview)
    });
  };
  const migrateRule = old => {
    const d = root.Defaults.rule(old.name || 'Rule'),
      legacyScheduleIds = old.scheduleIds || [],
      legacyDelay = old.randomDelay || {},
      incomingSchedule = old.schedule || { mode: legacyScheduleIds.length ? 'scheduled' : 'always', scheduleIds: legacyScheduleIds };
    const schedule = {
      ...d.schedule,
      ...incomingSchedule,
      mode: incomingSchedule.mode === 'schedule' ? 'scheduled' : (incomingSchedule.mode || 'always'),
      scheduleIds: incomingSchedule.scheduleIds || legacyScheduleIds
    };
    const repeatSeconds = Number(old.executionPolicy?.repeatSeconds) || Number(old.executionPolicy?.repeatMinutes) * 60 || d.executionPolicy.repeatSeconds;
    const overlapSeconds = Number(old.polling?.cursorOverlapSeconds) || Number(old.polling?.cursorOverlapMinutes) * 60 || d.polling.cursorOverlapSeconds;
    const rawRuleMin = clamp(legacyDelay.minSeconds, 0, LIMITS.ACTION_DELAY_MAX_SECONDS, d.randomDelay.minSeconds),
      rawRuleMax = clamp(legacyDelay.maxSeconds, 0, LIMITS.ACTION_DELAY_MAX_SECONDS, d.randomDelay.maxSeconds),
      ruleDelay = { ...d.randomDelay, ...legacyDelay, minSeconds: Math.min(rawRuleMin, rawRuleMax), maxSeconds: Math.max(rawRuleMin, rawRuleMax), unit: normalizeUnit(legacyDelay.unit, 'seconds') };
    const out = {
      ...d,
      ...old,
      enabled: Boolean(old.enabled),
      schedule,
      logic: preserveRuleLogic(old.logic || d.logic),
      executionPolicy: {
        ...d.executionPolicy,
        ...old.executionPolicy,
        mode: old.executionPolicy?.mode || EXECUTION_POLICY.ONCE_ISSUE,
        repeatSeconds: clamp(repeatSeconds, LIMITS.REPEAT_SECONDS_MIN, LIMITS.REPEAT_SECONDS_MAX, d.executionPolicy.repeatSeconds),
        repeatUnit: normalizeUnit(old.executionPolicy?.repeatUnit, old.executionPolicy?.repeatMinutes ? 'minutes' : d.executionPolicy.repeatUnit)
      },
      conflict: { ...d.conflict, ...old.conflict, mode: old.stopAfterMatch ? CONFLICT_MODE.STOP_LOWER : (old.conflict?.mode || CONFLICT_MODE.CONTINUE) },
      polling: {
        ...d.polling,
        ...old.polling,
        cursorOverlapSeconds: clamp(overlapSeconds, LIMITS.CURSOR_OVERLAP_MIN_SECONDS, LIMITS.CURSOR_OVERLAP_MAX_SECONDS, d.polling.cursorOverlapSeconds),
        cursorOverlapUnit: normalizeUnit(old.polling?.cursorOverlapUnit, old.polling?.cursorOverlapMinutes ? 'minutes' : d.polling.cursorOverlapUnit)
      },
      randomDelay: ruleDelay,
      chainDependency: {
        cancelled: ['continue', 'stop'].includes(old.chainDependency?.cancelled) ? old.chainDependency.cancelled : d.chainDependency.cancelled,
        skipped: ['continue', 'stop'].includes(old.chainDependency?.skipped) ? old.chainDependency.skipped : d.chainDependency.skipped,
        failed: ['continue', 'stop'].includes(old.chainDependency?.failed) ? old.chainDependency.failed : d.chainDependency.failed
      },
      manualProcess: { relativeSchedule: ['update', 'preserve'].includes(old.manualProcess?.relativeSchedule) ? old.manualProcess.relativeSchedule : d.manualProcess.relativeSchedule },
      alertThrottle: {
        ...d.alertThrottle,
        ...(old.alertThrottle || {}),
        enabled: Boolean(old.alertThrottle?.enabled),
        maxAlerts: clamp(old.alertThrottle?.maxAlerts, 1, LIMITS.ALERT_THROTTLE_MAX_ALERTS, d.alertThrottle.maxAlerts),
        windowMinutes: clamp(old.alertThrottle?.windowMinutes, 1, LIMITS.ALERT_THROTTLE_WINDOW_MAX_MINUTES, d.alertThrottle.windowMinutes)
      },
      actionRandomness: {
        ...d.actionRandomness,
        ...(old.actionRandomness || {}),
        enabled: Boolean(old.actionRandomness?.enabled),
        pools: Array.isArray(old.actionRandomness?.pools) ? old.actionRandomness.pools.map(x => ({ id: String(x.id || crypto.randomUUID()), name: String(x.name || 'Pool'), pickCount: Math.max(1, Number(x.pickCount) || 1) })) : []
      },
      actions: sanitizeActions(old.actions, ruleDelay),
      runtime: { ...d.runtime, ...old.runtime, counters: { ...d.runtime.counters, ...old.runtime?.counters } }
    };
    delete out.safety;
    delete out.polling.cursorOverlapMinutes;
    delete out.executionPolicy.repeatMinutes;
    return out;
  };
  const looksLikeStockSchedule = s => {
    const name = String(s?.name || '').trim().toLowerCase();
    return name === 'business hours' || name === 'bussiness hours';
  };
  const canonicalCachedField = f => {
    const id = String(f?.id || f?.fieldId || f?.key || '');
    if (!id) return null;
    const schema = f?.schema && typeof f.schema === 'object' ? f.schema : {};
    return {
      id,
      key: String(f?.key || f?.fieldId || id),
      name: f?.name || f?.fieldName || id,
      custom: Boolean(f?.custom || schema?.custom),
      orderable: f?.orderable !== false,
      navigable: f?.navigable !== false,
      searchable: f?.searchable !== false,
      schema,
      clauseNames: Array.isArray(f?.clauseNames) ? f.clauseNames : [],
      allowedValues: Array.isArray(f?.allowedValues) ? structuredClone(f.allowedValues) : [],
      contexts: Array.isArray(f?.contexts) ? structuredClone(f.contexts) : []
    };
  };
  const dedupeCachedFields = fields => {
    const out = new Map();
    for (const raw of Array.isArray(fields) ? fields : []) {
      const f = canonicalCachedField(raw);
      if (f && !out.has(f.id)) out.set(f.id, f);
    }
    return [...out.values()];
  };
  const contextualCachedTransitionCount = catalog => (Array.isArray(catalog) ? catalog : []).reduce((n, ctx) => n + (Array.isArray(ctx?.transitions) ? ctx.transitions.length : 0), 0);
  const deriveSafety = (input, profiles) => {
    const d = root.Defaults.safety(), existing = input?.system?.safety || {};
    if (Object.keys(existing).length) return { ...d, ...existing };
    const all = (profiles || []).flatMap(p => p.rules || []).map(r => r.safety).filter(Boolean);
    if (!all.length) return d;
    const min = (key, fallback) => Math.min(...all.map(x => Number(x?.[key])).filter(Number.isFinite), fallback);
    return {
      maxIssuesPerCycle: clamp(min('maxIssuesPerCycle', d.maxIssuesPerCycle), 1, LIMITS.RULE_MAX_ISSUES, d.maxIssuesPerCycle),
      maxActionsPerCycle: clamp(min('maxActionsPerCycle', d.maxActionsPerCycle), 1, LIMITS.RULE_MAX_ACTIONS, d.maxActionsPerCycle),
      maxCommentsPerHour: clamp(min('maxCommentsPerHour', d.maxCommentsPerHour), 0, LIMITS.RULE_MAX_HOURLY, d.maxCommentsPerHour),
      maxAssignmentsPerHour: clamp(min('maxAssignmentsPerHour', d.maxAssignmentsPerHour), 0, LIMITS.RULE_MAX_HOURLY, d.maxAssignmentsPerHour),
      maxTransitionsPerHour: clamp(min('maxTransitionsPerHour', d.maxTransitionsPerHour), 0, LIMITS.RULE_MAX_HOURLY, d.maxTransitionsPerHour)
    };
  };
  const migrateState = input => {
    if (!input || typeof input !== "object") return { state: root.Defaults.state(), changed: true };
    const original = structuredClone(input),
      s = structuredClone(input),
      fromVersion = Number(input.schemaVersion) || 0;
    if (!Array.isArray(s.jiraSites)) s.jiraSites = [];
    if (!Array.isArray(s.profiles) || !s.profiles.length) s.profiles = [root.Defaults.profile()];
    const globalSafety = deriveSafety(input, s.profiles);
    s.jiraSites = s.jiraSites.map(x => {
      const site = root.Defaults.site({ ...x, auth: { ...x.auth, token: undefined } }),
        oldSelected = Array.isArray(x.inventorySettings?.selectedProjectKeys) ? x.inventorySettings.selectedProjectKeys.filter(Boolean) : [],
        oldMap = x.inventorySettings?.projectDatasets && typeof x.inventorySettings.projectDatasets === 'object' ? x.inventorySettings.projectDatasets : {};
      site.inventorySettings.projectDatasets = { ...oldMap };
      for (const key of oldSelected) if (!site.inventorySettings.projectDatasets[key]) site.inventorySettings.projectDatasets[key] = root.Defaults.projectDatasets(true);
      for (const [key, cfg] of Object.entries(site.inventorySettings.projectDatasets)) site.inventorySettings.projectDatasets[key] = { ...root.Defaults.projectDatasets(false), ...(cfg || {}) };
      site.inventorySettings.selectedProjectKeys = root.Utils.discoveryProjectKeys(site.inventorySettings);
      site.inventorySettings.globalDatasets = { priorities: true, resolutions: true, ...(x.inventorySettings?.globalDatasets || {}) };
      site.inventorySettings.scopeRevision = Number(x.inventorySettings?.scopeRevision) || 0;
      const oldAuto = x.inventorySettings?.autoSync || {};
      site.inventorySettings.autoSync = {
        ...root.Defaults.inventorySettings().autoSync,
        ...oldAuto,
        enabled: Boolean(oldAuto.enabled),
        intervalSeconds: clamp(Number(oldAuto.intervalSeconds) || Number(oldAuto.intervalMinutes) * 60 || 3600, LIMITS.METADATA_SYNC_MIN_SECONDS, LIMITS.METADATA_SYNC_MAX_SECONDS, 3600),
        unit: normalizeUnit(oldAuto.unit, oldAuto.intervalMinutes ? 'minutes' : 'hours')
      };
      const transitionMethods = new Set(Object.values(TRANSITION_METHOD));
      site.inventorySettings.transitionMethod = transitionMethods.has(x.inventorySettings?.transitionMethod) ? x.inventorySettings.transitionMethod : TRANSITION_METHOD.WORKFLOW_DESIGNER;
      const oldConn = x.behavior?.connectionLossAlarm || {},
        connDefault = root.Defaults.site().behavior.connectionLossAlarm;
      site.behavior.connectionLossAlarm = {
        ...connDefault,
        ...oldConn,
        enabled: oldConn.enabled !== false,
        trigger: ['duration', 'failures', 'either'].includes(oldConn.trigger) ? oldConn.trigger : 'either',
        durationSeconds: clamp(Number(oldConn.durationSeconds) || Number(oldConn.durationMinutes) * 60 || connDefault.durationSeconds, LIMITS.CONNECTION_LOSS_MIN_SECONDS, LIMITS.CONNECTION_LOSS_MAX_SECONDS, connDefault.durationSeconds),
        durationUnit: normalizeUnit(oldConn.durationUnit, oldConn.durationMinutes ? 'minutes' : 'minutes'),
        failedChecks: clamp(oldConn.failedChecks, LIMITS.CONNECTION_LOSS_FAILURES_MIN, LIMITS.CONNECTION_LOSS_FAILURES_MAX, connDefault.failedChecks)
      };
      site.runtime.connectionLossStartedAt = site.runtime.connectionLossStartedAt || null;
      site.runtime.connectionLossFailures = Math.max(0, Number(site.runtime.connectionLossFailures) || 0);
      site.runtime.connectionLossAlarmFiredAt = site.runtime.connectionLossAlarmFiredAt || null;
      delete site.inventorySettings.maxTransitionSamples;
      delete site.inventorySettings.transitionSamplesPerContext;
      site.fields = dedupeCachedFields(site.fields);
      const transitionCount = contextualCachedTransitionCount(site.transitionCatalog);
      site.inventory.counts = { ...(site.inventory?.counts || {}), fields: site.fields.length, transitions: transitionCount, transitionContexts: Array.isArray(site.transitionCatalog) ? site.transitionCatalog.length : 0 };
      if (site.inventory?.freshness?.fields) site.inventory.freshness.fields = { ...site.inventory.freshness.fields, count: site.fields.length };
      if (site.inventory?.freshness?.transitions) site.inventory.freshness.transitions = { ...site.inventory.freshness.transitions, count: transitionCount };
      site.network.requestPolicy = sanitizeRequestPolicy(x.network?.requestPolicy);
      site.components = [];
      site.versions = [];
      site.projectRoles = [];
      site.issues = [];
      site.inventory.filterCoverage = site.inventory?.filterCoverage || 'unknown';
      site.inventory.filterCoverageNote = site.inventory?.filterCoverageNote || '';
      return site;
    });
    s.profiles = s.profiles.map(old => {
      const d = root.Defaults.profile(old.name || "Profile"),
        migratedRules = (Array.isArray(old.rules) ? old.rules : []).filter(r => !isFactoryRule(r)).map(migrateRule);
      let schedules = Array.isArray(old.schedules) ? old.schedules.map(x => ({ ...root.Defaults.schedule(x.name || 'Schedule'), ...x })) : [];
      const removedStockIds = new Set((fromVersion < 21 ? schedules.filter(looksLikeStockSchedule) : []).map(x => x.id));
      schedules = schedules.filter(x => !removedStockIds.has(x.id));
      if (removedStockIds.size) for (const rule of migratedRules) {
        if (rule.schedule?.mode !== 'scheduled') continue;
        rule.schedule.scheduleIds = (rule.schedule.scheduleIds || []).filter(id => !removedStockIds.has(id));
        if (!rule.schedule.scheduleIds.length) rule.enabled = false;
      }
      const intervalSeconds = clamp(Number(old.monitoring?.intervalSeconds) || Number(old.monitoring?.intervalMinutes) * 60 || 60, LIMITS.POLL_MIN_SECONDS, LIMITS.POLL_MAX_SECONDS, 60);
      const baseAlarm = d.alarmProfiles?.[0] || { preset: 'radar', durationSeconds: 12, durationUnit: 'seconds', volume: .8, loop: true, stopMethod: 'duration' },
        alarmDefaults = { ...baseAlarm, ...(old.alarmDefaults || {}), preset: normalizeAlarmPreset(old.alarmDefaults?.preset || baseAlarm.preset) };
      delete alarmDefaults.escalationEnabled;
      delete alarmDefaults.repeatEveryMinutes;
      delete alarmDefaults.repeatEveryUnit;
      delete alarmDefaults.maxRepeats;
      const out = {
        ...d,
        ...old,
        monitoring: {
          ...d.monitoring,
          ...old.monitoring,
          intervalSeconds,
          intervalUnit: normalizeUnit(old.monitoring?.intervalUnit, old.monitoring?.intervalMinutes ? 'minutes' : 'minutes'),
          scheduleIds: undefined,
          pausedUntil: undefined,
          pauseReason: undefined
        },
        alarmDefaults,
        radar: { ...d.radar, ...old.radar },
        runtime: { ...d.runtime, ...old.runtime },
        schedules,
        rules: migratedRules,
        randomness: undefined
      };
      delete out.safety;
      return out;
    });
    if (fromVersion < 21) for (const site of s.jiraSites) {
      const ps = s.profiles.filter(p => p.siteId === site.id);
      for (const p of ps) {
        if (String(p.name || '').trim() === String(site.name || '').trim()) p.name = 'Default Profile';
      }
    }
    s.appearance = { theme: "emerald-glass", openTarget: "popup", glassStrength: .82, ...(s.appearance || {}) };
    const retiredThemes = {
      "beacon-dark": "emerald-glass",
      "light": "graphite-glass",
      "system": "emerald-glass",
      "teal-glass": "ocean-glass",
      "rose-glass": "crimson-glass",
      "ice-glass": "midnight-glass",
      "frost-light": "graphite-glass",
      "obsidian-glass": "graphite-glass",
      "crimson-night": "crimson-glass",
      "violet-glass": "aurora-glass",
      "amber-glass": "slate-gold-glass"
    };
    if (retiredThemes[s.appearance.theme]) s.appearance.theme = retiredThemes[s.appearance.theme];
    s.system = { logLevel: 'info', activityRefreshSeconds: 3, activityRefreshUnit: 'seconds', completionToneEnabled: true, ...(s.system || {}), safety: globalSafety };
    s.system.activityRefreshSeconds = clamp(s.system.activityRefreshSeconds, LIMITS.ACTIVITY_REFRESH_MIN_SECONDS, LIMITS.ACTIVITY_REFRESH_MAX_SECONDS, 3);
    s.system.activityRefreshUnit = normalizeUnit(s.system.activityRefreshUnit, 'seconds');
    s.system.completionToneEnabled = s.system.completionToneEnabled !== false;
    delete s.system.dryRun;
    s.configRevision = Math.max(1, Number(s.configRevision) || 1);
    // v2.4.0: alarm profiles, synchronized-data exclusions and exclusive rule source mode.
    for (const site of s.jiraSites || []) {
      site.inventorySettings = { ...root.Defaults.inventorySettings(), ...(site.inventorySettings || {}) };
      site.inventorySettings.excludedData = { ...root.Defaults.inventorySettings().excludedData, ...(site.inventorySettings.excludedData || {}) };
      site.inventorySettings.restoreExcludedOnRefresh = Boolean(site.inventorySettings.restoreExcludedOnRefresh);
    }
    for (const profile of s.profiles || []) {
      if (!Array.isArray(profile.alarmProfiles) || !profile.alarmProfiles.length) {
        const old = profile.alarmDefaults || {}, alarm = { id: crypto.randomUUID(), name: 'Default Alarm', preset: normalizeAlarmPreset(old.preset || 'radar'), useCustom: Boolean(old.useCustom), customDataUrl: old.customDataUrl || '', customName: old.customName || '', durationSeconds: Number(old.durationSeconds) || 12, durationUnit: old.durationUnit || 'seconds', volume: Number.isFinite(Number(old.volume)) ? Number(old.volume) : .8, loop: old.loop !== false, stopMethod: ['keyboard','duration','click-anywhere','popup'].includes(old.stopMethod) ? old.stopMethod : 'duration', keyboardShortcut: old.keyboardShortcut || 'Ctrl+Shift+S' };
        profile.alarmProfiles = [alarm]; profile.defaultAlarmProfileId = alarm.id;
      }
      if (!profile.defaultAlarmProfileId || !profile.alarmProfiles.some(x => x.id === profile.defaultAlarmProfileId)) profile.defaultAlarmProfileId = profile.alarmProfiles[0]?.id || '';
      delete profile.alarmDefaults;
      for (const rule of profile.rules || []) {
        const hasJqlSource = Boolean(String(rule.source?.jql || '').trim() || (rule.source?.filterIds || []).length),
          declaredSourceMode = ['jql', 'conditions'].includes(rule.source?.mode) ? rule.source.mode : '',
          sourceMode = declaredSourceMode || (hasJqlSource ? 'jql' : 'conditions');
        rule.source = { ...(rule.source || {}), mode: sourceMode };
        rule.source.filterIds = Array.isArray(rule.source.filterIds) ? rule.source.filterIds.map(String).filter(Boolean) : [];
        rule.source.jql = String(rule.source.jql || '');
        if (sourceMode === 'jql') rule.logic = { operator: 'AND', groups: [] };
        else {
          rule.source.filterIds = [];
          rule.source.jql = '';
        }
        for (const action of rule.actions || []) if (action.type === root.Constants.ACTION.ALARM && !action.alarmProfileId) action.alarmProfileId = profile.defaultAlarmProfileId;
      }
    }
    s.schemaVersion = SCHEMA_VERSION;
    s.appVersion = "V2";
    if (!s.activeProfileId || !s.profiles.some(p => p.id === s.activeProfileId)) s.activeProfileId = s.profiles[0].id;
    if (s.activeSiteId && !s.jiraSites.some(x => x.id === s.activeSiteId)) s.activeSiteId = "";
    return { state: s, changed: JSON.stringify(original) !== JSON.stringify(s) };
  };
  root.Migrations = Object.freeze({ migrateState });
})();
