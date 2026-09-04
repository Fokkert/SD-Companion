(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const { DISPLAY_VERSION, THEME, ASSIGN_MODE, ACTION, EXECUTION_POLICY, CONFLICT_MODE, TRANSITION_METHOD } = root.Constants,
    { normalizeBaseUrl, siteIdFromBaseUrl, nowIso } = root.Utils;
  const projectDatasets = (enabled = false) => ({ users: Boolean(enabled), fields: Boolean(enabled), issueTypes: Boolean(enabled), statuses: Boolean(enabled), transitions: Boolean(enabled) });
  const inventorySettings = () => ({
    maxUsers: 20000,
    buildTransitionCatalog: true,
    transitionMethod: TRANSITION_METHOD.WORKFLOW_DESIGNER,
    selectedProjectKeys: [],
    projectDatasets: {},
    globalDatasets: { priorities: true, resolutions: true },
    scopeRevision: 0,
    autoSync: { enabled: false, intervalSeconds: 3600, unit: "hours", lastRunAt: null, nextRunAt: null }
  });
  const requestPolicy = () => ({
    spacingMs: 350,
    jitterPercent: 15,
    timeoutMs: 30000,
    retries: 2,
    healthIntervalSeconds: 300,
    healthIntervalUnit: "minutes",
    maxRequestsPerMinute: 120,
    maxConcurrent: 1,
    backoffMaxSeconds: 60,
    backoffUnit: "seconds"
  });
  const safety = () => ({ maxIssuesPerCycle: 25, maxActionsPerCycle: 50, maxCommentsPerHour: 20, maxAssignmentsPerHour: 50, maxTransitionsPerHour: 50 });
  const site = (d = {}) => {
    const baseUrl = normalizeBaseUrl(d.baseUrl || "");
    return {
      id: d.id || siteIdFromBaseUrl(baseUrl),
      name: d.name || (baseUrl ? new URL(baseUrl).host : "Jira Server"),
      baseUrl,
      createdAt: d.createdAt || nowIso(),
      activeProfileId: d.activeProfileId || "",
      icon: { mode: "auto", preset: "emerald", url: baseUrl ? `${baseUrl}/favicon.ico` : "", ...(d.icon || {}) },
      behavior: {
        autoRefreshJiraTabsOnDetection: false,
        focusJiraTabOnDetection: false,
        connectionLossAlarm: { enabled: true, trigger: 'either', durationSeconds: 300, durationUnit: 'minutes', failedChecks: 5 },
        ...(d.behavior || {}),
        connectionLossAlarm: { enabled: true, trigger: 'either', durationSeconds: 300, durationUnit: 'minutes', failedChecks: 5, ...(d.behavior?.connectionLossAlarm || {}) }
      },
      auth: { type: "pat", persistence: "local", configured: false, lastValidatedAt: null, user: null, ...(d.auth || {}), token: undefined },
      server: { deploymentType: "Data Center / Server", version: "", serverTitle: "", ...(d.server || {}) },
      capabilities: {
        restApi2: false,
        serverInfo: false,
        permissions: false,
        projects: false,
        projectSearch: false,
        filters: false,
        filterMine: false,
        filterSearch: false,
        favouriteFilters: false,
        projectStatuses: false,
        projectCreateMeta: false,
        assignableUsers: false,
        fields: false,
        priorities: false,
        resolutions: false,
        transitions: false,
        workflowBrowseName: false,
        workflowDesigner: false,
        ...(d.capabilities || {})
      },
      network: { requestPolicy: { ...requestPolicy(), ...(d.network?.requestPolicy || {}) } },
      inventorySettings: { ...inventorySettings(), ...(d.inventorySettings || {}), autoSync: { ...inventorySettings().autoSync, ...(d.inventorySettings?.autoSync || {}) } },
      filters: d.filters || [],
      projects: d.projects || [],
      users: d.users || [],
      issueTypes: d.issueTypes || [],
      statuses: d.statuses || [],
      fields: d.fields || [],
      priorities: d.priorities || [],
      resolutions: d.resolutions || [],
      components: [],
      versions: [],
      projectRoles: [],
      projectStatusMatrix: d.projectStatusMatrix || [],
      transitionCatalog: d.transitionCatalog || [],
      issues: [],
      permissions: d.permissions || {},
      inventory: { lastFullSyncAt: null, lastProjectSyncAt: null, snapshotId: "", scopeHash: "", filterCoverage: "unknown", filterCoverageNote: "", warnings: [], counts: {}, freshness: {}, ...(d.inventory || {}) },
      runtime: {
        connectionStatus: "not-configured",
        healthState: "unknown",
        lastError: "",
        lastSyncAt: null,
        lastCycleAt: null,
        lastIssueCount: 0,
        tabOpen: false,
        tabCount: 0,
        tabUrls: [],
        apiHealthy: false,
        lastHealthAt: null,
        radarEvents: [],
        radarMarkers: [],
        apiStats: { requests: 0, failures: 0, retries: 0, rateLimited: 0, avgLatencyMs: 0, maxLatencyMs: 0, lastRequestAt: null },
        connectionLossStartedAt: null,
        connectionLossFailures: 0,
        connectionLossAlarmFiredAt: null,
        ...(d.runtime || {})
      }
    };
  };
  const schedule = (name = "Schedule") => ({
    id: crypto.randomUUID(),
    name,
    enabled: true,
    days: [1, 2, 3, 4, 5],
    startTime: "08:00:00",
    endTime: "17:00:00",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    startDate: "",
    endDate: ""
  });
  const condition = (field = "project") => ({ id: crypto.randomUUID(), field, operator: "is-any-of", values: [], value: "", negate: false });
  const group = () => ({ id: crypto.randomUUID(), operator: "AND", negate: false, conditions: [condition()] });
  const action = (type = ACTION.ASSIGN) => {
    const base = {
      id: crypto.randomUUID(),
      type,
      enabled: true,
      needsApproval: false,
      delay: { mode: "inherit", minSeconds: 2, maxSeconds: 12, unit: "seconds" },
      when: { enabled: false, logic: { operator: "AND", groups: [group()] } },
      randomPoolId: ""
    };
    if (type === ACTION.ASSIGN) return { ...base, mode: ASSIGN_MODE.ME, specificUserKey: "", randomUserKeys: [] };
    if (type === ACTION.COMMENT) return { ...base, selection: "random", templates: [], variablesEnabled: true };
    if (type === ACTION.TRANSITION) return { ...base, transitionId: "", transitionContext: null, toStatusId: "", manualTransitionName: "", fieldsJson: "{}" };
    if (type === ACTION.EDIT_FIELDS) return { ...base, fieldsJson: "{}" };
    if (type === ACTION.LABELS) return { ...base, add: [], remove: [] };
    if (type === ACTION.PRIORITY) return { ...base, priorityId: "" };
    if (type === ACTION.ALARM) return { ...base };
    if (type === ACTION.NOTIFICATION) return { ...base, title: "SD Companion · {{issue.key}}", message: "{{issue.summary}}" };
    return base;
  };
  const rule = (name = "New rule") => ({
    id: crypto.randomUUID(),
    name,
    enabled: false,
    priority: 100,
    schedule: { mode: "always", scheduleIds: [] },
    source: { filterIds: [], jql: "" },
    logic: { operator: "AND", groups: [group()] },
    executionPolicy: { mode: EXECUTION_POLICY.ONCE_ISSUE, repeatSeconds: 3600, repeatUnit: "minutes" },
    conflict: { mode: CONFLICT_MODE.CONTINUE, group: "" },
    polling: { cursorOverlapSeconds: 600, cursorOverlapUnit: "minutes" },
    randomDelay: { minSeconds: 2, maxSeconds: 12, unit: "seconds" },
    chainDependency: { cancelled: "continue", skipped: "continue", failed: "continue" },
    manualProcess: { relativeSchedule: "update" },
    alertThrottle: { enabled: false, maxAlerts: 1, windowMinutes: 5 },
    actionRandomness: { enabled: false, pools: [] },
    actions: [],
    runtime: { counters: { cycles: 0, matches: 0, planned: 0, skippedSchedule: 0, skippedLedger: 0, skippedConflict: 0, errors: 0 }, lastRunAt: null, lastMatchAt: null }
  });
  const profile = (name = "Default Profile", boundSite = null) => ({
    id: crypto.randomUUID(),
    siteId: boundSite?.id || "",
    name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    monitoring: { enabled: false, intervalSeconds: 60, intervalUnit: "minutes", pollJitterPercent: 10 },
    schedules: [],
    rules: [],
    alarmDefaults: {
      preset: "radar",
      useCustom: false,
      customDataUrl: "",
      customName: "",
      durationSeconds: 12,
      durationUnit: "seconds",
      volume: 0.8,
      loop: true,
      stopMethod: "duration-or-controls",
      showSystemNotification: true,
      showPagePopup: true
    },
    radar: { enabled: true, maxMarkers: 12, retentionMinutes: 45 },
    runtime: { lastCycleAt: null, nextCycleAt: null, lastIssueCount: 0, lastDetectionCount: 0, lastPlanCount: 0, currentDetections: [], currentDetectionsAt: null, lastDetectionKeys: [] }
  });
  const state = () => {
    const p = profile();
    return {
      schemaVersion: root.Constants.SCHEMA_VERSION,
      appVersion: DISPLAY_VERSION,
      configRevision: 1,
      activeSiteId: "",
      activeProfileId: p.id,
      jiraSites: [],
      profiles: [p],
      appearance: { theme: THEME.EMERALD, openTarget: "popup", glassStrength: 0.82 },
      system: { logLevel: "info", safety: safety(), activityRefreshSeconds: 3, activityRefreshUnit: "seconds", completionToneEnabled: true },
      runtime: { lastHeartbeatAt: null, activeAlarm: { active: false, startedAt: null, issueKey: "", ruleName: "", source: "", stopMethod: "", preset: "", repeatCount: 0 } }
    };
  };
  root.Defaults = Object.freeze({ site, profile, state, schedule, condition, group, action, rule, projectDatasets, inventorySettings, requestPolicy, safety });
})();
