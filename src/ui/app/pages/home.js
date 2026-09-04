(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { JOB } = SD.Constants,
    { head, noServer } = A.View;
  const radarDots = (s, p) => {
    const events = (s?.runtime?.radarMarkers || []).filter(e => !e.profileId || e.profileId === p?.id).slice(0, p?.radar?.maxMarkers || 12);
    let latestId = '';
    for (const e of events) {
      if (!latestId) {
        latestId = e.id;
        continue;
      }
      const cur = events.find(x => x.id === latestId),
        et = new Date(e.at || 0).getTime(),
        ct = new Date(cur?.at || 0).getTime();
      if (et >= ct) latestId = e.id;
    }
    return events.map(e => {
      const h = A.hash(`${e.issueKey}`),
        x = 13 + (h % 74),
        y = 13 + ((h >>> 8) % 74),
        sz = 7 + (h % 5),
        latest = e.id === latestId;
      return `<i class="radar-dot ${latest ? 'radar-dot-latest' : ''}" style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;--dot:${latest ? 'var(--danger)' : 'var(--primary)'}" title="${A.esc(e.issueKey)} · ${A.esc(e.status)}"></i>`;
    }).join('');
  };
  const radar = (s, p, monitoring) => `<div class="radar radar-pro ${monitoring ? 'radar-live' : 'radar-off'}"><i class="radar-axis h"></i><i class="radar-axis v"></i><i class="radar-ring r1"></i><i class="radar-ring r2"></i><i class="radar-ring r3"></i><i class="radar-sweep"></i><i class="radar-core"></i>${radarDots(s, p)}</div>`;
  const detectionRows = rows => (rows || []).slice(0, 12).map(e => `<div class="list-item detection-row">` +
    `<div class="detection-key">${A.esc(e.issueKey || 'Issue')}</div>` +
    `<div class="detection-main">` +
    `<div class="list-title">${A.esc(e.summary || e.issueKey || 'Jira issue')}</div>` +
    `<div class="list-meta">${A.esc(e.status || '')} · ${A.esc(e.ruleName || 'Detected')}</div>` +
    `</div>` +
    `<span class="detection-time">${A.esc(SD.Utils.formatDateTime(e.at))}</span></div>`).join('') || `<div class="empty compact-empty">No detections.</div>`;
  const actionName = a => ({ assign: 'Assignment', comment: 'Comment', transition: 'Transition', 'edit-fields': 'Edit fields', labels: 'Labels', priority: 'Priority', alarm: 'Alarm', notification: 'Notification' }[a] || a || 'Action');
  const dependencyWaiting = j => j.status === 'pending' && Boolean(j.dependsOnJobId) && !j.dependencyScheduled;
  const actionStatus = j => j.status === 'succeeded' ? 'Done' : j.status === 'pending' ? (dependencyWaiting(j) ? 'Waiting' : 'Pending') : j.status === 'running' ? (j.cancelRequestedAt ? 'Cancelling' : 'Running') : j.status === 'failed' ? 'Failed' : j.status === 'cancelled' ? 'Cancelled' : j.status === 'skipped' ? 'Skipped' : j.status || 'Queued';
  const actionTime = j => {
    if (j.status === 'pending' && dependencyWaiting(j)) return `Waiting for previous · estimated ${SD.Utils.formatDateTime(j.scheduledAt)}`;
    return SD.Utils.formatDateTime(j.status === 'pending' ? j.scheduledAt : (j.completedAt || j.startedAt || j.createdAt));
  };
  const actionDetail = (j, site) => {
    const p = j.payload || {}, r = j.result || {};
    if (j.action === 'assign') return p.unassign ? 'Unassign issue' : (r.assignee ? `Assigned to ${r.assignee}` : (p.user ? `Assign to ${p.user.displayName || p.user.name || p.user.key || 'user'}` : 'Assignment'));
    if (j.action === 'comment') {
      const t = String(p.comment || '').replace(/\s+/g, ' ').trim();
      return t ? `Comment: ${t.slice(0, 160)}${t.length > 160 ? '…' : ''}` : 'Comment';
    }
    if (j.action === 'transition') return r.toStatus ? `Transitioned to ${r.toStatus}` : r.transitionName ? `Transition: ${r.transitionName}` : (p.rule?.toStatusId ? `Target status #${p.rule.toStatusId}` : p.rule?.transitionId ? `Transition #${p.rule.transitionId}` : 'Transition');
    if (j.action === 'priority') {
      const pri = (site?.priorities || []).find(x => String(x.id) === String(r.priorityId || p.priorityId));
      return `Priority: ${pri?.name || r.priorityId || p.priorityId || 'configured value'}`;
    }
    if (j.action === 'labels') {
      const add = p.labels?.add || [], remove = p.labels?.remove || [];
      return `${add.length ? `Add ${add.join(', ')}` : ''}${add.length && remove.length ? ' · ' : ''}${remove.length ? `Remove ${remove.join(', ')}` : ''}` || 'Labels';
    }
    if (j.action === 'edit-fields') return 'Edit configured Jira fields';
    if (j.action === 'alarm') return `Alarm: ${p.alarm?.preset || 'configured sound'}`;
    if (j.action === 'notification') return p.notification?.title ? `Notification: ${p.notification.title}` : 'Browser notification';
    return actionName(j.action);
  };
  const issueActivity = (site, profile, recent, current) => {
    const jobs = (A.jobs || []).filter(j => j.siteId === site.id && j.profileId === profile.id),
      map = new Map(),
      seed = [...(current || []), ...(recent || [])];
    for (const d of seed) if (!map.has(d.issueKey)) map.set(d.issueKey, { issueKey: d.issueKey, summary: d.summary || '', status: d.status || '', at: d.at || '', rules: new Set([d.ruleName || d.ruleId].filter(Boolean)), jobs: [] });
    for (const j of jobs) {
      let x = map.get(j.issueKey);
      if (!x) {
        x = { issueKey: j.issueKey, summary: j.issueSnapshot?.summary || '', status: j.issueSnapshot?.status || '', at: j.createdAt || '', rules: new Set(), jobs: [] };
        map.set(j.issueKey, x);
      }
      x.jobs.push(j);
      if (j.ruleName) x.rules.add(j.ruleName);
      if (new Date(j.createdAt || 0) > new Date(x.at || 0)) x.at = j.createdAt;
    }
    const rows = [...map.values()].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 30);
    return rows.map(x => {
      const ordered = x.jobs.sort((a, b) => new Date(a.historyOrderAt || a.createdAt || a.scheduledAt || 0) - new Date(b.historyOrderAt || b.createdAt || b.scheduledAt || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.id || '').localeCompare(String(b.id || ''))),
        done = ordered.filter(j => j.status === 'succeeded').length,
        pendingJobs = ordered.filter(j => j.status === JOB.PENDING),
        pending = ordered.filter(j => [JOB.PENDING, JOB.RUNNING].includes(j.status)).length;
      return `<details class="activity-issue" data-issue-key="${A.esc(x.issueKey)}">` +
        `<summary>` +
        `<span class="detection-key">${A.esc(x.issueKey)}</span>` +
        `<span class="activity-summary">` +
        `<b>${A.esc(x.summary || x.issueKey)}</b>` +
        `<small>${A.esc([...x.rules].join(' · ') || x.status || 'Detected')}</small>` +
        `</span>` +
        `<span class="activity-counts">${done ? `<i class="done">${done} done</i>` : ''}${pending ? `<i class="pending">${pending} pending</i>` : ''}</span>` +
        `</summary>` +
        `<div class="activity-timeline">${pendingJobs.length ? `<div class="activity-bulk-row">` +
          `<span>${pendingJobs.length} upcoming action${pendingJobs.length === 1 ? '' : 's'}</span>` +
          `<div class="row activity-bulk-actions">` +
          `<button type="button" class="btn btn-small btn-primary" data-action="process-issue-jobs" data-issue-key="${A.esc(x.issueKey)}">Process all</button>` +
          `<button type="button" class="btn btn-small btn-danger" data-action="cancel-issue-jobs" data-issue-key="${A.esc(x.issueKey)}">Cancel all</button></div></div>` : ''}${ordered.length ? ordered.map(j => {
            const cancellable = [JOB.PENDING, JOB.RUNNING].includes(j.status),
              processable = j.status === JOB.PENDING,
              requested = j.status === JOB.RUNNING && Boolean(j.cancelRequestedAt);
            return `<div class="activity-action status-${A.esc(j.status)}${requested ? ' cancel-requested' : ''}">` +
              `<span class="activity-action-icon">` +
              `</span>` +
              `<div class="activity-action-copy">` +
              `<b>${A.esc(actionName(j.action))}</b>` +
              `<small>${A.esc(actionStatus(j))} · ${A.esc(actionTime(j))}</small>` +
              `<span class="activity-detail">${A.esc(actionDetail(j, site))}</span>${j.error?.message ? `<em>${A.esc(j.error.message)}</em>` : ''}</div>${cancellable || processable ? `<div class="queue-action-buttons">${processable ? `<button type="button" class="btn btn-small queue-process-btn" data-action="process-job" data-job-id="${A.esc(j.id)}">Process</button>` : ''}${cancellable ? `<button type="button" class="btn btn-small queue-cancel-btn" data-action="cancel-job" data-job-id="${A.esc(j.id)}" ${requested ? 'disabled' : ''}>${requested ? 'Cancelling…' : 'Cancel'}</button>` : ''}</div>` : ''}</div>`;
          }).join('') : '<div class="empty compact-empty">Detected; no actions queued for this issue.</div>'}</div></details>`;
    }).join('') || '<div class="empty compact-empty">No issue activity yet.</div>';
  };
  const detectionCard = (pr, st, view, current, recent) => {
    const shown = view === 'recent' ? recent : current;
    return `<div id="homeDetectionsCard" class="card recent-activity home-live-card">` +
      `<div class="row-between detection-head">` +
      `<div>` +
      `<div class="section-title">Detections</div>` +
      `<div class="list-meta">${view === 'current' ? `Checked ${A.esc(SD.Utils.formatDateTime(pr.currentDetectionsAt))}` : 'Recent history'}</div>` +
      `</div>` +
      `<div class="detection-head-actions">${view === 'current' ? `<button class="btn btn-small" data-action="refresh-current-matches">Check now</button>` : ''}<div class="detection-view-toggle" role="group">` +
      `<button type="button" class="${view === 'current' ? 'active' : ''}" data-action="home-detection-view" data-view="current">Current <span>${current.length}</span>` +
      `</button>` +
      `<button type="button" class="${view === 'recent' ? 'active' : ''}" data-action="home-detection-view" data-view="recent">Recent <span>${recent.length}</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="list compact-list detection-list">${detectionRows(shown)}</div></div>`;
  };
  const activityRefreshLabel = () => {
    const sec = Math.max(SD.Constants.LIMITS.ACTIVITY_REFRESH_MIN_SECONDS, Math.min(SD.Constants.LIMITS.ACTIVITY_REFRESH_MAX_SECONDS, Number(A.state?.system?.activityRefreshSeconds) || 3));
    return sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}m`;
  };
  const activityCard = (s, p, recent, current) => {
    const pending = (A.jobs || []).filter(j => j.siteId === s.id && j.profileId === p.id && j.status === JOB.PENDING).length;
    return `<div id="homeIssueActivityCard" class="card issue-activity-card home-live-card">` +
      `<div class="row-between activity-card-head">` +
      `<div class="section-title">Issue Action History</div>` +
      `<div class="row activity-card-controls">${pending ? `<button type="button" class="btn btn-small btn-primary" data-action="process-all-jobs">Process all (${pending})</button>` +
        `<button type="button" class="btn btn-small btn-danger" data-action="cancel-all-jobs">Cancel all upcoming (${pending})</button>` : ''}<span class="freshness-chip">Auto refresh · ${activityRefreshLabel()}</span>` +
      `</div>` +
      `</div>` +
      `<div class="issue-activity-list section-gap">${issueActivity(s, p, recent, current)}</div></div>`;
  };
  const activeSchedules = p => (p.schedules || []).filter(x => x.enabled && SD.Schedule.isActive(x, new Date()));
  const monitorCard = (s, p) => {
    const st = s.runtime || {},
      pr = p.runtime || {},
      monitor = Boolean(p.monitoring?.enabled),
      hasPat = Boolean(A.credentialStatus?.[s.id]),
      live = monitor && hasPat,
      enabledRules = (p.rules || []).filter(r => r.enabled).length,
      totalRules = (p.rules || []).length;
    return `<div id="homeMonitorCard" class="card radar-monitor-card ${live ? 'monitor-on' : 'monitor-off'}">` +
      `<div class="monitor-compact-grid">` +
      `<div class="radar-stage">${radar(s, p, live)}</div>` +
      `<div class="monitor-compact-side">` +
      `<div class="radar-monitor-head">` +
      `<div class="monitor-state">` +
      `<span class="monitor-light">` +
      `</span>` +
      `<div>` +
      `<div class="monitor-label">Monitoring</div>` +
      `<strong data-home-monitor-state>${monitor ? (hasPat ? 'ON' : 'ON · PAT REQUIRED') : 'OFF'}</strong>` +
      `</div>` +
      `</div>` +
      `<div class="radar-monitor-controls">` +
      `<button class="btn btn-primary btn-small" data-action="run-cycle" ${hasPat ? '' : 'disabled'}>Scan Now</button>` +
      `<label class="master-switch" title="Continuous rule polling">` +
      `<input id="homeMonitor" type="checkbox" ${monitor ? 'checked' : ''}>` +
      `<span>` +
      `</span>` +
      `</label>` +
      `</div>` +
      `</div>` +
      `<div class="compact-radar-stats">` +
      `<div>` +
      `<strong data-home-stat="detected">${pr.lastDetectionCount || 0}</strong>` +
      `<span>Detected</span>` +
      `</div>` +
      `<div>` +
      `<strong data-home-stat="actions">${pr.lastPlanCount || 0}</strong>` +
      `<span>Actions</span>` +
      `</div>` +
      `<div>` +
      `<strong data-home-stat="evaluated">${st.lastIssueCount || 0}</strong>` +
      `<span>Evaluated</span>` +
      `</div>` +
      `</div>` +
      `<div class="monitor-timing">` +
      `<span data-home-monitor-next>${monitor ? (hasPat ? 'Next ' + A.esc(SD.Utils.formatDateTime(pr.nextCycleAt)) : 'PAT required') : 'Monitoring stopped'}</span>` +
      `<span data-home-rule-count>${enabledRules}/${totalRules} rules</span></div></div></div></div>`;
  };
  const shiftCard = p => {
    const active = activeSchedules(p),
      names = active.map(x => x.name).filter(Boolean),
      label = names.length ? names.join(', ') : 'No active shift';
    return `<div id="homeShiftCard" class="card home-shift-card ${active.length ? 'active' : 'inactive'}">` +
      `<div class="shift-card-icon">` +
      `<span>` +
      `</span>` +
      `</div>` +
      `<div class="shift-card-copy">` +
      `<span>Active shift</span>` +
      `<strong>${A.esc(label)}</strong>` +
      `<small>${active.length ? `${active.length} schedule${active.length === 1 ? '' : 's'} currently active` : 'No saved schedule currently matches this time'}</small>` +
      `</div>` +
      `<span class="pill ${active.length ? 'good' : 'neutral'}">${active.length ? 'ACTIVE' : 'NONE'}</span></div>`;
  };
  const healthCards = (s, p) => {
    const st = s.runtime || {},
      pr = p.runtime || {},
      hasPat = Boolean(A.credentialStatus?.[s.id]),
      healthy = Boolean(hasPat && st.apiHealthy);
    return `${hasPat ? '' : `<div class="notice warn credential-missing-notice home-credential-notice">` +
      `<b>PAT missing</b>` +
      `<span>This imported server has no stored PAT. API monitoring, health checks, synchronization and connection-loss alarms are paused.</span>` +
      `<button class="btn btn-small" data-action="go-servers">Configure PAT</button>` +
      `</div>`}<div id="homeOperationalHealth" class="grid-3 operational-health">` +
      `<div class="status-tile ${!hasPat ? 'warning' : healthy ? 'ok' : 'error'}">` +
      `<span>API</span>` +
      `<strong>${!hasPat ? 'PAT MISSING' : healthy ? 'ONLINE' : 'OFFLINE'}</strong>` +
      `<small>${hasPat ? A.esc(st.lastTransport || '') : 'Credentials required'}</small>` +
      `</div>` +
      `<div class="status-tile">` +
      `<span>Last cycle</span>` +
      `<strong>${A.esc(SD.Utils.formatDateTime(pr.lastCycleAt || st.lastCycleAt))}</strong>` +
      `<small>${!hasPat ? 'Paused until PAT is configured' : st.lastError ? A.esc(st.lastError) : 'No engine error'}</small>` +
      `</div>` +
      `<div class="status-tile">` +
      `<span>Requests</span>` +
      `<strong>${st.apiStats?.requests || 0}</strong>` +
      `<small>${st.apiStats?.failures || 0} failed</small></div></div>`;
  };
  const alarmCard = () => {
    const active = A.state?.runtime?.activeAlarm;
    if (!active?.active) return `<div id="homeAlarmSlot" class="home-alarm-slot"></div>`;
    const connectionAlarm = active.source === 'Connection monitor',
      label = active.issueKey || (connectionAlarm ? 'API Unreachable' : active.source || active.ruleName || 'Alarm');
    return `<div id="homeAlarmSlot" class="home-alarm-slot">` +
      `<div class="card alarm-live-panel">` +
      `<div>` +
      `<span class="pill bad">ALARM ACTIVE</span>` +
      `<div class="section-title alarm-issue">${A.esc(label)}</div>` +
      `</div>` +
      `<button class="btn btn-stop-alarm btn-stop-main" data-action="stop-alarm">` +
      `<span class="stop-icon">■</span>` +
      `<span>STOP ALARM</span>` +
      `</button>` +
      `</div>` +
      `</div>`;
  };
  A.setHomeMonitoringVisual = enabled => {
    const card = A.$('homeMonitorCard'),
      s = A.site(),
      hasPat = Boolean(s && A.credentialStatus?.[s.id]),
      live = Boolean(enabled && hasPat),
      radarEl = card?.querySelector('.radar.radar-pro'),
      toggle = A.$('homeMonitor'),
      stateLabel = card?.querySelector('[data-home-monitor-state]'),
      next = card?.querySelector('[data-home-monitor-next]');
    if (card) {
      card.classList.toggle('monitor-on', live);
      card.classList.toggle('monitor-off', !live);
    }
    if (radarEl) {
      radarEl.classList.toggle('radar-live', live);
      radarEl.classList.toggle('radar-off', !live);
    }
    if (toggle && toggle.checked !== Boolean(enabled)) toggle.checked = Boolean(enabled);
    if (stateLabel) stateLabel.textContent = enabled ? (hasPat ? 'ON' : 'ON · PAT REQUIRED') : 'OFF';
    if (next) {
      if (!enabled) next.textContent = 'Monitoring stopped';
      else if (!hasPat) next.textContent = 'PAT required';
    }
  };
  A.refreshHomeMonitorDom = (s, p) => {
    const card = A.$('homeMonitorCard');
    if (!card) return;
    const st = s.runtime || {},
      pr = p.runtime || {},
      monitor = Boolean(p.monitoring?.enabled),
      enabledRules = (p.rules || []).filter(r => r.enabled).length,
      totalRules = (p.rules || []).length;
    A.setHomeMonitoringVisual(monitor);
    const values = { detected: pr.lastDetectionCount || 0, actions: pr.lastPlanCount || 0, evaluated: st.lastIssueCount || 0 };
    for (const [name, value] of Object.entries(values)) {
      const el = card.querySelector(`[data-home-stat="${name}"]`);
      if (el) el.textContent = String(value);
    }
    const next = card.querySelector('[data-home-monitor-next]');
    if (next) {
      const hasPat = Boolean(A.credentialStatus?.[s.id]);
      next.textContent = monitor ? (hasPat ? `Next ${SD.Utils.formatDateTime(pr.nextCycleAt)}` : 'PAT required') : 'Monitoring stopped';
    }
    const count = card.querySelector('[data-home-rule-count]');
    if (count) count.textContent = `${enabledRules}/${totalRules} rules`;
    const radarEl = card.querySelector('.radar.radar-pro');
    if (radarEl) {
      radarEl.querySelectorAll('.radar-dot').forEach(x => x.remove());
      const dots = radarDots(s, p), core = radarEl.querySelector('.radar-core');
      if (dots) {
        if (core) core.insertAdjacentHTML('afterend', dots);
        else radarEl.insertAdjacentHTML('beforeend', dots);
      }
    }
  };
  A.refreshHomeActivityDom = () => {
    if (A.page !== 'home') return;
    const s = A.site(), p = A.profile();
    if (!s || !p) return;
    document.querySelectorAll('.home-credential-notice').forEach(x => x.remove());
    const openIssues = new Set([...document.querySelectorAll('#homeIssueActivityCard details.activity-issue[open]')].map(x => x.dataset.issueKey).filter(Boolean)),
      st = s.runtime || {},
      pr = p.runtime || {},
      view = A.homeDetectionView === 'recent' ? 'recent' : 'current',
      current = pr.currentDetections || [],
      recent = (st.radarEvents || []).filter(e => !e.profileId || e.profileId === p.id);
    A.refreshHomeMonitorDom(s, p);
    const parts = [
      ['homeShiftCard', shiftCard(p)],
      ['homeOperationalHealth', healthCards(s, p)],
      ['homeAlarmSlot', alarmCard()],
      ['homeDetectionsCard', detectionCard(pr, st, view, current, recent)],
      ['homeIssueActivityCard', activityCard(s, p, recent, current)]
    ];
    for (const [id, html] of parts) {
      const el = A.$(id);
      if (el) el.outerHTML = html;
    }
    for (const key of openIssues) {
      const el = [...document.querySelectorAll('#homeIssueActivityCard details.activity-issue')].find(x => x.dataset.issueKey === key);
      if (el) el.open = true;
    }
  };
  A.pageHome = () => {
    const s = A.site(), p = A.profile();
    if (!s || !p) return noServer();
    const st = s.runtime || {},
      pr = p.runtime || {},
      view = A.homeDetectionView === 'recent' ? 'recent' : 'current',
      current = pr.currentDetections || [],
      recent = (st.radarEvents || []).filter(e => !e.profileId || e.profileId === p.id);
    return `<section class="page home-page">${head('Operations')}${monitorCard(s, p)}${shiftCard(p)}${healthCards(s, p)}${alarmCard()}${detectionCard(pr, st, view, current, recent)}${activityCard(s, p, recent, current)}</section>`;
  };
})();
