(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { MESSAGE, ACTION, JOB, LIMITS: L, TRANSITION_METHOD } = SD.Constants,
    R = SD.ConditionRegistry;
  const activeRule = () => A.page === 'bulk' ? A.ensureBulkDraft?.() : (A.ruleDraft && A.ruleDraft.id === A.selectedRuleId ? A.ruleDraft : A.profile()?.rules?.find(r => r.id === A.selectedRuleId)),
    activeSchedule = () => A.scheduleDraft && A.scheduleDraft.id === A.selectedScheduleId ? A.scheduleDraft : A.profile()?.schedules?.find(s => s.id === A.selectedScheduleId);
  const setPath = (obj, path, value) => {
    const parts = path.split('.');
    let x = obj;
    for (const k of parts.slice(0, -1)) {
      if (!x[k] || typeof x[k] !== 'object') x[k] = {};
      x = x[k];
    }
    x[parts.at(-1)] = value;
  };
  const typed = (el, v = el.value) => el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(v) : v;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v)));
  const touchRule = r => {
    if (!r) return;
    r.revision = (Number(r.revision) || 1) + 1;
    r.updatedAt = new Date().toISOString();
  };
  const transitionMatchesAction = (t, a) => {
    if (String(t.id) !== String(a.transitionId)) return false;
    const c = a.transitionContext;
    if (!c) return true;
    return String(c.projectKey || '') === String(t.projectKey || '') && String(c.issueTypeId || '') === String(t.issueTypeId || '') && String(c.fromStatusId || '') === String(t.fromStatusId || '') && String(c.toStatusId || '') === String(t.toStatusId || '');
  };
  const normalizeRuleConditions = (r, s) => {
    for (const g of r?.logic?.groups || []) for (const c of g.conditions || []) R.normalizeCondition?.(c, s);
    for (const a of r?.actions || []) if (a.when?.enabled) for (const g of a.when.logic?.groups || []) for (const c of g.conditions || []) R.normalizeCondition?.(c, s);
  };
  const saveRule = async (r, render = true) => {
    const s = A.site();
    normalizeRuleConditions(r, s);
    const method = A.RuleViews?.transitionMethod?.(s) || TRANSITION_METHOD.WORKFLOW_DESIGNER;
    if (s && (method === TRANSITION_METHOD.WORKFLOW_DESIGNER || method === TRANSITION_METHOD.ISSUE_EXTRACTION)) {
      for (const a of r?.actions || []) {
        if (a.type !== ACTION.TRANSITION || !a.transitionId) continue;
        const choices = A.RuleViews?.transitionChoices?.(s, r, a) || [],
          matches = choices.filter(t => String(t.id) === String(a.transitionId));
        if (a.transitionContext && !matches.some(t => transitionMatchesAction(t, a))) {
          a.transitionId = '';
          a.transitionContext = null;
        }
        else if (!a.transitionContext && matches.length === 1) {
          const t = matches[0];
          a.transitionContext = { projectKey: t.projectKey || '', issueTypeId: String(t.issueTypeId || ''), fromStatusId: String(t.fromStatusId || ''), toStatusId: String(t.toStatusId || ''), transitionName: t.name || '' };
        }
        else if (!a.transitionContext && matches.length > 1) {
          a.transitionId = '';
          a.transitionContext = null;
        }
      }
    }
    else if (s && method === TRANSITION_METHOD.TARGET_STATUS_RANDOM) {
      for (const a of r?.actions || []) {
        if (a.type !== ACTION.TRANSITION || !a.toStatusId) continue;
        const states = A.RuleViews?.targetStatusChoices?.(s, r, a) || [];
        if (!states.some(x => String(x.id) === String(a.toStatusId))) a.toStatusId = '';
      }
    }
    if (render) A.renderPage();
    return r;
  };
  const findCond = id => {
    for (const g of activeRule()?.logic?.groups || []) {
      const c = g.conditions?.find(x => x.id === id);
      if (c) return c;
    }
    return null;
  };
  const findAction = id => activeRule()?.actions?.find(x => x.id === id);
  const findActionCond = (actionId, id) => {
    const a = findAction(actionId);
    for (const g of a?.when?.logic?.groups || []) {
      const c = g.conditions?.find(x => x.id === id);
      if (c) return c;
    }
    return null;
  };
  const renewLogicIds = logic => {
    for (const g of logic?.groups || []) {
      g.id = crypto.randomUUID();
      for (const c of g.conditions || []) c.id = crypto.randomUUID();
    }
    return logic;
  };
  const duplicateRuleObject = stored => {
    const copy = structuredClone(stored), poolMap = new Map(), now = new Date().toISOString();
    copy.id = crypto.randomUUID();
    copy.name = String(`${stored.name || 'Rule'} Copy`).slice(0, 100);
    copy.enabled = false;
    copy.revision = 1;
    copy.createdAt = now;
    copy.updatedAt = now;
    renewLogicIds(copy.logic);
    for (const pool of copy.actionRandomness?.pools || []) {
      const old = pool.id, pid = crypto.randomUUID();
      pool.id = pid;
      poolMap.set(old, pid);
    }
    for (const a of copy.actions || []) {
      a.id = crypto.randomUUID();
      if (a.randomPoolId) a.randomPoolId = poolMap.get(a.randomPoolId) || '';
      if (a.when?.logic) renewLogicIds(a.when.logic);
    }
    copy.runtime = SD.Defaults.rule(copy.name).runtime;
    return copy;
  };

  const nextProfileCopyName = (stored, profiles) => {
    const source = String(stored?.name || 'Profile').trim() || 'Profile',
      names = new Set((profiles || []).map(x => String(x.name || '').trim().toLowerCase()));
    let candidate = `${source} Copy`.slice(0, 80), index = 2;
    while (names.has(candidate.toLowerCase())) {
      const suffix = ` Copy ${index++}`;
      candidate = `${source.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
    }
    return candidate;
  };
  const duplicateProfileObject = (stored, allProfiles) => {
    const copy = structuredClone(stored),
      now = new Date().toISOString(),
      scheduleMap = new Map();
    copy.id = crypto.randomUUID();
    copy.name = nextProfileCopyName(stored, (allProfiles || []).filter(x => x.siteId === stored.siteId));
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.monitoring = { ...(copy.monitoring || {}), enabled: false };
    copy.runtime = structuredClone(SD.Defaults.profile(copy.name, { id: copy.siteId }).runtime);
    const alarmProfileMap = new Map();
    for (const alarmProfile of copy.alarmProfiles || []) { const oldId=alarmProfile.id; alarmProfile.id=crypto.randomUUID(); alarmProfileMap.set(oldId,alarmProfile.id); }
    copy.defaultAlarmProfileId = alarmProfileMap.get(copy.defaultAlarmProfileId) || copy.alarmProfiles?.[0]?.id || '';

    for (const schedule of copy.schedules || []) {
      const previousId = schedule.id;
      schedule.id = crypto.randomUUID();
      scheduleMap.set(previousId, schedule.id);
    }

    for (const rule of copy.rules || []) {
      const poolMap = new Map();
      rule.id = crypto.randomUUID();
      rule.revision = 1;
      rule.createdAt = now;
      rule.updatedAt = now;
      if (rule.schedule?.mode === 'scheduled') {
        rule.schedule.scheduleIds = (rule.schedule.scheduleIds || []).map(id => scheduleMap.get(id)).filter(Boolean);
      }
      renewLogicIds(rule.logic);
      for (const pool of rule.actionRandomness?.pools || []) {
        const previousId = pool.id;
        pool.id = crypto.randomUUID();
        poolMap.set(previousId, pool.id);
      }
      for (const action of rule.actions || []) {
        action.id = crypto.randomUUID();
        if (action.randomPoolId) action.randomPoolId = poolMap.get(action.randomPoolId) || '';
        if (action.alarmProfileId) action.alarmProfileId = alarmProfileMap.get(action.alarmProfileId) || copy.defaultAlarmProfileId;
        if (action.when?.logic) renewLogicIds(action.when.logic);
      }
      rule.runtime = structuredClone(SD.Defaults.rule(rule.name).runtime);
    }
    return copy;
  };
  const updateRangeOutput = el => {
    const key = el.dataset.rangeKey;
    if (!key) return;
    const target = document.querySelector(`[data-range-output="${CSS.escape(key)}"]`) || A.$(key === 'alarm-volume' ? 'alarmVolumeValue' : '');
    if (target) target.textContent = `${Math.round(Number(el.value) * 100)}%`;
  };
  const seconds = (value, unit, min, max) => clamp(SD.Utils.timeToSeconds(value, unit), min, max);
  const reorderGlassMulti = (group, q = '') => {
    if (!group) return;
    const query = String(q || '').trim().toLowerCase(),
      choices = [...group.querySelectorAll('.glass-choice')];
    for (const choice of choices) {
      const label = choice.querySelector('.glass-choice-label')?.textContent || '',
        matches = !query || label.toLowerCase().includes(query);
      choice.hidden = !matches;
    }
    choices.sort((a, b) => {
      const av = !a.hidden && a.classList.contains('selected'),
        bv = !b.hidden && b.classList.contains('selected');
      if (av !== bv) return bv - av;
      if (a.hidden !== b.hidden) return Number(a.hidden) - Number(b.hidden);
      return Number(a.dataset.choiceOrder || 0) - Number(b.dataset.choiceOrder || 0);
    });
    for (const choice of choices) group.appendChild(choice);
  };
  const applyGlassMultiSearch = el => {
    const wrap = el?.closest?.('.glass-multi-wrap'), group = wrap?.querySelector?.('.glass-multi');
    reorderGlassMulti(group, el?.value || '');
  };
  const alarmConfigFromControls = () => {
    const p = A.profile(),
      settingsAlarm = A.page === 'settings' ? A.ensureSettingsDraft?.()?.alarm : null,
      base = { ...(settingsAlarm || A.ensureAlarmDraft?.() || {}) },
      preset = A.$('alarmPreset'),
      duration = A.$('alarmDuration'),
      du = A.$('alarmDurationUnit'),
      volume = A.$('alarmVolume'),
      loop = A.$('alarmLoop'),
      custom = A.$('alarmUseCustom'),
      stop = A.$('alarmStopMethod'),
      shortcut = A.$('alarmKeyboardShortcut');
    if (preset) base.preset = preset.value;
    base.id = A.alarmProfileDraftId || base.id || crypto.randomUUID();
    if (A.$('alarmProfileName')) base.name = A.$('alarmProfileName').value.trim() || 'Alarm Profile';
    if (du) base.durationUnit = du.value;
    if (duration) base.durationSeconds = seconds(duration.value, base.durationUnit || 'seconds', 1, 86400);
    if (volume) base.volume = clamp(volume.value, 0, 1);
    if (loop) base.loop = loop.checked;
    if (custom) base.useCustom = custom.checked;
    if (stop) base.stopMethod = stop.value;
    if (shortcut) base.keyboardShortcut = shortcut.value.trim();
    return base;
  };
  const storeAlarmDraft = cfg => {
    const p = A.profile();
    if (A.page === 'settings' && A.ensureSettingsDraft) {
      const d = A.ensureSettingsDraft();
      d.alarm = { ...cfg };
    }
    A.alarmDraft = { profileId: p?.id || '', alarmProfileId: cfg.id || A.alarmProfileDraftId || '', config: { ...cfg } };
    return A.alarmDraft.config;
  };
  const alarmTestMeta = () => {
    const s = A.site(), p = A.profile();
    return { siteId: s?.id || '', profileId: p?.id || '', source: 'Alarm Settings Test', ruleName: 'Alarm Settings', summary: 'Test alarm' };
  };
  const commitSettingsDraft = async ({ system, siteId = '', profileId = '', autoSync = null, alarm = null, openTarget = 'popup' }) => {
    // Use the long-standing GET_STATE/SAVE_STATE contract so an updated UI can
    // safely save even while Chrome is still running a previous service worker.
    // SAVE_STATE is revision-checked and commits the staged settings atomically.
    const latestResponse = await A.send(MESSAGE.GET_STATE),
      latest = structuredClone(latestResponse.state),
      normalizedTarget = openTarget === 'sidepanel' ? 'sidepanel' : 'popup';
    latest.system = { ...latest.system, ...system, safety: system.safety ? { ...(latest.system?.safety || {}), ...system.safety } : latest.system?.safety };
    latest.appearance = { ...(latest.appearance || {}), openTarget: normalizedTarget };
    if (autoSync && siteId) {
      const site = latest.jiraSites?.find(x => x.id === siteId);
      if (!site) throw new Error('Server not found.');
      site.inventorySettings = site.inventorySettings || SD.Defaults.inventorySettings();
      site.inventorySettings.autoSync = { ...(site.inventorySettings.autoSync || {}), ...autoSync };
    }
    if (alarm && profileId) {
      const profile = latest.profiles?.find(x => x.id === profileId);
      if (!profile) throw new Error('Profile not found.');
      profile.alarmProfiles = Array.isArray(profile.alarmProfiles) ? profile.alarmProfiles : [];
      const i = profile.alarmProfiles.findIndex(x => x.id === alarm.id);
      if (i >= 0) profile.alarmProfiles[i] = { ...profile.alarmProfiles[i], ...alarm };
      else profile.alarmProfiles.push({ ...alarm, id: alarm.id || crypto.randomUUID(), name: alarm.name || 'Alarm Profile' });
      if (!profile.defaultAlarmProfileId) profile.defaultAlarmProfileId = profile.alarmProfiles[0]?.id || '';
    }
    const saved = await A.send(MESSAGE.SAVE_STATE, { state: latest, baseRevision: latest.configRevision, validationScope: 'none' }),
      targetResult = await A.send(MESSAGE.SET_OPEN_TARGET, { openTarget: normalizedTarget });
    return targetResult.state || saved.state;
  };
  const validateServerInputs = () => {
    const hu = A.$('healthIntervalUnit')?.value || 'minutes',
      bu = A.$('backoffUnit')?.value || 'seconds',
      rp = {
        spacingMs: clamp(A.$('requestSpacing').value, L.REQUEST_SPACING_MIN_MS, L.REQUEST_SPACING_MAX_MS),
        jitterPercent: clamp(A.$('requestJitter').value, 0, L.REQUEST_JITTER_MAX),
        timeoutMs: clamp(A.$('requestTimeout').value, L.REQUEST_TIMEOUT_MIN_MS, L.REQUEST_TIMEOUT_MAX_MS),
        retries: clamp(A.$('requestRetries').value, 0, L.REQUEST_RETRIES_MAX),
        healthIntervalSeconds: seconds(A.$('healthInterval').value, hu, L.HEALTH_MIN_SECONDS, L.HEALTH_MAX_SECONDS),
        healthIntervalUnit: hu,
        maxRequestsPerMinute: clamp(A.$('requestMaxPerMinute').value, L.REQUESTS_PER_MINUTE_MIN, L.REQUESTS_PER_MINUTE_MAX),
        maxConcurrent: clamp(A.$('requestConcurrency').value, L.CONCURRENCY_MIN, L.CONCURRENCY_MAX),
        backoffMaxSeconds: seconds(A.$('backoffMax').value, bu, L.BACKOFF_MIN_SECONDS, L.BACKOFF_MAX_SECONDS),
        backoffUnit: bu
      };
    const errs = SD.Validators.validateRequestPolicy(rp);
    if (errs.length) throw new Error(errs[0]);
    return rp;
  };
  const pageButton = target => {
    if (!target?.closest) return false;
    const b = target.closest('[data-page]');
    if (b) {
      if (A.page === 'settings' && b.dataset.page !== 'settings') {
        A.settingsBackTarget = {
          section: A.settingsSection || 'general',
          automationSection: A.settingsAutomationSection || 'sync'
        };
      }
      else if (b.dataset.page === 'settings') {
        A.settingsBackTarget = null;
      }
      A.setPage(b.dataset.page);
      return true;
    }
    const n = target.closest('[data-nav]');
    if (n) {
      A.settingsBackTarget = null;
      A.setPage(n.dataset.nav);
      return true;
    }
    return false;
  };
  const applyRuleTime = (el) => {
    const r = activeRule();
    if (!r) return false;
    const key = el.dataset.ruleTime;
    if (!key) return false;
    if (key === 'execution-repeat') r.executionPolicy.repeatSeconds = seconds(el.value, r.executionPolicy.repeatUnit || 'minutes', L.REPEAT_SECONDS_MIN, L.REPEAT_SECONDS_MAX);
    else if (key === 'cursor-overlap') r.polling.cursorOverlapSeconds = seconds(el.value, r.polling.cursorOverlapUnit || 'minutes', L.CURSOR_OVERLAP_MIN_SECONDS, L.CURSOR_OVERLAP_MAX_SECONDS);
    else if (key === 'delay-min') r.randomDelay.minSeconds = seconds(el.value, r.randomDelay.unit || 'seconds', 0, L.ACTION_DELAY_MAX_SECONDS);
    else if (key === 'delay-max') r.randomDelay.maxSeconds = seconds(el.value, r.randomDelay.unit || 'seconds', 0, L.ACTION_DELAY_MAX_SECONDS);
    return true;
  };
  const applyRuleTimeUnit = (el) => {
    const r = activeRule();
    if (!r) return false;
    const key = el.dataset.ruleTimeUnit;
    if (!key) return false;
    const u = el.value;
    if (key === 'execution-repeat') {
      const v = document.querySelector('[data-rule-time="execution-repeat"]')?.value;
      r.executionPolicy.repeatUnit = u;
      if (v !== undefined) r.executionPolicy.repeatSeconds = seconds(v, u, L.REPEAT_SECONDS_MIN, L.REPEAT_SECONDS_MAX);
    }
    else if (key === 'cursor-overlap') {
      const v = document.querySelector('[data-rule-time="cursor-overlap"]')?.value;
      r.polling.cursorOverlapUnit = u;
      if (v !== undefined) r.polling.cursorOverlapSeconds = seconds(v, u, L.CURSOR_OVERLAP_MIN_SECONDS, L.CURSOR_OVERLAP_MAX_SECONDS);
    }
    else if (key === 'delay') {
      const mn = document.querySelector('[data-rule-time="delay-min"]')?.value,
        mx = document.querySelector('[data-rule-time="delay-max"]')?.value;
      r.randomDelay.unit = u;
      if (mn !== undefined) r.randomDelay.minSeconds = seconds(mn, u, 0, L.ACTION_DELAY_MAX_SECONDS);
      if (mx !== undefined) r.randomDelay.maxSeconds = seconds(mx, u, 0, L.ACTION_DELAY_MAX_SECONDS);
    }
    return true;
  };
  const applyActionTime = (el) => {
    const a = findAction(el.dataset.actionId);
    if (!a) return false;
    const key = el.dataset.actionTime;
    if (!key) return false;
    if (key === 'delay-min') a.delay.minSeconds = seconds(el.value, a.delay.unit || 'seconds', 0, L.ACTION_DELAY_MAX_SECONDS);
    else if (key === 'delay-max') a.delay.maxSeconds = seconds(el.value, a.delay.unit || 'seconds', 0, L.ACTION_DELAY_MAX_SECONDS);
    else if (key === 'alarm-duration') a.durationSeconds = seconds(el.value, a.durationUnit || 'seconds', 1, 86400);
    return true;
  };
  const applyActionTimeUnit = (el) => {
    const a = findAction(el.dataset.actionId);
    if (!a) return false;
    const key = el.dataset.actionTimeUnit;
    if (!key) return false;
    const u = el.value, card = el.closest('.action-card');
    if (key === 'delay') {
      const mn = card?.querySelector('[data-action-time="delay-min"]')?.value,
        mx = card?.querySelector('[data-action-time="delay-max"]')?.value;
      a.delay.unit = u;
      if (mn !== undefined) a.delay.minSeconds = seconds(mn, u, 0, L.ACTION_DELAY_MAX_SECONDS);
      if (mx !== undefined) a.delay.maxSeconds = seconds(mx, u, 0, L.ACTION_DELAY_MAX_SECONDS);
    }
    else if (key === 'alarm-duration') {
      const v = card?.querySelector('[data-action-time="alarm-duration"]')?.value;
      a.durationUnit = u;
      if (v !== undefined) a.durationSeconds = seconds(v, u, 1, 86400);
    }
    return true;
  };
  A.bindEvents = () => {
    document.addEventListener('input', e => {
      const el = e.target;
      if (el.matches?.('input[type="range"]')) updateRangeOutput(el);
      if (el.matches?.('.glass-multi-search')) applyGlassMultiSearch(el);
      if (['alarmVolume', 'alarmDuration'].includes(el.id)) storeAlarmDraft(alarmConfigFromControls());
      if (el.id === 'alarmVolume' && A.state?.runtime?.activeAlarm?.active) {
        A.send(MESSAGE.UPDATE_ALARM_VOLUME, { volume: Number(el.value) }).catch(() => {});
      }
      if (el.id === 'inventorySearch') {
        A.inventorySearch = el.value;
        clearTimeout(A.inventoryTimer);
        A.inventoryTimer = setTimeout(() => A.refreshInventorySearchDom?.(), 80);
      }
      if (el.dataset.settingsProp) {
        setPath(A.ensureSettingsDraft(), el.dataset.settingsProp, typed(el));
      }
      if (el.dataset.ruleProp && ['input', 'textarea'].includes(el.tagName?.toLowerCase())) {
        const r = activeRule();
        if (r) setPath(r, el.dataset.ruleProp, typed(el));
      }
      if (el.dataset.scheduleProp && ['input', 'textarea'].includes(el.tagName?.toLowerCase())) {
        const sc = activeSchedule();
        if (sc) setPath(sc, el.dataset.scheduleProp, typed(el));
      }
      if (el.dataset.commentTemplateIndex !== undefined) {
        const a = findAction(el.dataset.actionId), i = Number(el.dataset.commentTemplateIndex);
        if (a && Number.isInteger(i)) {
          a.templates = a.templates || [];
          a.templates[i] = el.value;
        }
      }
    });
    document.addEventListener('keydown', e => {
      const el = e.target;
      if (e.key === 'Enter' && el?.id === 'securityUnlockInput') {
        e.preventDefault();
        A.unlockExtension?.();
        return;
      }
      if (e.key === 'Enter' && el?.id === 'securityReauthInput') {
        e.preventDefault();
        A.confirmSecurityReauth?.();
        return;
      }
      if (el.matches?.('.glass-multi-search') && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        applyGlassMultiSearch(el);
      }
    });
    document.addEventListener('change', async e => {
      const el = e.target;
      try {
        if (el.id === 'serverSelect') {
          A.state = (await A.send(MESSAGE.SET_ACTIVE_SITE, { siteId: el.value })).state;
          A.discardRuleEdit();
          A.discardScheduleEdit?.();
          A.alarmDraft = null;
          A.settingsDraft = null;
          A.appearanceDraftTheme = null;
          A.renderShell();
          A.renderPage();
          return;
        }
        if (el.id === 'profileSelect') {
          A.state = (await A.send(MESSAGE.SET_ACTIVE_PROFILE, { profileId: el.value })).state;
          A.discardRuleEdit();
          A.discardScheduleEdit?.();
          A.alarmDraft = null;
          A.settingsDraft = null;
          A.appearanceDraftTheme = null;
          A.renderShell();
          A.renderPage();
          return;
        }
        if (el.id === 'homeMonitor') {
          const p = A.profile();
          if (!p) return;
          const profileId = p.id, enabled = Boolean(el.checked), seq = ++A.monitoringToggleSeq;
          p.monitoring = p.monitoring || {};
          p.monitoring.enabled = enabled;
          p.runtime = p.runtime || {};
          p.runtime.nextCycleAt = null;
          A.setHomeMonitoringVisual?.(enabled);
          try {
            const res = await A.send(MESSAGE.SET_MONITORING, { profileId, enabled });
            if (seq === A.monitoringToggleSeq) {
              A.state = res.state;
              const current = A.profile();
              A.setHomeMonitoringVisual?.(Boolean(current?.monitoring?.enabled));
              A.refreshHomeMonitorDom?.(A.state, current);
            }
          } catch (err) {
            if (seq === A.monitoringToggleSeq) {
              try {
                const latest = await A.send(MESSAGE.GET_STATE);
                A.state = latest.state;
                const current = A.profile();
                A.setHomeMonitoringVisual?.(Boolean(current?.monitoring?.enabled));
                A.refreshHomeMonitorDom?.(A.state, current);
              } catch {}
            }
            throw err;
          }
          return;
        }
        if (['alarmPreset', 'alarmDurationUnit', 'alarmLoop', 'alarmUseCustom', 'alarmStopMethod'].includes(el.id)) {
          const cfg = storeAlarmDraft(alarmConfigFromControls());
          if (el.id === 'alarmPreset' && A.state?.runtime?.activeAlarm?.active && A.state.runtime.activeAlarm.source === 'Alarm Settings Test') {
            await A.send(MESSAGE.PLAY_ALARM, { alarm: cfg, meta: alarmTestMeta() });
          }
          return;
        }
        if (el.dataset.settingsProp) {
          const d = A.ensureSettingsDraft(), path = el.dataset.settingsProp;
          if (path === 'autoSync.unit') {
            if (d.autoSync.intervalValue === undefined) {
              const v = document.querySelector('[data-settings-prop="autoSync.intervalValue"]')?.value;
              if (v !== undefined) d.autoSync.intervalValue = Number(v);
            }
            d.autoSync.unit = el.value;
            A.renderPage();
            return;
          }
          if (path === 'system.activityRefreshUnit') {
            if (d.system.activityRefreshValue === undefined) {
              const v = document.querySelector('[data-settings-prop="system.activityRefreshValue"]')?.value;
              if (v !== undefined) d.system.activityRefreshValue = Number(v);
            }
            d.system.activityRefreshUnit = el.value;
            A.renderPage();
            return;
          }
          setPath(d, path, typed(el));
          if (el.type === 'checkbox' || path === 'autoSync.enabled' || path === 'system.completionToneEnabled') A.renderPage();
          return;
        }
        if (el.id === 'homeShowCompletedActions') {
          A.homeShowCompletedActions = el.checked;
          A.renderPage();
          return;
        }
        if (el.dataset.projectDataset && el.dataset.projectKey) {
          const s = A.site();
          if (!s) return;
          const key = el.dataset.projectKey,
            map = structuredClone(s.inventorySettings?.projectDatasets || {}),
            cfg = { ...SD.Defaults.projectDatasets(false), ...(map[key] || {}) };
          cfg[el.dataset.projectDataset] = el.checked;
          map[key] = cfg;
          const res = await A.send(MESSAGE.UPDATE_SERVER, { siteId: s.id, inventorySettings: { projectDatasets: map } });
          A.state = res.state;
          const updated = A.site(),
            count = SD.Utils.discoveryProjectKeys(updated?.inventorySettings).length,
            label = A.$('discoverySelectedCount'),
            projectCard = el.closest('.discovery-project-card'),
            projectConfig = { ...SD.Defaults.projectDatasets(false), ...(updated?.inventorySettings?.projectDatasets?.[key] || {}) },
            enabledCount = Object.values(projectConfig).filter(Boolean).length;
          if (label) label.textContent = `${count}/${updated.projects.length} projects configured`;
          if (projectCard) {
            const chip = projectCard.querySelector('.freshness-chip');
            if (chip) chip.textContent = `${enabledCount}/5`;
          }
          const btn = A.$('syncSelectedDataBtn');
          if (btn) btn.disabled = !count;
          return;
        }
        if (el.dataset.globalDataset) {
          const s = A.site();
          if (!s) return;
          const global = { ...(s.inventorySettings?.globalDatasets || {}), [el.dataset.globalDataset]: el.checked };
          A.state = (await A.send(MESSAGE.UPDATE_SERVER, { siteId: s.id, inventorySettings: { globalDatasets: global } })).state;
          return;
        }
        if (el.dataset.ruleToggle) {
          const stored = A.profile()?.rules?.find(x => x.id === el.dataset.ruleToggle);
          if (stored) {
            stored.enabled = el.checked;
            await A.save(false);
            A.renderPage();
          }
          return;
        }
        if (el.dataset.ruleTime) {
          const r = activeRule();
          if (!r) return;
          applyRuleTime(el);
          await saveRule(r, true);
          return;
        }
        if (el.id === 'alarmStopMethod') { const cfg=alarmConfigFromControls(); A.alarmDraft={profileId:A.profile()?.id||'',alarmProfileId:cfg.id,config:cfg}; A.renderPage(); return; }
        if (el.dataset.ruleRootOp) { const rr=activeRule(); if(!rr) return; rr.logic=rr.logic||{groups:[]}; rr.logic.operator=el.value==='OR'?'OR':'AND'; await saveRule(rr,true); return; }
        if (el.dataset.ruleEnabledId) {
          const stored = A.profile()?.rules?.find(x => x.id === el.dataset.ruleEnabledId);
          if (!stored) return; stored.enabled = Boolean(el.checked); touchRule(stored); await A.save(false, 'none'); A.renderPage(); return;
        }
        if (el.dataset.groupOp) {
          const r = activeRule(), g = r?.logic?.groups?.find(x => x.id === el.dataset.groupOp); if (!g) return; g.operator = el.value === 'OR' ? 'OR' : 'AND'; await saveRule(r,true); return;
        }
        if (el.dataset.ruleTimeUnit) {
          const r = activeRule();
          if (!r) return;
          applyRuleTimeUnit(el);
          await saveRule(r, true);
          return;
        }
        if (el.dataset.ruleProp) {
          const r = activeRule();
          if (!r) return;
          let v = typed(el);
          if (el.dataset.ruleProp === 'priority') v = clamp(v, 1, 10000);
          setPath(r, el.dataset.ruleProp, v);
          if (el.dataset.ruleProp === 'schedule.mode' && v === 'always') r.schedule.scheduleIds = [];
          if (el.dataset.ruleProp === 'executionPolicy.mode' && v !== SD.Constants.EXECUTION_POLICY.REPEAT) r.executionPolicy.repeatSeconds = 3600;
          await saveRule(r, true);
          return;
        }
        if (el.dataset.group) {
          const r = activeRule(), g = r?.logic?.groups?.find(x => x.id === el.dataset.group);
          if (g) {
            setPath(g, el.dataset.prop, typed(el));
            if (r.logic) r.logic.needsReview = false;
            await saveRule(r, true);
          }
          return;
        }
        if (el.dataset.cond && !el.dataset.actionCond) {
          const r = activeRule(), c = findCond(el.dataset.cond), s = A.site();
          if (!r || !c) return;
          if (el.dataset.prop === 'field') {
            c.field = el.value;
            delete c.fieldKind;
            delete c.jqlField;
            delete c.fieldSchema;
            const def = R.get(c.field, s);
            c.operator = def?.operators?.[0] || 'equals';
            c.values = [];
            c.value = '';
          }
          else if (el.dataset.prop === 'operator') {
            const previous = R.conditionValues(c);
            c.operator = el.value;
            const mode = R.valueMode(c.field, c.operator);
            if (mode === 'none') {
              c.values = [];
              c.value = '';
            }
            else if (mode === 'multi') {
              c.values = previous;
              c.value = '';
            }
            else {
              c.value = previous[0] || '';
              c.values = [];
            }
          }
          else if (el.dataset.prop === 'valuesText') {
            c.values = String(el.value || '').split(',').map(x => x.trim()).filter(Boolean);
            c.value = '';
          }
          else {
            setPath(c, el.dataset.prop, typed(el));
            if (el.dataset.prop === 'value') c.values = [];
          }
          R.normalizeCondition(c, s);
          await saveRule(r, true);
          return;
        }
        if (el.dataset.actionCond) {
          const r = activeRule(),
            a = findAction(el.dataset.actionCondAction),
            c = findActionCond(el.dataset.actionCondAction, el.dataset.actionCond),
            s = A.site();
          if (!r || !a || !c) return;
          if (el.dataset.prop === 'field') {
            c.field = el.value;
            delete c.fieldKind;
            delete c.jqlField;
            delete c.fieldSchema;
            const def = R.get(c.field, s);
            c.operator = def?.operators?.[0] || 'equals';
            c.values = [];
            c.value = '';
          }
          else if (el.dataset.prop === 'operator') {
            const previous = R.conditionValues(c);
            c.operator = el.value;
            const mode = R.valueMode(c.field, c.operator);
            if (mode === 'none') {
              c.values = [];
              c.value = '';
            }
            else if (mode === 'multi') {
              c.values = previous;
              c.value = '';
            }
            else {
              c.value = previous[0] || '';
              c.values = [];
            }
          }
          else if (el.dataset.prop === 'valuesText') {
            c.values = String(el.value || '').split(',').map(x => x.trim()).filter(Boolean);
            c.value = '';
          }
          else {
            setPath(c, el.dataset.prop, typed(el));
            if (el.dataset.prop === 'value') c.values = [];
          }
          R.normalizeCondition(c, s);
          await saveRule(r, true);
          return;
        }
        if (el.dataset.actionWhenOp) {
          const r = activeRule(), a = findAction(el.dataset.actionId), g = a?.when?.logic?.groups?.[0];
          if (!r || !g) return;
          g.operator = el.value === 'OR' ? 'OR' : 'AND';
          await saveRule(r, true);
          return;
        }
        if (el.dataset.actionPool) {
          const r = activeRule(), pool = r?.actionRandomness?.pools?.find(x => x.id === el.dataset.actionPool);
          if (!r || !pool) return;
          pool[el.dataset.poolProp] = el.dataset.poolProp === 'pickCount' ? clamp(el.value, 1, L.RULE_ACTION_COUNT_MAX) : String(el.value || '').slice(0, 60);
          await saveRule(r, false);
          return;
        }
        if (el.dataset.commentTemplateIndex !== undefined) {
          const r = activeRule();
          if (r) await saveRule(r, false);
          return;
        }
        if (el.dataset.actionTime) {
          const r = activeRule();
          if (!r) return;
          applyActionTime(el);
          await saveRule(r, true);
          return;
        }
        if (el.dataset.actionTimeUnit) {
          const r = activeRule();
          if (!r) return;
          applyActionTimeUnit(el);
          await saveRule(r, true);
          return;
        }
        if (el.dataset.actionId && el.dataset.aprop) {
          const r = activeRule(), a = findAction(el.dataset.actionId);
          if (!r || !a) return;
          let prop = el.dataset.aprop, v = typed(el);
          if (prop === 'addText') {
            a.add = el.value.split(',').map(x => x.trim()).filter(Boolean);
          }
          else if (prop === 'removeText') {
            a.remove = el.value.split(',').map(x => x.trim()).filter(Boolean);
          }
          else {
            if (prop === 'volume') v = clamp(v, 0, 1);
            setPath(a, prop, v);
            if (a.type === ACTION.TRANSITION && prop === 'transitionId') {
              const o = el.selectedOptions?.[0];
              a.transitionContext = v && o ? {
                projectKey: o.dataset.projectKey || '',
                issueTypeId: String(o.dataset.issueTypeId || ''),
                fromStatusId: String(o.dataset.fromStatusId || ''),
                toStatusId: String(o.dataset.toStatusId || ''),
                transitionName: o.dataset.transitionName || ''
              } : null;
            }
          }
          await saveRule(r, ['mode', 'enabled', 'delay.mode', 'transitionId', 'toStatusId', 'manualTransitionName', 'when.enabled', 'needsApproval', 'randomPoolId'].includes(prop));
          return;
        }
        if (el.dataset.scheduleProp) {
          const sc = activeSchedule();
          if (!sc) return;
          setPath(sc, el.dataset.scheduleProp, typed(el));
          return;
        }
        if (el.dataset.scheduleDay !== undefined) {
          const sc = activeSchedule();
          if (!sc) return;
          const d = Number(el.dataset.scheduleDay), set = new Set(sc.days || []);
          el.checked ? set.add(d) : set.delete(d);
          sc.days = [...set].sort();
          return;
        }
        if (el.matches?.('[data-multi-value]')) {
          const group = el.closest('[data-multi-group]');
          if (!group) return;
          el.closest('.glass-choice')?.classList.toggle('selected', el.checked);
          const search = group.closest('.glass-multi-wrap')?.querySelector('.glass-multi-search');
          reorderGlassMulti(group, search?.value || '');
          const vals = A.multiGroupValues(el);
          if (group.dataset.multiScope === 'rule') {
            const r = activeRule();
            setPath(r, group.dataset.multiProp, vals);
            await saveRule(r, ['source.filterIds', 'schedule.scheduleIds'].includes(group.dataset.multiProp));
            return;
          }
          if (group.dataset.multiScope === 'condition') {
            const r = activeRule(), c = findCond(group.dataset.multiId);
            if (c) c.values = vals;
            await saveRule(r, false);
            return;
          }
          if (group.dataset.multiScope === 'action-condition') {
            const r = activeRule(), c = findActionCond(group.dataset.actionId, group.dataset.multiId);
            if (c) c.values = vals;
            await saveRule(r, false);
            return;
          }
          if (group.dataset.multiScope === 'action') {
            const r = activeRule(), a = findAction(group.dataset.multiId);
            if (a) setPath(a, group.dataset.multiProp, vals);
            await saveRule(r, false);
            return;
          }
        }
        if (el.id === 'addActionType' && el.value) {
          const r = activeRule();
          if (!r) return;
          if ((r.actions || []).length >= L.RULE_ACTION_COUNT_MAX) throw new Error(`A rule can contain at most ${L.RULE_ACTION_COUNT_MAX} actions.`);
          r.actions.push(SD.Defaults.action(el.value));
          el.value = '';
          A.renderPage();
          return;
        }
      } catch (err) {
        A.toast(err.message, 'error');
        if (err.code === 'VALIDATION_ERROR') await A.load().catch(() => {});
      }
    });
    document.addEventListener('click', async e => {
      if (e.target.closest?.('[data-action="unlock-extension"]')) {
        await A.unlockExtension?.();
        return;
      }
      if (e.target.closest?.('[data-action="confirm-security-reauth"]')) {
        await A.confirmSecurityReauth?.();
        return;
      }
      if (e.target.closest?.('[data-action="cancel-security-reauth"]')) {
        A.cancelSecurityReauth?.();
        return;
      }
      if (e.target.closest?.('#cancelOperation')) {
        if (A.currentOperationId) {
          A.updateOperation('Cancelling…', 'Stopping further API requests.');
          await A.send(MESSAGE.CANCEL_OPERATION, { operationId: A.currentOperationId }).catch(() => {});
        }
        return;
      }
      if (pageButton(e.target)) return;
      const b = e.target.closest?.('[data-action]');
      if (!b) return;
      const act = b.dataset.action;
      try {
        await A.busy(b, async () => {
          const s = A.site(), p = A.profile(), r = activeRule(), sc = activeSchedule();
          if (act === 'refresh-ui' || act === 'refresh-home') {
            await A.load();
            A.toast('Interface refreshed.');
            return;
          }
          if (act === 'home-detection-view') {
            A.homeDetectionView = b.dataset.view === 'recent' ? 'recent' : 'current';
            A.renderPage();
            return;
          }
          if (act === 'refresh-current-matches') {
            if (!s || !p) throw new Error('Select a server and profile.');
            await A.send(MESSAGE.REFRESH_CURRENT_MATCHES, { siteId: s.id, profileId: p.id });
            await A.load();
            A.homeDetectionView = 'current';
            return;
          }
          if (act === 'bulk-reset') {
            A.resetBulkDraft?.();
            A.renderPage();
            return;
          }
          if (act === 'bulk-preview') {
            if (!s || !p) throw new Error('Select a server and profile.');
            const draft = structuredClone(A.ensureBulkDraft());
            normalizeRuleConditions(draft, s);
            const errors = SD.Validators.validateRule(draft);
            if (errors.length) throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
            const response = await A.send(MESSAGE.PREVIEW_BULK_OPERATION, { siteId: s.id, profileId: p.id, operation: draft });
            A.bulkPreview = response.preview || null;
            A.renderPage();
            return;
          }
          if (act === 'bulk-run') {
            if (!s || !p) throw new Error('Select a server and profile.');
            const draft = structuredClone(A.ensureBulkDraft());
            normalizeRuleConditions(draft, s);
            const errors = SD.Validators.validateRule(draft);
            if (errors.length) throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
            if (!(draft.actions || []).some(action => action.enabled !== false)) throw Object.assign(new Error('Add at least one enabled action.'), { code: 'VALIDATION_ERROR' });
            if (!confirm('Run this one-time bulk operation now? Matching issues will be queued immediately and configured delays will be respected.')) return;
            const securityAuthToken = await A.requestSecurityReauth('run this bulk operation');
            const response = await A.send(MESSAGE.RUN_BULK_OPERATION, { siteId: s.id, profileId: p.id, operation: draft, securityAuthToken });
            const matched = response.result?.matched || 0, planned = response.result?.planned || 0;
            A.resetBulkDraft?.();
            await A.pullHomeActivity();
            A.setPage('home');
            A.toast(`Bulk operation queued ${planned} action${planned === 1 ? '' : 's'} across ${matched} matching issue${matched === 1 ? '' : 's'}.`, 'success');
            return;
          }
          if (act === 'go-servers') {
            A.setPage('servers');
            return;
          }
          if (act === 'run-cycle') {
            if (!s || !p) throw new Error('Select a server and profile.');
            await A.send(MESSAGE.RUN_CYCLE, { siteId: s.id, profileId: p.id });
            await A.load();
            return;
          }
          if (act === 'stop-alarm') {
            await A.send(MESSAGE.STOP_ALARM);
            await A.refreshHomeActivity();
            await A.load();
            return;
          }
          if (act === 'approve-job') {
            const job = (A.jobs || []).find(x => x.id === b.dataset.jobId);
            if (!job) throw new Error('Queued action was not found.');
            if (job.status !== JOB.AWAITING_APPROVAL) throw new Error('This action is no longer awaiting approval.');
            const securityAuthToken = await A.requestSecurityReauth('approve this Jira action');
            await A.send(MESSAGE.APPROVE_JOB, { jobId: job.id, securityAuthToken });
            await A.pullHomeActivity();
            A.toast('Action approved.', 'success');
            return;
          }
          if (act === 'approve-all-jobs') {
            if (!s || !p) throw new Error('Select a server and profile.');
            const count = (A.jobs || []).filter(x => x.siteId === s.id && x.profileId === p.id && x.status === JOB.AWAITING_APPROVAL).length;
            if (!count) {
              A.toast('No actions are awaiting approval.', 'info');
              return;
            }
            if (!confirm(`Approve all ${count} pending approval${count === 1 ? '' : 's'} for this profile?`)) return;
            const securityAuthToken = await A.requestSecurityReauth('approve all pending Jira actions for this profile');
            const response = await A.send(MESSAGE.APPROVE_JOBS, { siteId: s.id, profileId: p.id, securityAuthToken });
            await A.pullHomeActivity();
            A.toast(`${response.result?.approved || 0} action${response.result?.approved === 1 ? '' : 's'} approved.`, 'success');
            return;
          }
          if (act === 'process-job') {
            const job = (A.jobs || []).find(x => x.id === b.dataset.jobId);
            if (!job) throw new Error('Queued action was not found.');
            if (job.status !== JOB.PENDING) throw new Error('Only upcoming actions can be processed immediately.');
            const securityAuthToken = await A.requestSecurityReauth('process this Jira action immediately');
            const result = await A.send(MESSAGE.PROCESS_JOB, { jobId: job.id, securityAuthToken });
            await A.pullHomeActivity();
            const status = result.job?.status || 'unknown';
            A.toast(status === JOB.SUCCEEDED ? 'Action processed now.' : status === JOB.CANCELLED ? 'Action cancelled by preflight.' : status === JOB.FAILED ? 'Action failed.' : 'Action processing requested.', status === JOB.SUCCEEDED ? 'success' : status === JOB.FAILED ? 'error' : 'info');
            return;
          }
          if (act === 'process-issue-jobs') {
            if (!s || !p) throw new Error('Select a server and profile.');
            const issueKey = String(b.dataset.issueKey || ''),
              count = (A.jobs || []).filter(x => x.siteId === s.id && x.profileId === p.id && x.issueKey === issueKey && [JOB.AWAITING_APPROVAL, JOB.PENDING].includes(x.status)).length;
            if (!count) {
              A.toast('No upcoming actions remain for this issue.', 'info');
              return;
            }
            if (!confirm(`Process all ${count} upcoming action${count === 1 ? '' : 's'} for ${issueKey} now?`)) return;
            const securityAuthToken = await A.requestSecurityReauth(`process all upcoming actions for ${issueKey}`);
            const res = await A.send(MESSAGE.PROCESS_JOBS, { siteId: s.id, profileId: p.id, issueKey, securityAuthToken });
            await A.pullHomeActivity();
            A.toast(`${res.result?.processed || 0} action${res.result?.processed === 1 ? '' : 's'} processed for ${issueKey}.`, 'info');
            return;
          }
          if (act === 'process-all-jobs') {
            if (!s || !p) throw new Error('Select a server and profile.');
            const count = (A.jobs || []).filter(x => x.siteId === s.id && x.profileId === p.id && [JOB.AWAITING_APPROVAL, JOB.PENDING].includes(x.status)).length;
            if (!count) {
              A.toast('No upcoming actions remain.', 'info');
              return;
            }
            if (!confirm(`Process all ${count} upcoming actions for this profile across all issues now?`)) return;
            const securityAuthToken = await A.requestSecurityReauth('process all upcoming actions for this profile');
            const res = await A.send(MESSAGE.PROCESS_JOBS, { siteId: s.id, profileId: p.id, securityAuthToken });
            await A.pullHomeActivity();
            A.toast(`${res.result?.processed || 0} action${res.result?.processed === 1 ? '' : 's'} processed.`, 'info');
            return;
          }
          if (act === 'cancel-job') {
            const job = (A.jobs || []).find(x => x.id === b.dataset.jobId);
            if (!job) throw new Error('Queued action was not found.');
            if (![JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(job.status)) throw new Error('This action is no longer cancellable.');
            if (!confirm(`Cancel this ${job.status === JOB.RUNNING ? 'running' : job.status === JOB.AWAITING_APPROVAL ? 'unapproved' : 'queued'} action for ${job.issueKey || 'this issue'}?`)) return;
            const result = await A.send(MESSAGE.CANCEL_JOB, { jobId: job.id });
            await A.pullHomeActivity();
            A.toast(result.job?.status === JOB.CANCELLED ? 'Queued action cancelled.' : 'Cancellation requested.', 'info');
            return;
          }
          if (act === 'cancel-issue-jobs') {
            if (!s || !p) throw new Error('Select a server and profile.');
            const issueKey = String(b.dataset.issueKey || ''),
              count = (A.jobs || []).filter(x => x.siteId === s.id && x.profileId === p.id && x.issueKey === issueKey && [JOB.AWAITING_APPROVAL, JOB.PENDING].includes(x.status)).length;
            if (!count) {
              A.toast('No upcoming actions remain for this issue.', 'info');
              return;
            }
            if (!confirm(`Cancel all ${count} upcoming action${count === 1 ? '' : 's'} for ${issueKey}?`)) return;
            const securityAuthToken = await A.requestSecurityReauth(`cancel all upcoming actions for ${issueKey}`);
            const res = await A.send(MESSAGE.CANCEL_JOBS, { siteId: s.id, profileId: p.id, issueKey, securityAuthToken });
            await A.pullHomeActivity();
            A.toast(`${res.result?.cancelled || 0} upcoming action${res.result?.cancelled === 1 ? '' : 's'} cancelled for ${issueKey}.`, 'info');
            return;
          }
          if (act === 'cancel-all-jobs') {
            if (!s || !p) throw new Error('Select a server and profile.');
            const count = (A.jobs || []).filter(x => x.siteId === s.id && x.profileId === p.id && [JOB.AWAITING_APPROVAL, JOB.PENDING].includes(x.status)).length;
            if (!count) {
              A.toast('No upcoming actions remain.', 'info');
              return;
            }
            if (!confirm(`Cancel all ${count} upcoming actions for this profile across all issues?`)) return;
            const securityAuthToken = await A.requestSecurityReauth('cancel all upcoming actions for this profile');
            const res = await A.send(MESSAGE.CANCEL_JOBS, { siteId: s.id, profileId: p.id, securityAuthToken });
            await A.pullHomeActivity();
            A.toast(`${res.result?.cancelled || 0} upcoming action${res.result?.cancelled === 1 ? '' : 's'} cancelled.`, 'info');
            return;
          }
          if (act === 'toggle-add-server') {
            A.serverAddOpen = !A.serverAddOpen;
            A.renderPage();
            return;
          }
          if (act === 'cancel-add-server') {
            A.serverAddOpen = false;
            A.renderPage();
            return;
          }
          if (act === 'add-server') {
            const name = A.$('newServerName').value.trim(),
              baseUrl = A.$('newServerUrl').value.trim(),
              token = A.$('newServerPat').value.trim(),
              persistence = A.$('newServerPersistence').value,
              preset = A.$('newServerIcon').value;
            if (!baseUrl || !token) throw new Error('Jira URL and PAT are required.');
            const icon = preset === 'auto' ? { mode: 'auto', preset: 'emerald', url: `${baseUrl.replace(/\/$/, '')}/favicon.ico` } : { mode: 'preset', preset, url: '' };
            const securityAuthToken = await A.requestSecurityReauth('save a Jira PAT and add this server');
            const added = await A.send(MESSAGE.ADD_SERVER, { baseUrl, name: name || new URL(baseUrl).host, token, persistence, icon, sync: true, securityAuthToken });
            A.serverAddOpen = false;
            A.serverEditId = added.siteId;
            await A.load();
            A.setPage('servers');
            return;
          }
          if (act === 'select-server') {
            A.discardRuleEdit?.();
            A.settingsDraft = null;
            A.state = (await A.send(MESSAGE.SET_ACTIVE_SITE, { siteId: b.dataset.id })).state;
            A.serverEditId = '';
            A.selectedRuleId = '';
            A.renderShell();
            A.renderPage();
            return;
          }
          if (act === 'edit-server') {
            A.serverEditId = b.dataset.id;
            A.renderPage();
            return;
          }
          if (act === 'close-server-editor') {
            A.serverEditId = '';
            A.renderPage();
            return;
          }
          if (act === 'discover-projects') {
            await A.send(MESSAGE.DISCOVER_PROJECTS, { siteId: s.id });
            await A.load();
            A.serverEditId = A.page === 'servers' ? s.id : A.serverEditId;
            return;
          }
          if (act === 'enable-all-project-data' || act === 'clear-project-data') {
            const enable = act === 'enable-all-project-data', map = {};
            for (const project of s.projects || []) map[project.key] = SD.Defaults.projectDatasets(enable);
            A.state = (await A.send(MESSAGE.UPDATE_SERVER, { siteId: s.id, inventorySettings: { projectDatasets: map } })).state;
            A.serverEditId = s.id;
            A.renderPage();
            return;
          }
          if (act === 'save-server-settings') {
            const rp = validateServerInputs(),
              baseUrl = SD.Utils.normalizeBaseUrl(A.$('serverUrlEdit')?.value || s.baseUrl);
            if (!baseUrl) throw new Error('Enter a valid Jira base URL.');
            const mode = A.$('serverIconEdit').value,
              icon = mode === 'auto' ? { mode: 'auto', url: `${baseUrl}/favicon.ico`, preset: 'emerald' } : { mode: 'preset', preset: mode, url: '' },
              network = { requestPolicy: rp },
              du = A.$('connectionLossDurationUnit')?.value || 'minutes',
              connectionLossAlarm = {
                enabled: Boolean(A.$('connectionLossAlarmEnabled')?.checked),
                trigger: A.$('connectionLossTrigger')?.value || 'either',
                durationSeconds: seconds(A.$('connectionLossDuration')?.value || 5, du, L.CONNECTION_LOSS_MIN_SECONDS, L.CONNECTION_LOSS_MAX_SECONDS),
                durationUnit: du,
                failedChecks: clamp(A.$('connectionLossFailures')?.value || 5, L.CONNECTION_LOSS_FAILURES_MIN, L.CONNECTION_LOSS_FAILURES_MAX)
              },
              behavior = { autoRefreshJiraTabsOnDetection: Boolean(A.$('autoRefreshOnDetection')?.checked), focusJiraTabOnDetection: Boolean(A.$('focusJiraTabOnDetection')?.checked), connectionLossAlarm },
              transitionMethod = A.$('transitionMethodEdit')?.value || s.inventorySettings?.transitionMethod || TRANSITION_METHOD.WORKFLOW_DESIGNER,
              inventorySettings = { transitionMethod, restoreExcludedOnRefresh: Boolean(A.$('restoreExcludedOnRefresh')?.checked) };
            const urlChanged = baseUrl !== SD.Utils.normalizeBaseUrl(s.baseUrl),
              securityAuthToken = urlChanged ? await A.requestSecurityReauth('change the Jira server URL') : '';
            A.state = (await A.send(MESSAGE.UPDATE_SERVER, { siteId: s.id, baseUrl, name: A.$('serverNameEdit').value.trim() || s.name, icon, network, behavior, inventorySettings, securityAuthToken })).state;
            A.renderShell();
            A.serverEditId = s.id;
            A.renderPage();
            A.toast('Server settings saved.');
            return;
          }
          if (act === 'change-pat') {
            const token = A.$('serverPatEdit').value.trim();
            if (!token) throw new Error('Enter a replacement PAT.');
            const securityAuthToken = await A.requestSecurityReauth('replace the Jira PAT');
            await A.send(MESSAGE.SAVE_CREDENTIAL, { siteId: s.id, token, persistence: s.auth?.persistence || 'local', securityAuthToken });
            await A.send(MESSAGE.TEST_CONNECTION, { siteId: s.id });
            await A.load();
            A.serverEditId = s.id;
            return;
          }
          if (act === 'sync-data') {
            const selected = SD.Utils.discoveryProjectKeys(s?.inventorySettings);
            if (!selected.length) throw new Error('Choose at least one discovery dataset for at least one project.');
            await A.send(MESSAGE.SYNC_SITE, { siteId: s.id });
            await A.load();
            A.serverEditId = A.page === 'servers' ? s.id : A.serverEditId;
            return;
          }
          if (act === 'open-jira') {
            await chrome.tabs.create({ url: s.baseUrl, active: true });
            return;
          }
          if (act === 'delete-server') {
            if (!confirm(`Delete ${s.name} and its SD Companion data?`)) return;
            const securityAuthToken = await A.requestSecurityReauth('delete this Jira server and its SD Companion data');
            A.state = (await A.send(MESSAGE.DELETE_SITE, { siteId: s.id, securityAuthToken })).state;
            A.serverEditId = '';
            await A.load();
            return;
          }
          if (act === 'exclude-inventory-item') {
            e.preventDefault(); e.stopPropagation();
            const type = b.dataset.type, key = String(b.dataset.key || '');
            if (!type || !key) return;
            const excludedData = structuredClone(s.inventorySettings?.excludedData || {});
            excludedData[type] = [...new Set([...(excludedData[type] || []).map(String), key])];
            A.state = (await A.send(MESSAGE.UPDATE_SERVER, { siteId: s.id, inventorySettings: { excludedData } })).state;
            A.renderPage();
            return;
          }
          if (act === 'restore-inventory-type') {
            const type = b.dataset.type, excludedData = structuredClone(s.inventorySettings?.excludedData || {});
            excludedData[type] = [];
            A.state = (await A.send(MESSAGE.UPDATE_SERVER, { siteId: s.id, inventorySettings: { excludedData } })).state;
            A.renderPage();
            return;
          }
          if (act === 'inventory-type') {
            A.inventoryType = b.dataset.type;
            A.inventorySearch = '';
            A.renderPage();
            return;
          }
          if (act === 'rule-source-mode') {
            const r = activeRule(); if (!r) return;
            r.source = r.source || {}; r.source.mode = b.dataset.value === 'jql' ? 'jql' : 'conditions';
            if (r.source.mode === 'jql') { r.source.filterIds = []; } else { r.source.jql = ''; }
            await saveRule(r, true); A.renderPage(); return;
          }
          if (act === 'add-condition-group') {
            const r = activeRule(); if (!r) return; r.logic = r.logic || { operator:'AND', groups:[] }; r.logic.groups = r.logic.groups || []; r.logic.groups.push(SD.Defaults.group()); await saveRule(r,true); A.renderPage(); return;
          }
          if (act === 'delete-condition-group') {
            const r = activeRule(); if (!r || (r.logic?.groups || []).length <= 1) return; r.logic.groups = r.logic.groups.filter(g => g.id !== b.dataset.id); await saveRule(r,true); A.renderPage(); return;
          }
          if (act === 'new-rule') {
            const nr = SD.Defaults.rule(`Rule ${(p.rules || []).length + 1}`);
            nr.revision = 1;
            A.beginRuleEdit(nr, { isNew: true });
            A.renderPage();
            return;
          }
          if (act === 'edit-rule') {
            const stored = p.rules.find(x => x.id === b.dataset.id);
            if (!stored) throw new Error('Rule not found.');
            A.beginRuleEdit(stored);
            A.renderPage();
            return;
          }
          if (act === 'duplicate-rule') {
            const stored = p.rules.find(x => x.id === b.dataset.id);
            if (!stored) throw new Error('Rule not found.');
            const copy = duplicateRuleObject(stored);
            p.rules.push(copy);
            await A.save(false, 'none');
            A.toast(`Duplicated as ${copy.name}. The copy is disabled until you enable it.`, 'success');
            A.renderPage();
            return;
          }
          if (act === 'cancel-rule-edit' || act === 'close-rule-editor') {
            A.discardRuleEdit();
            A.renderPage();
            return;
          }
          if (act === 'rule-editor-section') {
            A.ruleEditorSection = b.dataset.section || 'setup';
            A.renderPage();
            return;
          }
          if (act === 'save-rule') {
            const draft = activeRule();
            if (!draft) throw new Error('No rule is being edited.');
            normalizeRuleConditions(draft, s);
            const errs = SD.Validators.validateRule(draft);
            if (draft.enabled && draft.schedule?.mode === 'scheduled') {
              const known = new Set((p.schedules || []).map(x => x.id)),
                missing = (draft.schedule.scheduleIds || []).filter(id => !known.has(id));
              if (missing.length) errs.push(`Rule '${draft.name}' references a schedule that no longer exists.`);
            }
            if (errs.length) throw Object.assign(new Error(errs[0]), { code: 'VALIDATION_ERROR' });
            const method = A.RuleViews?.transitionMethod?.(s) || TRANSITION_METHOD.WORKFLOW_DESIGNER;
            for (const action of draft.actions || []) {
              if (action.type !== ACTION.TRANSITION || action.enabled === false) continue;
              const relevant = A.RuleViews?.transitionChoices?.(s, draft, action) || [],
                targets = A.RuleViews?.targetStatusChoices?.(s, draft, action) || [];
              if (method === TRANSITION_METHOD.WORKFLOW_DESIGNER || method === TRANSITION_METHOD.ISSUE_EXTRACTION) {
                if (!action.transitionId) throw Object.assign(new Error(`Rule '${draft.name}' transition action needs a synchronized contextual transition.`), { code: 'VALIDATION_ERROR' });
                if (!relevant.some(t => transitionMatchesAction(t, action))) throw Object.assign(new Error(`Rule '${draft.name}' selected transition is outside the current project / issue type / status context.`), { code: 'VALIDATION_ERROR' });
              }
              else if (method === TRANSITION_METHOD.TARGET_STATUS_RANDOM) {
                if (!action.toStatusId) throw Object.assign(new Error(`Rule '${draft.name}' transition action needs a target status.`), { code: 'VALIDATION_ERROR' });
                if (!targets.some(t => String(t.id) === String(action.toStatusId))) throw Object.assign(new Error(`Rule '${draft.name}' target status is outside the current project / issue type context.`), { code: 'VALIDATION_ERROR' });
              }
              else if (method === TRANSITION_METHOD.MANUAL_NAME && !String(action.manualTransitionName || '').trim()) throw Object.assign(new Error(`Rule '${draft.name}' transition action needs a manual transition name.`), { code: 'VALIDATION_ERROR' });
            }
            touchRule(draft);
            const committed = structuredClone(draft), i = p.rules.findIndex(x => x.id === committed.id);
            if (i >= 0) p.rules[i] = committed;
            else p.rules.push(committed);
            await A.save(false, 'none');
            A.discardRuleEdit();
            A.renderPage();
            A.toast('Rule saved.', 'success');
            return;
          }
          if (act === 'condition-match') {
            const rr = activeRule(), g = rr?.logic?.groups?.[0];
            if (!rr || !g) return;
            g.operator = b.dataset.value === 'OR' ? 'OR' : 'AND';
            if (rr.logic) rr.logic.needsReview = false;
            await saveRule(rr, true);
            return;
          }
          if (act === 'delete-rule') {
            if (!r || !confirm(`Delete rule "${r.name}"?`)) return;
            if (A.ruleDraftIsNew) {
              A.discardRuleEdit();
              A.renderPage();
              return;
            }
            p.rules = p.rules.filter(x => x.id !== r.id);
            A.discardRuleEdit();
            await A.save();
            return;
          }
          if (act === 'add-condition') {
            const group = r?.logic?.groups?.find(x => x.id === b.dataset.group);
            if (!group) throw new Error('Condition group was not found.');
            group.conditions = group.conditions || [];
            group.conditions.push(SD.Defaults.condition());
            await saveRule(r, true);
            return;
          }
          if (act === 'delete-condition') {
            const g = r.logic.groups.find(x => x.id === b.dataset.group);
            if (g) g.conditions = g.conditions.filter(x => x.id !== b.dataset.cond);
            await saveRule(r, true);
            return;
          }
          if (act === 'add-action-condition') {
            const a = findAction(b.dataset.id);
            if (!r || !a) return;
            a.when = a.when || { enabled: true, logic: { operator: 'AND', groups: [SD.Defaults.group()] } };
            a.when.logic = a.when.logic || { operator: 'AND', groups: [SD.Defaults.group()] };
            if (!a.when.logic.groups?.length) a.when.logic.groups = [SD.Defaults.group()];
            a.when.logic.groups[0].conditions = a.when.logic.groups[0].conditions || [];
            a.when.logic.groups[0].conditions.push(SD.Defaults.condition());
            await saveRule(r, true);
            return;
          }
          if (act === 'delete-action-condition') {
            const a = findAction(b.dataset.id), g = a?.when?.logic?.groups?.[0];
            if (!r || !g) return;
            g.conditions = (g.conditions || []).filter(x => x.id !== b.dataset.cond);
            await saveRule(r, true);
            return;
          }
          if (act === 'add-action-pool') {
            if (!r) return;
            r.actionRandomness = r.actionRandomness || { enabled: true, pools: [] };
            r.actionRandomness.pools = r.actionRandomness.pools || [];
            r.actionRandomness.pools.push({ id: crypto.randomUUID(), name: `Pool ${r.actionRandomness.pools.length + 1}`, pickCount: 1 });
            await saveRule(r, true);
            return;
          }
          if (act === 'delete-action-pool') {
            if (!r) return;
            const id = b.dataset.id;
            r.actionRandomness.pools = (r.actionRandomness.pools || []).filter(x => x.id !== id);
            for (const a of r.actions || []) if (a.randomPoolId === id) a.randomPoolId = '';
            await saveRule(r, true);
            return;
          }
          if (act === 'add-comment-template') {
            const a = findAction(b.dataset.id);
            if (!r || !a) return;
            a.templates = a.templates || [];
            if (a.templates.length < L.COMMENT_TEMPLATE_COUNT_MAX) a.templates.push('');
            await saveRule(r, true);
            return;
          }
          if (act === 'delete-comment-template') {
            const a = findAction(b.dataset.id), i = Number(b.dataset.index);
            if (!r || !a || !Number.isInteger(i)) return;
            a.templates = (a.templates || []).filter((_, idx) => idx !== i);
            await saveRule(r, true);
            return;
          }
          if (act === 'delete-action') {
            r.actions = r.actions.filter(x => x.id !== b.dataset.id);
            await saveRule(r, true);
            return;
          }
          if (act === 'move-action-up' || act === 'move-action-down') {
            const i = r.actions.findIndex(x => x.id === b.dataset.id),
              j = act === 'move-action-up' ? i - 1 : i + 1;
            if (i >= 0 && j >= 0 && j < r.actions.length) [r.actions[i], r.actions[j]] = [r.actions[j], r.actions[i]];
            await saveRule(r, true);
            return;
          }
          if (act === 'new-schedule') {
            const x = SD.Defaults.schedule(`Schedule ${p.schedules.length + 1}`);
            A.beginScheduleEdit?.(x, { isNew: true });
            A.renderPage();
            return;
          }
          if (act === 'edit-schedule') {
            const stored = p.schedules.find(x => x.id === b.dataset.id);
            if (!stored) throw new Error('Schedule not found.');
            A.beginScheduleEdit?.(stored, { isNew: false });
            A.renderPage();
            return;
          }
          if (act === 'cancel-schedule-editor') {
            A.discardScheduleEdit?.();
            A.renderPage();
            return;
          }
          if (act === 'save-schedule') {
            if (!sc) throw new Error('Schedule not found.');
            const draft = structuredClone(sc);
            if (!String(draft.name || '').trim()) throw Object.assign(new Error('Schedule name is required.'), { code: 'VALIDATION_ERROR' });
            if (!SD.Schedule.validTime(draft.startTime) || !SD.Schedule.validTime(draft.endTime)) throw Object.assign(new Error(`Schedule '${draft.name}' must use HH:MM:SS.`), { code: 'VALIDATION_ERROR' });
            try {
              new Intl.DateTimeFormat('en-US', { timeZone: draft.timeZone }).format();
            } catch {
              throw Object.assign(new Error(`Schedule '${draft.name}' has an invalid timezone.`), { code: 'VALIDATION_ERROR' });
            }
            if ((draft.days || []).some(d => !Number.isInteger(Number(d)) || Number(d) < 0 || Number(d) > 6)) throw Object.assign(new Error(`Schedule '${draft.name}' has an invalid day.`), { code: 'VALIDATION_ERROR' });
            const liveIdx = p.schedules.findIndex(x => x.id === draft.id);
            if (liveIdx >= 0) p.schedules[liveIdx] = draft;
            else p.schedules.push(draft);
            await A.save(false, 'none');
            A.discardScheduleEdit?.();
            A.renderPage();
            A.toast('Schedule saved.', 'success');
            return;
          }
          if (act === 'delete-schedule') {
            if (!sc || !confirm(`Delete schedule "${sc.name}"?`)) return;
            p.schedules = p.schedules.filter(x => x.id !== sc.id);
            let disabled = 0;
            for (const rr of p.rules) {
              if (rr.schedule?.mode === 'scheduled') {
                rr.schedule.scheduleIds = (rr.schedule.scheduleIds || []).filter(id => id !== sc.id);
                if (!rr.schedule.scheduleIds.length && rr.enabled) {
                  rr.enabled = false;
                  disabled++;
                }
                touchRule(rr);
              }
            }
            A.discardScheduleEdit?.();
            await A.save();
            if (disabled) A.toast(`${disabled} rule(s) disabled because their schedule was removed.`, 'info');
            return;
          }
          if (act === 'save-polling') {
            const unit = A.$('pollUnit').value;
            p.monitoring.intervalSeconds = seconds(A.$('pollInterval').value, unit, L.POLL_MIN_SECONDS, L.POLL_MAX_SECONDS);
            p.monitoring.intervalUnit = unit;
            p.monitoring.pollJitterPercent = clamp(A.$('pollJitter').value, 0, L.POLL_JITTER_MAX);
            p.runtime.nextCycleAt = null;
            await A.save();
            A.toast('Polling saved.');
            return;
          }
          if (act === 'settings-target') {
            A.ensureSettingsDraft().appearance.openTarget = b.dataset.target === 'sidepanel' ? 'sidepanel' : 'popup';
            A.renderPage();
            return;
          }
          if (act === 'cancel-settings') {
            A.resetSettingsDraft();
            A.renderPage();
            return;
          }
          if (act === 'save-settings') {
            const d = A.ensureSettingsDraft(),
              alarm = storeAlarmDraft(alarmConfigFromControls()),
              alarmFile = A.$('alarmFile')?.files?.[0],
              safety = { ...SD.Defaults.safety(), ...(d.system?.safety || {}) },
              se = SD.Validators.validateSafety(safety);
            if (se.length) throw new Error(se[0]);
            const au = d.system?.activityRefreshUnit || 'seconds',
              av = Number(d.system?.activityRefreshValue ?? SD.Utils.timeFromSeconds(d.system?.activityRefreshSeconds || 3, au)),
              activitySeconds = seconds(av, au, L.ACTIVITY_REFRESH_MIN_SECONDS, L.ACTIVITY_REFRESH_MAX_SECONDS),
              system = { safety, activityRefreshSeconds: activitySeconds, activityRefreshUnit: au, completionToneEnabled: d.system?.completionToneEnabled !== false };
            let autoSync = null;
            if (s) {
              const unit = d.autoSync?.unit || 'hours',
                raw = Number(d.autoSync?.intervalValue ?? SD.Utils.timeFromSeconds(d.autoSync?.intervalSeconds || 3600, unit));
              autoSync = {
                ...(s.inventorySettings?.autoSync || {}),
                ...d.autoSync,
                enabled: Boolean(d.autoSync?.enabled),
                intervalSeconds: seconds(raw, unit, L.METADATA_SYNC_MIN_SECONDS, L.METADATA_SYNC_MAX_SECONDS),
                unit,
                lastRunAt: s.inventorySettings?.autoSync?.lastRunAt || null,
                nextRunAt: null
              };
              delete autoSync.intervalValue;
              const ae = SD.Validators.validateAutoSync(autoSync);
              if (ae.length) throw new Error(ae[0]);
            }
            if (alarmFile) {
              if (alarmFile.size > L.CUSTOM_SOUND_MAX_BYTES) throw new Error(`Custom sound must be ${L.CUSTOM_SOUND_MAX_BYTES / 1024 / 1024} MB or smaller.`);
              alarm.customDataUrl = await A.fileDataUrl(alarmFile);
              alarm.customName = alarmFile.name;
              alarm.useCustom = true;
              d.alarm = { ...alarm };
            }
            const target = d.appearance?.openTarget || 'popup',
              previousTarget = A.state?.appearance?.openTarget || 'popup',
              openSidePanelNow = target === 'sidepanel' && previousTarget !== 'sidepanel',
              sidePanelOpen = openSidePanelNow && chrome.sidePanel?.open
                ? chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).then(() => true).catch(() => false)
                : Promise.resolve(true);
            A.state = await commitSettingsDraft({ system, siteId: s?.id || '', profileId: p?.id || '', autoSync, alarm, openTarget: target });
            const sidePanelOpened = await sidePanelOpen;
            A.settingsDraft = null;
            A.scheduleHomeRefresh?.();
            A.renderShell();
            A.renderPage();
            A.toast(sidePanelOpened ? 'Settings saved.' : 'Settings saved, but the side panel could not open.', sidePanelOpened ? 'success' : 'error');
            return;
          }
          if (act === 'edit-alarm-profile') {
            const profile = A.profile(), id = b.dataset.id;
            if (!profile?.alarmProfiles?.some(x => x.id === id)) return;
            A.alarmProfileDraftId = id;
            A.alarmDraft = null;
            A.renderPage();
            return;
          }
          if (act === 'close-alarm-profile') {
            A.alarmProfileDraftId = '';
            A.alarmDraft = null;
            A.renderPage();
            return;
          }
          if (act === 'duplicate-alarm-profile') {
            const profile = A.profile(), source = profile?.alarmProfiles?.find(x => x.id === b.dataset.id);
            if (!profile || !source) return;
            const copy = structuredClone(source);
            copy.id = crypto.randomUUID();
            copy.name = `${source.name || 'Alarm Profile'} Copy`;
            profile.alarmProfiles = [...(profile.alarmProfiles || []), copy];
            await A.save(false, 'none');
            A.renderPage();
            A.toast(`Duplicated as ${copy.name}.`, 'success');
            return;
          }
          if (act === 'set-default-alarm-profile') {
            const profile = A.profile(), id = b.dataset.id || A.alarmProfileDraftId;
            if (!profile?.alarmProfiles?.some(x => x.id === id)) return;
            profile.defaultAlarmProfileId = id;
            await A.save(false, 'none');
            A.renderPage();
            A.toast('Default Alarm Profile updated.');
            return;
          }
          if (act === 'save-alarm') {
            const profile=A.profile(); if(!profile) return; const cfg=alarmConfigFromControls(), file=A.$('alarmFile')?.files?.[0];
            if(file){ if(file.size>L.CUSTOM_SOUND_MAX_BYTES) throw new Error(`Custom sound must be ${L.CUSTOM_SOUND_MAX_BYTES/1024/1024} MB or smaller.`); cfg.customDataUrl=await A.fileDataUrl(file); cfg.customName=file.name; cfg.useCustom=true; }
            profile.alarmProfiles=profile.alarmProfiles||[]; const i=profile.alarmProfiles.findIndex(x=>x.id===cfg.id); if(i>=0) profile.alarmProfiles[i]={...profile.alarmProfiles[i],...cfg}; else profile.alarmProfiles.push(cfg); if(!profile.defaultAlarmProfileId) profile.defaultAlarmProfileId=cfg.id; A.alarmProfileDraftId=cfg.id; A.alarmDraft=null; A.settingsDraft=null; await A.save(false,'none'); A.renderPage(); A.toast('Alarm Profile saved.'); return;
          }
          if (act === 'choose-alarm-file') { A.$('alarmFile')?.click(); return; }
          if (act === 'new-alarm-profile') {
            const profile = A.profile(); if (!profile) return; const next = { ...(SD.Defaults.profile().alarmProfiles?.[0] || {}), id: crypto.randomUUID(), name: `Alarm Profile ${(profile.alarmProfiles || []).length + 1}` }; profile.alarmProfiles = [...(profile.alarmProfiles || []), next]; A.alarmProfileDraftId = next.id; A.alarmDraft = null; await A.save(false,'none'); A.renderPage(); return;
          }
          if (act === 'delete-alarm-profile') {
            const profile=A.profile(); if (!profile || (profile.alarmProfiles||[]).length<=1) return; profile.alarmProfiles = profile.alarmProfiles.filter(x=>x.id!==A.alarmProfileDraftId); if (profile.defaultAlarmProfileId===A.alarmProfileDraftId) profile.defaultAlarmProfileId=profile.alarmProfiles[0]?.id||''; for (const rule of profile.rules||[]) for (const action of rule.actions||[]) if(action.alarmProfileId===A.alarmProfileDraftId) action.alarmProfileId=profile.defaultAlarmProfileId; A.alarmProfileDraftId=''; A.alarmDraft=null; await A.save(false,'none'); A.renderPage(); return;
          }
          if (act === 'test-alarm') {
            const file = A.$('alarmFile')?.files?.[0], cfg = alarmConfigFromControls();
            if (file) {
              if (file.size > L.CUSTOM_SOUND_MAX_BYTES) throw new Error(`Custom sound must be ${L.CUSTOM_SOUND_MAX_BYTES / 1024 / 1024} MB or smaller.`);
              cfg.customDataUrl = await A.fileDataUrl(file);
              cfg.customName = file.name;
              cfg.useCustom = true;
            }
            storeAlarmDraft(cfg);
            const preview = { ...cfg };
            if (!preview.useCustom) preview.customDataUrl = '';
            await A.send(MESSAGE.PLAY_ALARM, { alarm: preview, meta: alarmTestMeta() });
            return;
          }
          if (act === 'clear-custom-alarm') {
            const cfg = { ...alarmConfigFromControls(), customDataUrl: '', customName: '', useCustom: false };
            storeAlarmDraft(cfg);
            A.renderPage();
            return;
          }
          if (act === 'new-profile') {
            const name = A.$('newProfileName').value.trim() || `Profile ${A.state.profiles.length + 1}`,
              np = SD.Defaults.profile(name, s);
            A.state.profiles.push(np);
            s.activeProfileId = np.id;
            A.state.activeProfileId = np.id;
            await A.save();
            return;
          }
          if (act === 'select-profile') {
            A.discardRuleEdit?.();
            A.state = (await A.send(MESSAGE.SET_ACTIVE_PROFILE, { profileId: b.dataset.id })).state;
            A.selectedRuleId = '';
            A.discardScheduleEdit?.();
            A.alarmDraft = null;
            A.renderShell();
            A.renderPage();
            return;
          }
          if (act === 'duplicate-profile') {
            const stored = (A.state.profiles || []).find(x => x.id === b.dataset.id && x.siteId === s?.id);
            if (!stored) throw new Error('Profile not found.');
            const copy = duplicateProfileObject(stored, A.state.profiles || []);
            A.state.profiles.push(copy);
            await A.save(false, 'all-profiles');
            A.toast(`Duplicated as ${copy.name}. Monitoring is off in the copy until you enable it.`, 'success');
            A.renderPage();
            return;
          }
          if (act === 'rename-profile') {
            p.name = A.$('profileNameEdit').value.trim() || p.name;
            await A.save();
            return;
          }
          if (act === 'delete-profile') {
            if (!confirm(`Delete profile "${p.name}" and its runtime data?`)) return;
            const securityAuthToken = await A.requestSecurityReauth('delete this profile and its runtime data');
            A.state = (await A.send(MESSAGE.DELETE_PROFILE, { profileId: p.id, securityAuthToken })).state;
            await A.load();
            return;
          }
          if (act === 'export-profile') {
            await A.exportProfile(false);
            return;
          }
          if (act === 'export-secure') {
            await A.exportProfile(true);
            return;
          }
          if (act === 'import-profile') {
            A.$('importFile').click();
            return;
          }
          if (act === 'apply-import') {
            const securityAuthToken = await A.requestSecurityReauth('apply this imported profile backup');
            await A.applyImport(securityAuthToken);
            return;
          }
          if (act === 'cancel-import') {
            A.pendingImport = null;
            A.renderPage();
            return;
          }
          if (act === 'refresh-health') {
            await A.send(MESSAGE.REFRESH_HEALTH, { siteId: s.id });
            await A.send(MESSAGE.REFRESH_TAB_STATUS, { siteId: s.id });
            await A.load();
            A.serverEditId = A.page === 'servers' ? s.id : A.serverEditId;
            return;
          }
          if (act === 'theme-draft') {
            A.appearanceDraftTheme = b.dataset.theme;
            document.documentElement.dataset.theme = A.appearanceDraftTheme;
            A.renderPage();
            return;
          }
          if (act === 'save-appearance') {
            const theme = A.appearanceDraftTheme || A.state.appearance?.theme || 'emerald-glass';
            A.state = (await A.send(MESSAGE.UPDATE_APPEARANCE, { appearance: { theme } })).state;
            A.appearanceDraftTheme = null;
            A.applyTheme();
            A.renderPage();
            A.toast('Appearance saved.');
            return;
          }
          if (act === 'cancel-appearance') {
            A.appearanceDraftTheme = null;
            A.applyTheme();
            A.renderPage();
            return;
          }
          if (act === 'settings-back') {
            const target = A.settingsBackTarget || { section: 'general', automationSection: 'sync' };
            A.settingsSection = target.section || 'general';
            A.settingsAutomationSection = target.automationSection || 'sync';
            A.settingsBackTarget = null;
            A.setPage('settings');
            return;
          }
          if (act === 'settings-section') {
            A.settingsSection = b.dataset.section || 'general';
            A.renderPage();
            return;
          }
          if (act === 'automation-settings-section') {
            A.settingsAutomationSection = ['sync', 'safety'].includes(b.dataset.section) ? b.dataset.section : 'sync';
            A.renderPage();
            return;
          }
          if (act === 'save-log-level') {
            const logLevel = A.$('logLevel').value;
            A.state = (await A.send(MESSAGE.UPDATE_SYSTEM, { system: { logLevel } })).state;
            A.renderPage();
            return;
          }
          if (act === 'export-logs') {
            SD.Utils.downloadJson(`SD-Companion-Logs-${new Date().toISOString().slice(0, 10)}.json`, A.logs);
            return;
          }
          if (act === 'export-audit') {
            SD.Utils.downloadJson(`SD-Companion-Audit-${new Date().toISOString().slice(0, 10)}.json`, A.audit);
            return;
          }
          if (act === 'clear-logs') {
            const securityAuthToken = await A.requestSecurityReauth('clear the logs');
            await A.send(MESSAGE.CLEAR_LOGS, { securityAuthToken });
            A.logs = [];
            A.renderPage();
            return;
          }
          if (act === 'clear-audit') {
            const securityAuthToken = await A.requestSecurityReauth('clear the audit journal');
            await A.send(MESSAGE.CLEAR_AUDIT, { securityAuthToken });
            A.audit = [];
            A.renderPage();
            return;
          }
          if (act === 'clear-cache') {
            if (!confirm('Clear synchronized metadata for the current server?')) return;
            const securityAuthToken = await A.requestSecurityReauth('clear synchronized metadata for this server');
            A.state = (await A.send(MESSAGE.CLEAR_CACHE, { siteId: s.id, securityAuthToken })).state;
            A.renderShell();
            A.renderPage();
            return;
          }
          if (act === 'clear-profile-data') {
            if (!confirm('Clear runtime counters, cursors, jobs and ledger for this profile?')) return;
            const securityAuthToken = await A.requestSecurityReauth('clear runtime data for this profile');
            A.state = (await A.send(MESSAGE.CLEAR_PROFILE_DATA, { profileId: p.id, securityAuthToken })).state;
            A.renderPage();
            return;
          }
          if (act === 'factory-reset') {
            if (!confirm('Erase all SD Companion servers, PATs, profiles, logs, audit data and runtime state?')) return;
            const securityAuthToken = await A.requestSecurityReauth('erase all SD Companion data');
            A.state = (await A.send(MESSAGE.FACTORY_RESET, { securityAuthToken })).state;
            A.securityStatus = { enabled: false, method: 'password', sessionMinutes: 30, unlocked: true, unlockedUntil: null };
            A.pendingImport = null;
            A.selectedRuleId = '';
            A.serverEditId = '';
            await A.load();
            return;
          }
          if (act === 'security-set-passcode') {
            const method = A.$('securityMethod')?.value === 'pin' ? 'pin' : 'password',
              passcode = A.$('securityNewPasscode')?.value || '',
              confirmPass = A.$('securityConfirmPasscode')?.value || '',
              unit = A.$('securitySessionUnit')?.value || 'minutes',
              raw = Number(A.$('securitySessionValue')?.value || 30),
              sessionMinutes = Math.round(raw * (unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1));
            if (passcode !== confirmPass) throw new Error('PIN/password confirmation does not match.');
            const securityAuthToken = A.securityStatus?.enabled ? await A.requestSecurityReauth('change the extension passcode') : '';
            const r = await A.send(MESSAGE.SET_SECURITY_PASSCODE, { method, passcode, sessionMinutes, securityAuthToken });
            A.securityStatus = r.security;
            A.scheduleSecurityRelock?.(A.securityStatus);
            A.renderPage();
            A.toast(A.securityStatus.enabled ? 'Extension lock saved.' : 'Extension lock updated.', 'success');
            return;
          }
          if (act === 'security-save-timeout') {
            const unit = A.$('securitySessionUnit')?.value || 'minutes',
              raw = Number(A.$('securitySessionValue')?.value || 30),
              sessionMinutes = Math.round(raw * (unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1)),
              securityAuthToken = await A.requestSecurityReauth('change the unlock session timeout'),
              r = await A.send(MESSAGE.UPDATE_SECURITY_SETTINGS, { sessionMinutes, securityAuthToken });
            A.securityStatus = r.security;
            A.scheduleSecurityRelock?.(A.securityStatus);
            A.renderPage();
            A.toast('Unlock session timeout saved.', 'success');
            return;
          }
          if (act === 'security-lock-now') {
            const r = await A.send(MESSAGE.LOCK_EXTENSION);
            A.securityStatus = r.security;
            A.showSecurityLock?.();
            return;
          }
          if (act === 'security-disable') {
            if (!confirm('Disable the SD Companion extension lock?')) return;
            const securityAuthToken = await A.requestSecurityReauth('disable the extension lock'),
              r = await A.send(MESSAGE.DISABLE_SECURITY, { securityAuthToken });
            A.securityStatus = r.security;
            A.scheduleSecurityRelock?.(A.securityStatus);
            A.renderPage();
            A.toast('Extension lock disabled.', 'info');
            return;
          }
          if (act === 'help-jump') {
            document.getElementById(`help-${b.dataset.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        });
      } catch (err) {
        if (!['OPERATION_CANCELLED', 'SECURITY_AUTH_CANCELLED'].includes(err.code)) {
          A.toast(err.message, 'error');
          // The failure is handled by the toast and SD Companion logger above.
          // Do not mirror handled operational errors into Chrome's extension Errors console.
        }
      }
    });
    A.$('importFile')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        if (file.size > L.PROFILE_IMPORT_MAX_BYTES) throw new Error('Profile file is too large.');
        await A.prepareImport(JSON.parse(await file.text()));
      } catch (err) {
        A.toast(err.message, 'error');
      } finally {
        e.target.value = '';
      }
    });
  };
})();
