(() => {
  const A = globalThis.SDApp, SD = globalThis.SDCompanion, { head } = A.View;
  const journalRows = () => [
    ...(A.logs || []).map(row => ({ ...row, journalKind: 'LOG' })),
    ...(A.audit || []).map(row => ({ ...row, journalKind: 'AUDIT', level: row.level || 'info' }))
  ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());

  const renderJournalRows = rows => rows.map(row => {
    const title = row.message || row.event || 'Event',
      context = row.issueKey || row.ruleName || row.siteId || '',
      detailMessage = row.details?.message || row.details?.error?.message || '',
      meta = [context, detailMessage].filter(Boolean).join(' · ');
    return `<div class="log-line level-${A.esc(row.level || 'info')}">` +
      `<div class="row-between">` +
      `<div class="row journal-title"><span class="journal-kind">${A.esc(row.journalKind)}</span><b>${A.esc(title)}</b></div>` +
      `<span class="muted">${A.esc(SD.Utils.formatDateTime(row.at))}</span>` +
      `</div>` +
      `${meta ? `<div class="list-meta">${A.esc(meta)}</div>` : ''}` +
      `</div>`;
  }).join('') || '<div class="empty">No activity recorded.</div>';

  A.pageLogs = () => `<section class="page">${head('Activity Journal', '', `<div class="row"><button class="btn btn-small" data-action="export-journal">Export JSON</button><button class="btn btn-small btn-danger" data-action="clear-journal">Clear</button></div>`)}` +
    `<div class="card journal-settings-card"><div class="field"><label>Diagnostic log level</label><select id="logLevel" class="select">${SD.Constants.LOG_LEVELS.map(x => A.option(x, x.toUpperCase(), A.state.system?.logLevel === x)).join('')}</select></div><button class="btn btn-small" data-action="save-log-level">Save Level</button></div>` +
    `<div class="card log-panel">${renderJournalRows(journalRows().slice(0, 1200))}</div></section>`;

  // Preserve the old route for any already-open extension surface, but both
  // diagnostics now render through the single Activity Journal page.
  A.pageAudit = A.pageLogs;
  A.pageMaintenance = () => {
    const s = A.site(), p = A.profile();
    return `<section class="page">${head('Data Maintenance')}<div class="card maintenance-card">` +
      `<div class="section-title">Synchronized cache</div>` +
      `<button class="btn section-gap" data-action="clear-cache" ${s ? '' : 'disabled'}>Clear Current Server Cache</button>` +
      `</div>` +
      `<div class="card maintenance-card">` +
      `<div class="section-title">Profile runtime data</div>` +
      `<button class="btn section-gap" data-action="clear-profile-data" ${p ? '' : 'disabled'}>Clear Current Profile Runtime Data</button>` +
      `</div>` +
      `<div class="card maintenance-card danger-zone">` +
      `<div class="section-title">Factory reset</div>` +
      `<button class="btn btn-danger section-gap" data-action="factory-reset">Erase All SD Companion Data</button>` +
      `</div>` +
      `</section>`;
  };
  A.pageSettings = () => {
    const section = A.settingsSection || 'general',
      draft = A.ensureSettingsDraft(),
      target = draft.appearance.openTarget || 'popup',
      site = A.site(),
      profile = A.profile(),
      safe = { ...SD.Defaults.safety(), ...(draft.system?.safety || {}) },
      auto = { ...SD.Defaults.inventorySettings().autoSync, ...(draft.autoSync || {}) },
      alarm = { ...(draft.alarm || {}) };
    const icon = id => ({
      general: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>',
      automation: '<svg viewBox="0 0 24 24"><path d="M7 4v4M17 16v4M4 7h6M14 17h6"/><rect x="8" y="7" width="8" height="10" rx="3"/><path d="M10.5 10.5h3M10.5 13.5h3"/></svg>',
      security: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1.5"/></svg>',
      support: '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/><circle cx="17" cy="15" r="2"/></svg>'
    }[id] || '');
    const nav = (id, label) => `<button class="settings-page-tab ${section === id ? 'active' : ''}" data-action="settings-section" data-section="${id}" role="tab" aria-selected="${section === id ? 'true' : 'false'}"><span>${label}</span></button>`;
    const link = (page, label, kind = '') => `<button class="settings-tile ${kind}" data-page="${page}"><span><b>${label}</b></span><svg class="settings-chevron" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>`;
    const unitOptions = (u, units = ['seconds', 'minutes', 'hours']) => units.map(x => A.option(x, x[0].toUpperCase() + x.slice(1), u === x)).join('');
    const unitBounds = (minSeconds, maxSeconds, unit) => {
      const div = unit === 'hours' ? 3600 : unit === 'minutes' ? 60 : 1;
      return { min: Math.max(1, Math.ceil(minSeconds / div)), max: Math.max(1, Math.floor(maxSeconds / div)) };
    };
    let title = 'General', body = '';
    if (section === 'general') {
      title = 'General';
      body = `<div class="settings-card">` +
        `<div class="settings-card-head">` +
        `<span class="settings-card-icon">${icon('general')}</span>` +
        `<b>Opening mode</b>` +
        `</div>` +
        `<div class="surface-mode-control">` +
        `<button class="surface-mode-option ${target === 'popup' ? 'active' : ''}" data-action="settings-target" data-target="popup">` +
        `<span class="surface-mode-dot">` +
        `</span>` +
        `<strong>Popup</strong>` +
        `</button>` +
        `<button class="surface-mode-option ${target === 'sidepanel' ? 'active' : ''}" data-action="settings-target" data-target="sidepanel">` +
        `<span class="surface-mode-dot">` +
        `</span>` +
        `<strong>Side Panel</strong>` +
        `</button>` +
        `</div>` +
        `</div>` +
        `<div class="settings-tile-grid">${link('appearance', 'Appearance')}${link('profiles', 'Profiles')}${link('alarms', 'Alarm Profiles')}</div>` +
        '';
    }
    else if (section === 'automation') {
      title = 'Automation';
      const automationSection = A.settingsAutomationSection || 'sync',
        v = auto.intervalValue ?? SD.Utils.timeFromSeconds(auto.intervalSeconds, auto.unit),
        activityUnit = draft.system.activityRefreshUnit || 'seconds',
        activityValue = draft.system.activityRefreshValue ?? SD.Utils.timeFromSeconds(draft.system.activityRefreshSeconds || 3, activityUnit),
        autoBounds = unitBounds(SD.Constants.LIMITS.METADATA_SYNC_MIN_SECONDS, SD.Constants.LIMITS.METADATA_SYNC_MAX_SECONDS, auto.unit || 'hours'),
        activityBounds = unitBounds(SD.Constants.LIMITS.ACTIVITY_REFRESH_MIN_SECONDS, SD.Constants.LIMITS.ACTIVITY_REFRESH_MAX_SECONDS, activityUnit),
        automationTab = (id, label) => `<button type="button" class="settings-subpage-tab ${automationSection === id ? 'active' : ''}" data-action="automation-settings-section" data-section="${id}" role="tab" aria-selected="${automationSection === id ? 'true' : 'false'}">${label}</button>`;

      let automationBody = '';
      if (automationSection === 'sync') {
        automationBody = `<div class="settings-card">` +
          `<div class="settings-card-head">` +
          `<span class="settings-card-icon">${icon('automation')}</span><b>Metadata synchronization</b>${site ? `<span class="freshness-chip">${A.esc(site.name)}</span>` : ''}</div>` +
          `<div class="setting-line">` +
          `<span>Periodic project-data sync</span>` +
          `<label class="master-switch">` +
          `<input type="checkbox" data-settings-prop="autoSync.enabled" ${auto.enabled ? 'checked' : ''} ${site ? '' : 'disabled'}>` +
          `<span></span>` +
          `</label>` +
          `</div>` +
          `<div class="time-value-row">` +
          `<div class="field">` +
          `<label>Interval</label>` +
          `<input class="input" type="number" step="1" data-settings-prop="autoSync.intervalValue" min="${autoBounds.min}" max="${autoBounds.max}" value="${A.esc(v)}" ${site ? '' : 'disabled'}>` +
          `</div>` +
          `<div class="field time-unit-field">` +
          `<label>Unit</label>` +
          `<select class="select" data-settings-prop="autoSync.unit" ${site ? '' : 'disabled'}>${unitOptions(auto.unit)}</select>` +
          `</div>` +
          `</div>` +
          `${site ? `<div class="settings-inline-meta"><span>Last ${A.esc(SD.Utils.formatDateTime(auto.lastRunAt || site.inventory?.lastFullSyncAt))}</span><span>Next ${A.esc(SD.Utils.formatDateTime(auto.nextRunAt))}</span></div>` : ''}` +
          `</div>` +
          `<div class="settings-card">` +
          `<div class="settings-card-head">` +
          `<span class="settings-card-icon">${icon('automation')}</span>` +
          `<b>Operational feedback</b>` +
          `</div>` +
          `<div class="automation-feedback-grid">` +
          `<div class="time-value-row">` +
          `<div class="field">` +
          `<label>Home history refresh</label>` +
          `<input class="input" type="number" step="1" data-settings-prop="system.activityRefreshValue" min="${activityBounds.min}" max="${activityBounds.max}" value="${A.esc(activityValue)}">` +
          `</div>` +
          `<div class="field time-unit-field">` +
          `<label>Unit</label>` +
          `<select class="select" data-settings-prop="system.activityRefreshUnit">${unitOptions(activityUnit, ['seconds', 'minutes'])}</select>` +
          `</div>` +
          `</div>` +
          `<div class="completion-tone-control setting-line setting-line-card">` +
          `<span>Action Completion Tone</span>` +
          `<label class="master-switch" title="Action Completion Tone">` +
          `<input type="checkbox" data-settings-prop="system.completionToneEnabled" ${draft.system.completionToneEnabled !== false ? 'checked' : ''}>` +
          `<span></span>` +
          `</label>` +
          `</div>` +
          `</div>` +
          `</div>` +
          `<div class="settings-tile-grid">${link('schedules', 'Schedules & Polling')}</div>`;
      }
      else if (automationSection === 'safety') {
        automationBody = `<div class="settings-card">` +
          `<div class="settings-card-head">` +
          `<span class="settings-card-icon">${icon('automation')}</span>` +
          `<b>Global safety limits</b>` +
          `</div>` +
          `<div class="grid-3 compact-settings-grid automation-safety-grid">` +
          `<div class="field"><label>Issues / cycle</label><input class="input" type="number" min="1" max="${SD.Constants.LIMITS.RULE_MAX_ISSUES}" data-settings-prop="system.safety.maxIssuesPerCycle" value="${safe.maxIssuesPerCycle}"></div>` +
          `<div class="field"><label>Actions / cycle</label><input class="input" type="number" min="1" max="${SD.Constants.LIMITS.RULE_MAX_ACTIONS}" data-settings-prop="system.safety.maxActionsPerCycle" value="${safe.maxActionsPerCycle}"></div>` +
          `<div class="field"><label>Comments / hour</label><input class="input" type="number" min="0" max="${SD.Constants.LIMITS.RULE_MAX_HOURLY}" data-settings-prop="system.safety.maxCommentsPerHour" value="${safe.maxCommentsPerHour}"></div>` +
          `<div class="field"><label>Assignments / hour</label><input class="input" type="number" min="0" max="${SD.Constants.LIMITS.RULE_MAX_HOURLY}" data-settings-prop="system.safety.maxAssignmentsPerHour" value="${safe.maxAssignmentsPerHour}"></div>` +
          `<div class="field"><label>Transitions / hour</label><input class="input" type="number" min="0" max="${SD.Constants.LIMITS.RULE_MAX_HOURLY}" data-settings-prop="system.safety.maxTransitionsPerHour" value="${safe.maxTransitionsPerHour}"></div>` +
          `</div>` +
          `</div>`;
      }
      else automationBody = '';

      body = `<div class="settings-subpage-nav" role="tablist" aria-label="Automation settings sections">` +
        `${automationTab('sync', 'Sync & Refresh')}` +
        `${automationTab('safety', 'Safety Limits')}` +
        `</div>` +
        `<div class="settings-subpage">${automationBody}</div>`;
    }
    else if (section === 'security') {
      title = 'Security';
      const sec = A.securityStatus || { enabled: false, method: 'password', sessionMinutes: 30, unlocked: true },
        mins = Math.max(1, Number(sec.sessionMinutes) || 30),
        sessionUnit = mins % 1440 === 0 ? 'days' : mins % 60 === 0 ? 'hours' : 'minutes',
        sessionValue = sessionUnit === 'days' ? mins / 1440 : sessionUnit === 'hours' ? mins / 60 : mins,
        label = sec.method === 'pin' ? 'PIN' : 'Password';
      body = `<div class="settings-card security-settings-card">` +
        `<div class="settings-card-head">` +
        `<span class="settings-card-icon">${icon('security')}</span>` +
        `<b>Extension lock</b>` +
        `<span class="pill ${sec.enabled ? 'good' : 'info'}">${sec.enabled ? 'ENABLED' : 'OFF'}</span>` +
        `</div>` +
        `<div class="security-status-grid">` +
        `<div class="security-status-card">` +
        `<span>Status</span>` +
        `<strong>${sec.enabled ? 'Protected' : 'Not protected'}</strong>` +
        `</div>` +
        `<div class="security-status-card">` +
        `<span>Unlock method</span>` +
        `<strong>${sec.enabled ? label : 'Not set'}</strong>` +
        `</div>` +
        `<div class="security-status-card">` +
        `<span>Session</span>` +
        `<strong>${sec.enabled ? `${A.esc(sessionValue)} ${A.esc(sessionUnit)}` : '—'}</strong>` +
        `</div>` +
        `</div>` +
        `<div class="security-config-grid section-gap">` +
        `<div class="field">` +
        `<label>Unlock method</label>` +
        `<select id="securityMethod" class="select">` +
        `<option value="password" ${sec.method !== 'pin' ? 'selected' : ''}>Password</option>` +
        `<option value="pin" ${sec.method === 'pin' ? 'selected' : ''}>PIN</option>` +
        `</select>` +
        `</div>` +
        `<div class="time-value-row">` +
        `<div class="field">` +
        `<label>Unlock session</label>` +
        `<input id="securitySessionValue" class="input" type="number" min="1" max="10080" step="1" value="${A.esc(sessionValue)}">` +
        `</div>` +
        `<div class="field time-unit-field">` +
        `<label>Unit</label>` +
        `<select id="securitySessionUnit" class="select">` +
        `<option value="minutes" ${sessionUnit === 'minutes' ? 'selected' : ''}>Minutes</option>` +
        `<option value="hours" ${sessionUnit === 'hours' ? 'selected' : ''}>Hours</option>` +
        `<option value="days" ${sessionUnit === 'days' ? 'selected' : ''}>Days</option>` +
        `</select>` +
        `</div>` +
        `</div>` +
        `<div class="field">` +
        `<label>New PIN / password</label>` +
        `<input id="securityNewPasscode" class="input" type="password" maxlength="${SD.Constants.LIMITS.SECURITY_PASSWORD_MAX_CHARS}" autocomplete="new-password" placeholder="${sec.enabled ? 'Enter only to change it' : 'Set a PIN or password'}">` +
        `</div>` +
        `<div class="field">` +
        `<label>Confirm PIN / password</label>` +
        `<input id="securityConfirmPasscode" class="input" type="password" maxlength="${SD.Constants.LIMITS.SECURITY_PASSWORD_MAX_CHARS}" autocomplete="new-password">` +
        `</div>` +
        `</div>` +
        `<div class="row security-settings-actions">` +
        `<button class="btn btn-primary" data-action="security-set-passcode">${sec.enabled ? 'Change Passcode' : 'Enable Lock'}</button>${sec.enabled ? `<button class="btn" data-action="security-save-timeout">Save Session Timeout</button>` +
          `<button class="btn" data-action="security-lock-now">Lock Now</button>` +
          `<button class="btn btn-danger" data-action="security-disable">Disable Lock</button>` : ''}</div>` +
        `</div>`;
    }
    else {
      title = 'System & Support';
      body = `<div class="settings-tile-grid settings-tile-grid-rich">${link('health', 'Compatibility & Permissions')}${link('logs', 'Activity Journal')}${link('maintenance', 'Data Maintenance', 'danger-soft')}${link('help', 'Help & Reference')}</div>`;
    }
    return `<section class="page settings-page">${head('Settings', '', `<div class="row"><button class="btn btn-primary btn-small" data-action="save-settings">Save</button><button class="btn btn-small" data-action="cancel-settings">Reset</button></div>`)}<div class="settings-workspace">` +
      `<div class="settings-tabbar" role="tablist" aria-label="Settings pages">${nav('general', 'General')}${nav('automation', 'Automation')}${nav('security', 'Security')}${nav('support', 'System & Support')}</div>` +
      `<div class="settings-content">` +
      `<div class="settings-content-head">` +
      `<span>${title}</span></div>${body}</div></div></section>`;
  };
})();
