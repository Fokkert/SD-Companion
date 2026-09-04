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
  const actionName = a => ({ assign: 'Assignment', comment: 'Comment', transition: 'Transition', 'edit-fields': 'Edit fields', labels: 'Labels', priority: 'Priority', alarm: 'Alarm', notification: 'Notification' }[a] || a || 'Action');
  const dependencyWaiting = j => j.status === JOB.PENDING && Boolean(j.dependsOnJobId) && !j.dependencyScheduled;
  const terminalStatus = status => [JOB.SUCCEEDED, JOB.FAILED, JOB.CANCELLED, JOB.SKIPPED].includes(status);
  const actionRank = j => j.status === JOB.AWAITING_APPROVAL ? 0 : j.status === JOB.RUNNING ? 1 : j.status === JOB.PENDING ? 2 : j.status === JOB.FAILED ? 3 : 4;
  const actionStatus = j => j.status === JOB.SUCCEEDED ? 'Done' : j.status === JOB.AWAITING_APPROVAL ? 'Awaiting approval' : j.status === JOB.PENDING ? (dependencyWaiting(j) ? 'Waiting' : 'Pending') : j.status === JOB.RUNNING ? (j.cancelRequestedAt ? 'Cancelling' : 'Running') : j.status === JOB.FAILED ? 'Failed' : j.status === JOB.CANCELLED ? 'Cancelled' : j.status === JOB.SKIPPED ? 'Skipped' : j.status || 'Queued';
  const actionTime = j => {
    if (j.status === JOB.AWAITING_APPROVAL) return `Approval required · planned ${SD.Utils.formatDateTime(j.scheduledAt)}`;
    if (j.status === JOB.PENDING && dependencyWaiting(j)) return `Waiting for previous · estimated ${SD.Utils.formatDateTime(j.scheduledAt)}`;
    return SD.Utils.formatDateTime(j.status === JOB.PENDING ? j.scheduledAt : (j.completedAt || j.startedAt || j.createdAt));
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
  const scopedActivityJobs = (site, profile) => (A.jobs || [])
    .filter(job => job.siteId === site.id && job.profileId === profile.id);

  const activityViewCounts = (site, profile, current) => {
    const jobs = scopedActivityJobs(site, profile),
      currentDetected = new Set((current || []).map(row => row.issueKey).filter(Boolean)),
      currentIssues = new Set(),
      recentIssues = new Set();

    for (const job of jobs) {
      if (!job.issueKey) continue;
      recentIssues.add(job.issueKey);
      if (currentDetected.has(job.issueKey) || !terminalStatus(job.status)) currentIssues.add(job.issueKey);
    }

    return { current: currentIssues.size, recent: recentIssues.size };
  };

  const issueActivity = (site, profile, view, current, recent) => {
    const allJobs = scopedActivityJobs(site, profile),
      currentDetected = new Set((current || []).map(row => row.issueKey).filter(Boolean)),
      metadataRows = view === 'recent' ? recent : current,
      metadata = new Map();

    for (const row of metadataRows || []) {
      if (!row?.issueKey) continue;
      const existing = metadata.get(row.issueKey);
      if (!existing || new Date(row.at || 0) >= new Date(existing.at || 0)) metadata.set(row.issueKey, row);
    }

    const jobs = view === 'recent'
      ? allJobs
      : allJobs.filter(job => currentDetected.has(job.issueKey) || !terminalStatus(job.status));
    const map = new Map();

    for (const job of jobs) {
      if (!job.issueKey) continue;
      const detected = metadata.get(job.issueKey);
      let row = map.get(job.issueKey);
      if (!row) {
        row = {
          issueKey: job.issueKey,
          summary: detected?.summary || job.issueSnapshot?.summary || '',
          status: detected?.status || job.issueSnapshot?.status || '',
          at: detected?.at || job.createdAt || '',
          rules: new Set([detected?.ruleName || detected?.ruleId].filter(Boolean)),
          jobs: []
        };
        map.set(job.issueKey, row);
      }

      row.jobs.push(job);
      if (job.ruleName) row.rules.add(job.ruleName);
      if (detected?.ruleName) row.rules.add(detected.ruleName);
      if (new Date(job.createdAt || 0) > new Date(row.at || 0)) row.at = job.createdAt;
    }

    const hasActive = row => row.jobs.some(j => !terminalStatus(j.status)),
      visibleRows = [...map.values()].filter(row => A.homeShowCompletedActions || hasActive(row)),
      rows = visibleRows
        .sort((a, b) => Number(hasActive(b)) - Number(hasActive(a)) || new Date(b.at || 0) - new Date(a.at || 0))
        .slice(0, 30);

    return rows.map(row => {
      const allOrdered = [...row.jobs].sort((a, b) => actionRank(a) - actionRank(b) || new Date(b.historyOrderAt || b.completedAt || b.startedAt || b.createdAt || b.scheduledAt || 0) - new Date(a.historyOrderAt || a.completedAt || a.startedAt || a.createdAt || a.scheduledAt || 0) || String(b.id || '').localeCompare(String(a.id || ''))),
        ordered = allOrdered,
        done = allOrdered.filter(job => job.status === JOB.SUCCEEDED).length,
        upcomingJobs = allOrdered.filter(job => [JOB.AWAITING_APPROVAL, JOB.PENDING].includes(job.status)),
        pending = allOrdered.filter(job => [JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(job.status)).length;
      return `<details class="activity-issue" data-issue-key="${A.esc(row.issueKey)}">` +
        `<summary>` +
        `<span class="detection-key">${A.esc(row.issueKey)}</span>` +
        `<span class="activity-summary">` +
        `<b>${A.esc(row.summary || row.issueKey)}</b>` +
        `<small>${A.esc([...row.rules].join(' · ') || row.status || 'Detected')}</small>` +
        `</span>` +
        `<span class="activity-counts">${done ? `<i class="done">${done} done</i>` : ''}${pending ? `<i class="pending">${pending} pending</i>` : ''}</span>` +
        `</summary>` +
        `<div class="activity-timeline">${upcomingJobs.length ? `<div class="activity-bulk-row">` +
          `<span>${upcomingJobs.length} upcoming action${upcomingJobs.length === 1 ? '' : 's'}</span>` +
          `<div class="row activity-bulk-actions">` +
          `<button type="button" class="btn btn-small btn-primary" data-action="process-issue-jobs" data-issue-key="${A.esc(row.issueKey)}">Process all</button>` +
          `<button type="button" class="btn btn-small btn-danger" data-action="cancel-issue-jobs" data-issue-key="${A.esc(row.issueKey)}">Cancel all</button></div></div>` : ''}${ordered.length ? ordered.map(job => {
            const approvable = job.status === JOB.AWAITING_APPROVAL,
              cancellable = [JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(job.status),
              processable = job.status === JOB.PENDING,
              requested = job.status === JOB.RUNNING && Boolean(job.cancelRequestedAt);
            return `<div class="activity-action status-${A.esc(job.status)}${requested ? ' cancel-requested' : ''}">` +
              `<span class="activity-action-icon"></span>` +
              `<div class="activity-action-copy">` +
              `<b>${A.esc(actionName(job.action))}</b>` +
              `<small>${A.esc(actionStatus(job))} · ${A.esc(actionTime(job))}</small>` +
              `<span class="activity-detail">${A.esc(actionDetail(job, site))}</span>${job.error?.message ? `<em>${A.esc(job.error.message)}</em>` : ''}</div>${cancellable || processable || approvable ? `<div class="queue-action-buttons">${approvable ? `<button type="button" class="btn btn-small btn-primary" data-action="approve-job" data-job-id="${A.esc(job.id)}">Approve</button>` : ''}${processable ? `<button type="button" class="btn btn-small queue-process-btn" data-action="process-job" data-job-id="${A.esc(job.id)}">Process</button>` : ''}${cancellable ? `<button type="button" class="btn btn-small queue-cancel-btn" data-action="cancel-job" data-job-id="${A.esc(job.id)}" ${requested ? 'disabled' : ''}>${requested ? 'Cancelling…' : 'Cancel'}</button>` : ''}</div>` : ''}</div>`;
          }).join('') : `<div class="empty compact-empty">No actions recorded.</div>`}</div></details>`;
    }).join('') || `<div class="empty compact-empty">${A.homeShowCompletedActions ? 'No detected issues with actions yet.' : 'No active issue actions. Turn on Show completed to view finished history.'}</div>`;
  };

  const activityRefreshLabel = () => {
    const sec = Math.max(SD.Constants.LIMITS.ACTIVITY_REFRESH_MIN_SECONDS, Math.min(SD.Constants.LIMITS.ACTIVITY_REFRESH_MAX_SECONDS, Number(A.state?.system?.activityRefreshSeconds) || 3));
    return sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}m`;
  };

  const detectionsAndActionsCard = (site, profile, view, current, recent) => {
    const scoped = scopedActivityJobs(site, profile),
      pending = scoped.filter(job => job.status === JOB.PENDING).length,
      approvals = scoped.filter(job => job.status === JOB.AWAITING_APPROVAL).length,
      upcoming = scoped.filter(job => [JOB.AWAITING_APPROVAL, JOB.PENDING].includes(job.status)).length,
      enabledRules = (profile.rules || []).filter(rule => rule.enabled).length,
      canCheck = Boolean(A.credentialStatus?.[site.id] && enabledRules),
      counts = activityViewCounts(site, profile, current);
    return `<div id="homeDetectionsActionsCard" class="card home-live-card detections-actions-card">` +
      `<div class="detections-actions-toolbar">` +
      `<div class="section-title detections-actions-title">Detections &amp; Actions</div>` +
      `<div class="row detections-actions-primary-controls">` +
      `<button class="btn btn-small" data-action="refresh-current-matches" ${canCheck ? '' : 'disabled'}>Check now</button>` +
      `<div class="detection-view-toggle" role="group" aria-label="Issue activity view">` +
      `<button type="button" class="${view === 'current' ? 'active' : ''}" data-action="home-detection-view" data-view="current">Current <span>${counts.current}</span></button>` +
      `<button type="button" class="${view === 'recent' ? 'active' : ''}" data-action="home-detection-view" data-view="recent">Recent <span>${counts.recent}</span></button>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="row detections-actions-global-controls">` +
      `${approvals ? `<button type="button" class="btn btn-small btn-primary" data-action="approve-all-jobs">Approve all (${approvals})</button>` : ''}` +
      `${pending ? `<button type="button" class="btn btn-small btn-primary" data-action="process-all-jobs">Process all (${pending})</button>` : ''}` +
      `${upcoming ? `<button type="button" class="btn btn-small btn-danger" data-action="cancel-all-jobs">Cancel all upcoming (${upcoming})</button>` : ''}` +
      `<label class="row control-label show-completed-control" title="Hide issue groups whose actions are all complete. Active issue groups keep their completed action context.">Show completed <span class="master-switch"><input id="homeShowCompletedActions" type="checkbox" ${A.homeShowCompletedActions ? 'checked' : ''}><span></span></span></label>` +
      `<span class="freshness-chip">Auto refresh · ${activityRefreshLabel()}</span>` +
      `</div>` +
      `<div class="issue-activity-list">${issueActivity(site, profile, view, current, recent)}</div>` +
      `</div>`;
  };
  const activeSchedules = p => (p.schedules || []).filter(x => x.enabled && SD.Schedule.isActive(x, new Date()));
  const monitorCard = (s, p) => {
    const pr = p.runtime || {},
      monitor = Boolean(p.monitoring?.enabled),
      hasPat = Boolean(A.credentialStatus?.[s.id]),
      live = monitor && hasPat,
      enabledRules = (p.rules || []).filter(rule => rule.enabled).length,
      totalRules = (p.rules || []).length;
    return `<div id="homeMonitorCard" class="card radar-monitor-card ${live ? 'monitor-on' : 'monitor-off'}">` +
      `<div class="monitor-compact-grid">` +
      `<div class="radar-stage">${radar(s, p, live)}</div>` +
      `<div class="monitor-compact-side">` +
      `<div class="radar-monitor-head">` +
      `<div class="monitor-state">` +
      `<span class="monitor-light"></span>` +
      `<strong class="monitor-status-line">Monitoring <span data-home-monitor-state>${monitor ? (hasPat ? 'ON' : 'ON · PAT REQUIRED') : 'OFF'}</span></strong>` +
      `</div>` +
      `<div class="radar-monitor-controls">` +
      `<label class="master-switch" title="Continuous rule polling">` +
      `<input id="homeMonitor" type="checkbox" ${monitor ? 'checked' : ''} ${enabledRules ? '' : 'disabled'}>` +
      `<span></span>` +
      `</label>` +
      `<button class="btn btn-primary btn-small monitoring-scan-button" data-action="run-cycle" ${hasPat && enabledRules ? '' : 'disabled'}>Scan Now</button>` +
      `</div>` +
      `</div>` +
      `<div class="monitor-section-divider" aria-hidden="true"></div>` +
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
      `<strong data-home-stat="rules">${enabledRules}/${totalRules}</strong>` +
      `<span>Rules</span>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `</div>`;
  };
  const scheduleCard = p => {
    const active = activeSchedules(p),
      names = active.map(x => x.name).filter(Boolean),
      label = names.length ? names.join(', ') : 'No Active Schedule';
    return `<div id="homeScheduleCard" class="card home-schedule-card ${active.length ? 'active' : 'inactive'}">` +
      `<div class="schedule-card-icon">` +
      `<span>` +
      `</span>` +
      `</div>` +
      `<div class="schedule-card-copy">` +
      `<span>Active Schedule</span>` +
      `<strong>${A.esc(label)}</strong>` +
      `</div>` +
      `<span class="pill ${active.length ? 'good' : 'neutral'}">${active.length ? 'ACTIVE' : 'NONE'}</span></div>`;
  };
  const healthCards = (s, p) => {
    const st = s.runtime || {},
      pr = p.runtime || {},
      hasPat = Boolean(A.credentialStatus?.[s.id]),
      healthy = Boolean(hasPat && st.apiHealthy),
      degraded = st.healthState === 'degraded',
      failures = Math.max(0, Number(st.apiStats?.failures) || 0),
      requests = Math.max(0, Number(st.apiStats?.requests) || 0),
      cycleValue = !hasPat ? 'PAUSED' : st.lastError ? 'ERROR' : SD.Utils.formatDateTime(pr.lastCycleAt || st.lastCycleAt),
      requestValue = failures ? `${requests} · ${failures} FAILED` : String(requests);
    return `${hasPat ? '' : `<div class="notice warn credential-missing-notice home-credential-notice">` +
      `<b>PAT missing</b>` +
      `<span>This imported server has no stored PAT. API monitoring, health checks, synchronization and connection-loss alarms are paused.</span>` +
      `<button class="btn btn-small" data-action="go-servers">Configure PAT</button>` +
      `</div>`}<div id="homeOperationalHealth" class="grid-3 operational-health">` +
      `<div class="status-tile ${!hasPat ? 'warning' : healthy ? (degraded ? 'warning' : 'ok') : 'error'}">` +
      `<span>API</span>` +
      `<strong>${!hasPat ? 'PAT MISSING' : healthy ? (degraded ? 'DEGRADED' : 'ONLINE') : 'OFFLINE'}</strong>` +
      `</div>` +
      `<div class="status-tile ${st.lastError ? 'error' : !hasPat ? 'warning' : ''}">` +
      `<span>Last cycle</span>` +
      `<strong>${A.esc(cycleValue)}</strong>` +
      `</div>` +
      `<div class="status-tile ${failures ? 'warning' : ''}">` +
      `<span>Requests</span>` +
      `<strong>${A.esc(requestValue)}</strong>` +
      `</div></div>`;
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
      stateLabel = card?.querySelector('[data-home-monitor-state]');
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
  };
  A.refreshHomeMonitorDom = (s, p) => {
    const card = A.$('homeMonitorCard');
    if (!card) return;
    const pr = p.runtime || {},
      monitor = Boolean(p.monitoring?.enabled),
      enabledRules = (p.rules || []).filter(rule => rule.enabled).length,
      totalRules = (p.rules || []).length;
    A.setHomeMonitoringVisual(monitor);
    const values = {
      detected: pr.lastDetectionCount || 0,
      actions: pr.lastPlanCount || 0,
      rules: `${enabledRules}/${totalRules}`
    };
    for (const [name, value] of Object.entries(values)) {
      const el = card.querySelector(`[data-home-stat="${name}"]`);
      if (el) el.textContent = String(value);
    }
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
    const openIssues = new Set([...document.querySelectorAll('#homeDetectionsActionsCard details.activity-issue[open]')].map(x => x.dataset.issueKey).filter(Boolean)),
      st = s.runtime || {},
      pr = p.runtime || {},
      view = A.homeDetectionView === 'recent' ? 'recent' : 'current',
      current = pr.currentDetections || [],
      recent = (st.radarEvents || []).filter(e => !e.profileId || e.profileId === p.id);
    A.refreshHomeMonitorDom(s, p);
    const parts = [
      ['homeScheduleCard', scheduleCard(p)],
      ['homeOperationalHealth', healthCards(s, p)],
      ['homeAlarmSlot', alarmCard()],
      ['homeDetectionsActionsCard', detectionsAndActionsCard(s, p, view, current, recent)]
    ];
    for (const [id, html] of parts) {
      const el = A.$(id);
      if (el) el.outerHTML = html;
    }
    for (const key of openIssues) {
      const el = [...document.querySelectorAll('#homeDetectionsActionsCard details.activity-issue')].find(x => x.dataset.issueKey === key);
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
    return `<section class="page home-page">${head('Operations')}${monitorCard(s, p)}${scheduleCard(p)}${healthCards(s, p)}${alarmCard()}${detectionsAndActionsCard(s, p, view, current, recent)}</section>`;
  };
})();
