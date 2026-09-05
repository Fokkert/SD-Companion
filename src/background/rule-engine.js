(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {},
    { ACTION, ASSIGN_MODE, EXECUTION_POLICY, CONFLICT_MODE, JOB } = root.Constants,
    { userKey, randomChoice, randomInt, nowIso, normalizeText, template } = root.Utils;
  const ageMinutes = v => v ? Math.max(0, (Date.now() - new Date(v).getTime()) / 60000) : null;
  const flattenValue = v => {
    if (v === null || v === undefined) return [];
    if (Array.isArray(v)) return v.flatMap(flattenValue);
    if (typeof v === 'object') {
      const preferred = ['id', 'key', 'name', 'value', 'displayName', 'emailAddress'];
      const out = preferred.filter(k => v[k] !== undefined && v[k] !== null).flatMap(k => flattenValue(v[k]));
      return out.length ? out : Object.values(v).flatMap(flattenValue);
    }
    return [v];
  };
  const valuesFor = (issue, field) => {
    switch (field) {
      case "project": return [issue.projectKey, issue.projectId, issue.projectName];
      case "issueType": return [issue.issueType, issue.issueTypeId];
      case "status": return [issue.status, issue.statusId];
      case "assignee": return issue.assignee ? [userKey(issue.assignee), issue.assignee.displayName, issue.assignee.emailAddress] : [];
      case "reporter": return issue.reporter ? [userKey(issue.reporter), issue.reporter.displayName, issue.reporter.emailAddress] : [];
      case "priority": return [issue.priority, issue.priorityId];
      case "component": return (issue.components || []).flatMap(x => [x.id, x.name]);
      case "label": return (issue.labels || []).map(String);
      case "summary": return [issue.summary || ""];
      case "description": return [issue.description || ""];
      case "createdAgeMinutes": return [ageMinutes(issue.created)];
      case "updatedAgeMinutes": return [ageMinutes(issue.updated)];
      case "resolution": return [issue.resolution || "", issue.resolutionId || ""];
      default: return flattenValue(issue.fields?.[field]);
    }
  };
  const asTime = v => {
    const n = Date.parse(String(v || ''));
    return Number.isFinite(n) ? n : null;
  };
  const cmp = (issue, c) => {
    const vals = valuesFor(issue, c.field),
      wanted = (root.ConditionRegistry?.conditionValues?.(c) || (c.values?.length ? c.values : [c.value]).filter(x => x !== "" && x !== null && x !== undefined)).map(String),
      op = c.operator || "is-any-of";
    let result = true;
    if (op === "exists") result = vals.some(v => v !== null && v !== undefined && String(v) !== "");
    else if (op === "not-exists") result = !vals.some(v => v !== null && v !== undefined && String(v) !== "");
    else if (["gt", "gte", "lt", "lte"].includes(op)) {
      const a = Number(vals[0]), b = Number(wanted[0]);
      result = Number.isFinite(a) && Number.isFinite(b) && (op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b);
    }
    else if (["before", "on-or-before", "after", "on-or-after"].includes(op)) {
      const a = asTime(vals[0]), b = asTime(wanted[0]);
      result = a !== null && b !== null && (op === "before" ? a < b : op === "on-or-before" ? a <= b : op === "after" ? a > b : a >= b);
    }
    else {
      const hay = vals.map(v => normalizeText(v).toLowerCase()),
        need = wanted.map(v => normalizeText(v).toLowerCase());
      if (op === "equals" || op === "is-any-of") result = !need.length || need.some(x => hay.includes(x));
      else if (op === "not-equals" || op === "is-none-of") result = !need.some(x => hay.includes(x));
      else if (op === "contains") result = need.some(x => hay.some(v => v.includes(x)));
      else if (op === "not-contains") result = !need.some(x => hay.some(v => v.includes(x)));
      else if (op === "contains-all") result = need.every(x => hay.some(v => v.includes(x)));
      else if (op === "contains-any") result = need.some(x => hay.some(v => v.includes(x)));
    }
    return c.negate ? !result : result;
  };
  const matchesLogic = (issue, logic) => {
    const groups = logic?.groups || [];
    if (!groups.length) return true;
    const gr = groups.map(g => {
      const checks = (g.conditions || []).map(c => cmp(issue, c)),
        v = (g.operator || "AND") === "OR" ? checks.some(Boolean) : checks.every(Boolean);
      return g.negate ? !v : v;
    });
    return (logic.operator || "AND") === "OR" ? gr.some(Boolean) : gr.every(Boolean);
  };
  const actionMatches = (issue, action) => action?.when?.enabled ? matchesLogic(issue, action.when.logic) : true;
  const ruleScheduleActive = (profile, rule, at = new Date()) => {
    const s = rule.schedule || { mode: (rule.scheduleIds || []).length ? 'scheduled' : 'always', scheduleIds: rule.scheduleIds || [] };
    return s.mode === 'always' ? true : root.Schedule.matchesAny(profile.schedules, s.scheduleIds, at);
  };
  const activeEnabledRules = (profile, at = new Date()) => (profile?.rules || []).filter(rule => rule.enabled && ruleScheduleActive(profile, rule, at));
  const profileHasActiveEnabledRules = (profile, at = new Date()) => activeEnabledRules(profile, at).length > 0;
  const chooseAssignee = (site, a) => {
    if (a.mode === ASSIGN_MODE.UNASSIGN) return null;
    if (a.mode === ASSIGN_MODE.ME) return site.auth?.user || null;
    if (a.mode === ASSIGN_MODE.SPECIFIC) return site.users.find(u => userKey(u) === a.specificUserKey) || null;
    const keys = new Set(a.randomUserKeys || []), pool = site.users.filter(u => keys.has(userKey(u)));
    return randomChoice(pool);
  };
  const rangeFor = (rule, action) => action.delay?.mode === 'override' || action.delay?.mode === 'after-previous' ? action.delay : rule.randomDelay || { minSeconds: 0, maxSeconds: 0 };
  const delayFor = (rule, action) => {
    const range = rangeFor(rule, action),
      min = Math.max(0, Math.min(root.Constants.LIMITS.ACTION_DELAY_MAX_SECONDS, Number(range?.minSeconds) || 0)),
      max = Math.max(min, Math.min(root.Constants.LIMITS.ACTION_DELAY_MAX_SECONDS, Number(range?.maxSeconds) || min));
    return randomInt(min, max);
  };
  const buildStep = (site, profile, rule, issue, action) => {
    if (action.enabled === false || !actionMatches(issue, action)) return null;
    const payload = { actionId: action.id, ruleId: rule.id }, offsetSeconds = delayFor(rule, action);
    if (action.type === ACTION.ASSIGN) {
      if (action.mode === ASSIGN_MODE.UNASSIGN) payload.unassign = true;
      else {
        const user = chooseAssignee(site, action);
        if (!user) return null;
        payload.user = user;
      }
    }
    else if (action.type === ACTION.COMMENT) {
      const items = (action.templates || []).filter(Boolean),
        chosen = action.selection === "constant" ? items[0] : randomChoice(items);
      if (!chosen) return null;
      // Keep the original template so delayed jobs expand variables against the
      // current Jira issue immediately before execution. The rendered snapshot
      // remains useful for Action History and backwards-compatible preflight.
      payload.commentTemplate = chosen;
      payload.comment = template(chosen, issue);
    }
    else if (action.type === ACTION.TRANSITION) payload.rule = {
      transitionId: action.transitionId || "",
      transitionContext: action.transitionContext || null,
      toStatusId: action.toStatusId || "",
      manualTransitionName: action.manualTransitionName || "",
      fieldsJson: action.fieldsJson || "{}"
    };
    else if (action.type === ACTION.EDIT_FIELDS) payload.fieldsJson = action.fieldsJson || "{}";
    else if (action.type === ACTION.LABELS) payload.labels = { add: action.add || [], remove: action.remove || [] };
    else if (action.type === ACTION.PRIORITY) payload.priorityId = action.priorityId || "";
    else if (action.type === ACTION.ALARM) {
      const alarmProfiles = profile.alarmProfiles || [], selected = alarmProfiles.find(x => x.id === action.alarmProfileId) || alarmProfiles.find(x => x.id === profile.defaultAlarmProfileId) || alarmProfiles[0] || {};
      payload.alarm = { ...selected, alarmProfileId: selected.id || '' };
    }
    else if (action.type === ACTION.NOTIFICATION) payload.notification = { title: template(action.title || "SD Companion · {{issue.key}}", issue), message: template(action.message || "{{issue.summary}}", issue) };
    return { action: action.type, actionId: action.id, offsetSeconds, payload, ruleId: rule.id, reason: `Rule matched: ${rule.name}` };
  };
  const policyFingerprint = (profile, rule, issue, action) => {
    const mode = rule.executionPolicy?.mode || EXECUTION_POLICY.ONCE_ISSUE,
      base = `exec:${profile.id}:${rule.id}:r${Number(rule.revision) || 1}:${issue.key}:${action.id}`;
    if (mode === EXECUTION_POLICY.ONCE_STATUS) return `${base}:status:${issue.statusId || issue.status}`;
    if (mode === EXECUTION_POLICY.ONCE_UPDATE) return `${base}:update:${issue.updated || 'unknown'}`;
    return base;
  };
  const policyAllows = (ledger, key, rule, now) => {
    const hit = ledger[key];
    if (!hit) return true;
    if ((rule.executionPolicy?.mode || EXECUTION_POLICY.ONCE_ISSUE) !== EXECUTION_POLICY.REPEAT) return false;
    const seconds = Math.max(root.Constants.LIMITS.REPEAT_SECONDS_MIN, Number(rule.executionPolicy?.repeatSeconds) || 3600);
    return now - new Date(hit.at || 0).getTime() >= seconds * 1000;
  };
  const hourlyCount = (ledger, actionType, now) => Object.values(ledger).filter(x => x?.actionType === actionType && ['executed', 'reserved', 'queued', 'uncertain'].includes(x.status) && now - new Date(x.at || 0).getTime() < 3600000).length;
  const hourlyLimit = (safety, type) => type === ACTION.COMMENT ? safety.maxCommentsPerHour : type === ACTION.ASSIGN ? safety.maxAssignmentsPerHour : type === ACTION.TRANSITION ? safety.maxTransitionsPerHour : Infinity;
  const isLocalAlert = type => type === ACTION.ALARM || type === ACTION.NOTIFICATION;
  const localAlertTime = job => {
    if (!job) return null;
    const value = [JOB.SUCCEEDED].includes(job.status)
      ? (job.completedAt || job.startedAt || job.scheduledAt || job.createdAt)
      : (job.scheduledAt || job.startedAt || job.createdAt);
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : null;
  };
  const alertThrottleAllows = (existingJobs, plannedJobs, site, profile, rule, candidateTime) => {
    if (!rule.alertThrottle?.enabled) return true;
    const maxAlerts = Math.max(1, Math.min(root.Constants.LIMITS.ALERT_THROTTLE_MAX_ALERTS, Number(rule.alertThrottle.maxAlerts) || 1)),
      windowMinutes = Math.max(1, Math.min(root.Constants.LIMITS.ALERT_THROTTLE_WINDOW_MAX_MINUTES, Number(rule.alertThrottle.windowMinutes) || 5)),
      windowMs = windowMinutes * 60000,
      times = [...(existingJobs || []), ...(plannedJobs || [])]
        .filter(j =>
          j.siteId === site.id &&
          j.profileId === profile.id &&
          j.ruleId === rule.id &&
          isLocalAlert(j.action) &&
          ![JOB.CANCELLED, JOB.SKIPPED, JOB.FAILED].includes(j.status)
        )
        .map(localAlertTime)
        .filter(Number.isFinite);
    times.push(Number(candidateTime));
    times.sort((a, b) => a - b);
    let left = 0;
    for (let right = 0; right < times.length; right++) {
      while (times[right] - times[left] > windowMs) left++;
      if (right - left + 1 > maxAlerts) return false;
    }
    return true;
  };
  const counters = rule => {
    rule.runtime = rule.runtime || {};
    rule.runtime.counters = { cycles: 0, matches: 0, planned: 0, skippedSchedule: 0, skippedLedger: 0, skippedConflict: 0, errors: 0, ...(rule.runtime.counters || {}) };
    return rule.runtime.counters;
  };
  const randomizedActionIds = (rule, eligible) => {
    if (!rule.actionRandomness?.enabled) return new Set(eligible.map(a => a.id));
    const pools = new Map((rule.actionRandomness.pools || []).map(p => [String(p.id), p])),
      selected = new Set(),
      grouped = new Map();
    for (const a of eligible) {
      const pid = String(a.randomPoolId || '');
      if (!pid || !pools.has(pid)) {
        selected.add(a.id);
        continue;
      }
      if (!grouped.has(pid)) grouped.set(pid, []);
      grouped.get(pid).push(a);
    }
    for (const [pid, items] of grouped) {
      const count = Math.max(1, Math.min(items.length, Number(pools.get(pid)?.pickCount) || 1)),
        copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      copy.slice(0, count).forEach(a => selected.add(a.id));
    }
    return selected;
  };
  const chainPolicyFor = rule => ({ cancelled: 'continue', skipped: 'continue', failed: 'continue', ...(rule?.chainDependency || {}) });
  const stableValue = value => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value).sort()) out[k] = stableValue(value[k]);
      return out;
    }
    return value ?? null;
  };
  const actionPrecondition = (action, issue) => {
    if (!action || !issue) return {};
    if (action.type === ACTION.TRANSITION) return { statusId: String(issue.statusId || ''), statusName: String(issue.status || '') };
    if (action.type === ACTION.ASSIGN) return { assigneeKey: String(userKey(issue.assignee) || ''), assigneeName: String(issue.assignee?.displayName || issue.assignee?.name || issue.assignee?.key || 'Unassigned') };
    if (action.type === ACTION.PRIORITY) return { priorityId: String(issue.priorityId || ''), priorityName: String(issue.priority || '') };
    if (action.type === ACTION.LABELS) return { labels: (issue.labels || []).map(x => normalizeText(x).toLowerCase()).filter(Boolean).sort() };
    if (action.type === ACTION.EDIT_FIELDS) {
      let wanted = {};
      try {
        wanted = JSON.parse(template(action.fieldsJson || '{}', issue));
      } catch {}
      const fields = {};
      for (const key of Object.keys(wanted || {})) fields[key] = stableValue(issue.fields?.[key]);
      return { fields };
    }
    return {};
  };
  const skippedDependency = (action, reason, at) => ({ actionId: String(action?.id || ''), actionType: String(action?.type || ''), reason: String(reason || 'not-scheduled'), at });
  const planCycle = async (site, profile, issues, at = new Date(), { safety = null } = {}) => {
    const ledger = await root.Storage.getLedger(),
      existingJobs = root.Storage.getJobs ? await root.Storage.getJobs() : [],
      now = at.getTime(),
      plannedAt = new Date(now).toISOString(),
      plans = [],
      detections = [],
      limits = { ...root.Defaults.safety(), ...(safety || {}) },
      seenIssues = new Set(),
      plannedByType = new Map();
    for (const rule of profile.rules || []) if (rule.enabled) counters(rule).cycles++;
    for (const issue of issues) {
      if (seenIssues.size >= Math.max(1, Number(limits.maxIssuesPerCycle) || 25) && !seenIssues.has(issue.key)) break;
      const claimedGroups = new Set();
      for (const rule of (profile.rules || []).filter(r => r.enabled).sort((a, b) => (Number(a.priority) || 100) - (Number(b.priority) || 100))) {
        const c = counters(rule);
        if (issue._sourceRuleIds?.length && !issue._sourceRuleIds.includes(rule.id)) continue;
        if (!ruleScheduleActive(profile, rule, at)) {
          c.skippedSchedule++;
          continue;
        }
        if (!matchesLogic(issue, rule.logic)) continue;
        seenIssues.add(issue.key);
        c.matches++;
        c.lastMatchAt = nowIso();
        detections.push({ issueKey: issue.key, ruleId: rule.id, issue, at: nowIso() });
        const group = rule.conflict?.group?.trim();
        if (rule.conflict?.mode === CONFLICT_MODE.EXCLUSIVE && group && claimedGroups.has(group)) {
          c.skippedConflict++;
          continue;
        }
        const eligible = (rule.actions || []).filter(a => a.enabled !== false && actionMatches(issue, a)),
          selected = randomizedActionIds(rule, eligible),
          dependencyPolicy = chainPolicyFor(rule);
        let previousJob = null, skippedSincePrevious = [];
        const rememberSkip = (action, reason) => skippedSincePrevious.push(skippedDependency(action, reason, plannedAt));
        for (const action of rule.actions || []) {
          if (plans.length >= Math.max(1, Number(limits.maxActionsPerCycle) || 50)) break;
          const conditionOk = actionMatches(issue, action),
            isSelected = selected.has(action.id) && action.enabled !== false && conditionOk;
          if (!isSelected) {
            rememberSkip(action, action.enabled === false ? 'disabled' : !conditionOk ? 'condition-not-matched' : 'random-selection');
            continue;
          }
          const limit = Number(hourlyLimit(limits, action.type)),
            already = hourlyCount(ledger, action.type, now) + (plannedByType.get(action.type) || 0);
          if (Number.isFinite(limit) && already >= limit) {
            c.skippedLedger++;
            rememberSkip(action, 'hourly-limit');
            continue;
          }
          const fingerprint = policyFingerprint(profile, rule, issue, action);
          if (!policyAllows(ledger, fingerprint, rule, now)) {
            c.skippedLedger++;
            rememberSkip(action, 'execution-policy');
            continue;
          }
          const step = buildStep(site, profile, rule, issue, action);
          if (!step) {
            rememberSkip(action, 'not-applicable');
            continue;
          }
          const chained = action.delay?.mode === 'after-previous';
          if (chained && !previousJob && !skippedSincePrevious.length) {
            c.skippedLedger++;
            rememberSkip(action, 'missing-previous-action');
            continue;
          }
          const id = crypto.randomUUID(),
            previousEstimate = previousJob ? new Date(previousJob.scheduledAt || plannedAt).getTime() : now,
            estimateBase = Number.isFinite(previousEstimate) ? previousEstimate : now,
            skipBlocks = chained && skippedSincePrevious.length && dependencyPolicy.skipped === 'stop',
            scheduledMs = skipBlocks ? now : (chained ? estimateBase + step.offsetSeconds * 1000 : now + step.offsetSeconds * 1000);
          if (isLocalAlert(action.type) && !alertThrottleAllows(existingJobs, plans, site, profile, rule, scheduledMs)) {
            c.skippedLedger++;
            rememberSkip(action, 'alert-throttle');
            continue;
          }
          const job = {
            id,
            siteId: site.id,
            profileId: profile.id,
            ruleId: rule.id,
            ruleName: rule.name,
            issueKey: issue.key,
            issueSnapshot: issue,
            expectedStatusId: String(issue.statusId || ''),
            expectedStatusName: String(issue.status || ''),
            precondition: actionPrecondition(action, issue),
            manualRelativeSchedule: rule.manualProcess?.relativeSchedule === 'preserve' ? 'preserve' : 'update',
            ...step,
            ledgerKey: fingerprint,
            createdAt: nowIso(),
            scheduledAt: new Date(scheduledMs).toISOString(),
            historyOrderAt: new Date(scheduledMs).toISOString(),
            approvalRequired: Boolean(action.needsApproval),
            approvedAt: action.needsApproval ? null : plannedAt,
            status: action.needsApproval ? JOB.AWAITING_APPROVAL : JOB.PENDING,
            attempts: 0
          };
          if (chained) {
            job.dependencyDelaySeconds = step.offsetSeconds;
            job.dependencyPolicy = { ...dependencyPolicy };
            if (skippedSincePrevious.length) job.dependencySkipped = structuredClone(skippedSincePrevious);
            if (previousJob) {
              job.dependsOnJobId = previousJob.id;
              job.dependencyScheduled = false;
            }
            else {
              job.dependencyScheduled = true;
              job.dependencyResolvedAt = skippedSincePrevious.at(-1)?.at || plannedAt;
              job.dependencyResolvedStatus = 'skipped';
            }
          }
          plans.push(job);
          previousJob = job;
          skippedSincePrevious = [];
          plannedByType.set(action.type, (plannedByType.get(action.type) || 0) + 1);
          c.planned++;
        }
        if (rule.conflict?.mode === CONFLICT_MODE.EXCLUSIVE && group) claimedGroups.add(group);
        if (rule.conflict?.mode === CONFLICT_MODE.STOP_LOWER) break;
        if (plans.length >= Math.max(1, Number(limits.maxActionsPerCycle) || 50)) break;
      }
      if (plans.length >= Math.max(1, Number(limits.maxActionsPerCycle) || 50)) break;
    }
    return { plans, detections };
  };
  const planOneTime = async (site, profile, rule, issues, operationId, at = new Date(), { safety = null } = {}) => {
    const ledger = await root.Storage.getLedger(),
      existingJobs = root.Storage.getJobs ? await root.Storage.getJobs() : [],
      now = at.getTime(),
      plannedAt = new Date(now).toISOString(),
      limits = { ...root.Defaults.safety(), ...(safety || {}) },
      plans = [],
      detections = [],
      plannedByType = new Map(),
      transientRule = structuredClone(rule),
      dependencyPolicy = chainPolicyFor(rule),
      maxIssues = Math.max(1, Number(limits.maxIssuesPerCycle) || 25),
      maxActions = Math.max(1, Number(limits.maxActionsPerCycle) || 50);
    transientRule.enabled = true;
    transientRule.schedule = { mode: 'always', scheduleIds: [] };
    for (const issue of (issues || []).slice(0, maxIssues)) {
      if (!matchesLogic(issue, transientRule.logic)) continue;
      detections.push({ issueKey: issue.key, ruleId: transientRule.id, issue, at: plannedAt });
      const eligible = (transientRule.actions || []).filter(a => a.enabled !== false && actionMatches(issue, a)),
        selected = randomizedActionIds(transientRule, eligible);
      let previousJob = null, skippedSincePrevious = [];
      const rememberSkip = (action, reason) => skippedSincePrevious.push(skippedDependency(action, reason, plannedAt));
      for (const action of transientRule.actions || []) {
        if (plans.length >= maxActions) break;
        const conditionOk = actionMatches(issue, action),
          isSelected = selected.has(action.id) && action.enabled !== false && conditionOk;
        if (!isSelected) {
          rememberSkip(action, action.enabled === false ? 'disabled' : !conditionOk ? 'condition-not-matched' : 'random-selection');
          continue;
        }
        const limit = Number(hourlyLimit(limits, action.type)),
          already = hourlyCount(ledger, action.type, now) + (plannedByType.get(action.type) || 0);
        if (Number.isFinite(limit) && already >= limit) {
          rememberSkip(action, 'hourly-limit');
          continue;
        }
        const step = buildStep(site, profile, transientRule, issue, action);
        if (!step) {
          rememberSkip(action, 'not-applicable');
          continue;
        }
        const chained = action.delay?.mode === 'after-previous';
        if (chained && !previousJob && !skippedSincePrevious.length) {
          rememberSkip(action, 'missing-previous-action');
          continue;
        }
        const id = crypto.randomUUID(),
          previousEstimate = previousJob ? new Date(previousJob.scheduledAt || plannedAt).getTime() : now,
          estimateBase = Number.isFinite(previousEstimate) ? previousEstimate : now,
          skipBlocks = chained && skippedSincePrevious.length && dependencyPolicy.skipped === 'stop',
          scheduledMs = skipBlocks ? now : (chained ? estimateBase + step.offsetSeconds * 1000 : now + step.offsetSeconds * 1000),
          ledgerKey = `bulk:${profile.id}:${operationId}:${issue.key}:${action.id}`;
        if (isLocalAlert(action.type) && !alertThrottleAllows(existingJobs, plans, site, profile, transientRule, scheduledMs)) {
          rememberSkip(action, 'alert-throttle');
          continue;
        }
        const job = {
          id,
          sourceType: 'bulk-operation',
          bulkOperationId: operationId,
          ruleSnapshot: structuredClone(transientRule),
          siteId: site.id,
          profileId: profile.id,
          ruleId: transientRule.id,
          ruleName: transientRule.name || 'Bulk operation',
          issueKey: issue.key,
          issueSnapshot: issue,
          expectedStatusId: String(issue.statusId || ''),
          expectedStatusName: String(issue.status || ''),
          precondition: actionPrecondition(action, issue),
          manualRelativeSchedule: transientRule.manualProcess?.relativeSchedule === 'preserve' ? 'preserve' : 'update',
          ...step,
          ledgerKey,
          createdAt: plannedAt,
          scheduledAt: new Date(scheduledMs).toISOString(),
          historyOrderAt: new Date(scheduledMs).toISOString(),
          approvalRequired: Boolean(action.needsApproval),
          approvedAt: action.needsApproval ? null : plannedAt,
          status: action.needsApproval ? JOB.AWAITING_APPROVAL : JOB.PENDING,
          attempts: 0
        };
        if (chained) {
          job.dependencyDelaySeconds = step.offsetSeconds;
          job.dependencyPolicy = { ...dependencyPolicy };
          if (skippedSincePrevious.length) job.dependencySkipped = structuredClone(skippedSincePrevious);
          if (previousJob) {
            job.dependsOnJobId = previousJob.id;
            job.dependencyScheduled = false;
          }
          else {
            job.dependencyScheduled = true;
            job.dependencyResolvedAt = skippedSincePrevious.at(-1)?.at || plannedAt;
            job.dependencyResolvedStatus = JOB.SKIPPED;
          }
        }
        plans.push(job);
        previousJob = job;
        skippedSincePrevious = [];
        plannedByType.set(action.type, (plannedByType.get(action.type) || 0) + 1);
      }
      if (plans.length >= maxActions) break;
    }
    return { plans, detections };
  };
  const stale = message => Object.assign(new Error(message), { code: "ACTION_PRECONDITION_CHANGED" });
  const sameStable = (a, b) => JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));
  const validateAction = async (client, job, profile, { expectedStatusId = "", expectedStatusName = "", expectedPrecondition = null, skipSchedule = false } = {}) => {
    const bulkOperation = job.sourceType === 'bulk-operation',
      rule = bulkOperation ? job.ruleSnapshot : (profile.rules || []).find(r => r.id === job.ruleId);
    if (!rule || (!bulkOperation && !rule.enabled)) throw new Error(bulkOperation ? "Bulk operation definition is unavailable." : "Rule was removed or disabled.");
    if (!bulkOperation && !skipSchedule && !ruleScheduleActive(profile, rule, new Date())) throw stale("Schedule is no longer active.");
    const action = (rule.actions || []).find(a => a.id === job.actionId);
    if (!action || action.enabled === false) throw new Error("Action was removed or disabled.");
    const raw = await client.issue(job.issueKey, "names,schema"),
      issue = root.Discovery.normalizeIssue(raw, job.issueSnapshot?.filterId),
      planned = expectedPrecondition && typeof expectedPrecondition === 'object' ? expectedPrecondition : (job.precondition && typeof job.precondition === 'object' ? job.precondition : actionPrecondition(action, job.issueSnapshot || {}));
    if (action.when?.enabled && !actionMatches(issue, action)) throw stale("Action conditions no longer match.");
    if (action.type === ACTION.TRANSITION) {
      const wantedId = String(expectedStatusId || planned.statusId || job.expectedStatusId || ''),
        wantedName = normalizeText(expectedStatusName || planned.statusName || job.expectedStatusName || '');
      if (wantedId && String(issue.statusId || '') !== wantedId) throw stale(`Status changed: ${wantedName || 'expected'} → ${issue.status || 'unknown'}.`);
      if (!wantedId && wantedName && normalizeText(issue.status || '').toLowerCase() !== wantedName.toLowerCase()) throw stale(`Status changed: ${wantedName} → ${issue.status || 'unknown'}.`);
    }
    else if (action.type === ACTION.ASSIGN) {
      const before = String(planned.assigneeKey ?? userKey(job.issueSnapshot?.assignee) ?? ''),
        now = String(userKey(issue.assignee) || '');
      if (before !== now) throw stale(`Assignee changed: ${planned.assigneeName || job.issueSnapshot?.assignee?.displayName || 'Unassigned'} → ${issue.assignee?.displayName || issue.assignee?.name || 'Unassigned'}.`);
    }
    else if (action.type === ACTION.PRIORITY) {
      const before = String(planned.priorityId ?? job.issueSnapshot?.priorityId ?? ''),
        now = String(issue.priorityId || '');
      if (before !== now) throw stale(`Priority changed: ${planned.priorityName || job.issueSnapshot?.priority || 'none'} → ${issue.priority || 'none'}.`);
    }
    else if (action.type === ACTION.LABELS) {
      const before = Array.isArray(planned.labels) ? planned.labels : (job.issueSnapshot?.labels || []).map(x => normalizeText(x).toLowerCase()).filter(Boolean).sort(),
        now = (issue.labels || []).map(x => normalizeText(x).toLowerCase()).filter(Boolean).sort();
      if (!sameStable(before, now)) throw stale("Labels changed before execution.");
    }
    else if (action.type === ACTION.EDIT_FIELDS) {
      const fields = planned.fields && typeof planned.fields === 'object' ? planned.fields : {};
      for (const [key, value] of Object.entries(fields)) if (!sameStable(value, issue.fields?.[key])) throw stale(`Field ${key} changed before execution.`);
    }
    return issue;
  };
  const requiredIssueFields = rule => {
    const base = ["summary", "description", "issuetype", "status", "assignee", "reporter", "creator", "project", "priority", "created", "updated", "labels", "components", "resolution", "duedate"],
      aliases = new Set(["project", "issueType", "status", "assignee", "reporter", "priority", "resolution", "label", "summary", "description", "component", "createdAgeMinutes", "updatedAgeMinutes"]),
      all = [...(rule?.logic?.groups || []).flatMap(g => g.conditions || []), ...(rule?.actions || []).filter(a => a.when?.enabled).flatMap(a => (a.when.logic?.groups || []).flatMap(g => g.conditions || []))],
      variableSources = [];
    for (const c of all) if (c?.field && !aliases.has(c.field)) base.push(c.field);
    for (const action of rule?.actions || []) {
      if (action.type === ACTION.COMMENT) variableSources.push(...(action.templates || []));
      if (action.type === ACTION.EDIT_FIELDS || action.type === ACTION.TRANSITION) variableSources.push(action.fieldsJson || "");
    }
    for (const source of variableSources) {
      const text = String(source || "");
      for (const match of text.matchAll(/\{\{\s*issue\.fields\.([A-Za-z0-9_:-]+)(?:\.[^}]*)?\s*\}\}/g)) base.push(match[1]);
    }
    return [...new Set(base)];
  };
  root.RuleEngine = Object.freeze({ planCycle, planOneTime, validateAction, matchesLogic, actionMatches, valuesFor, ruleScheduleActive, activeEnabledRules, profileHasActiveEnabledRules, policyFingerprint, delayFor, requiredIssueFields, actionPrecondition });
})();
