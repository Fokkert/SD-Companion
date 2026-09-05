(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { DAYS } = SD.Constants,
    { head, noServer } = A.View;
  const units = u => ['seconds', 'minutes', 'hours'].map(x => A.option(x, x[0].toUpperCase() + x.slice(1), u === x)).join('');
  const scheduleIcon = () => `<span class="schedule-entry-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/><path d="m9 15 2 2 4-4"/></svg></span>`;
  A.pageSchedules = () => {
    const p = A.profile();
    if (!p) return noServer();
    if (A.selectedScheduleId && !A.scheduleDraft && !p.schedules.some(x => x.id === A.selectedScheduleId)) A.selectedScheduleId = '';
    const sc = A.scheduleDraft?.id === A.selectedScheduleId ? A.scheduleDraft : p.schedules.find(x => x.id === A.selectedScheduleId),
      pu = p.monitoring?.intervalUnit || 'minutes';
    return `<section class="page schedules-page">${head('Schedules', '', `<button class="btn btn-primary btn-small" data-action="new-schedule">+ Schedule</button>`)}<div class="configured-section">` +
      `<div class="section-kicker">Configured schedules</div>` +
      `<div class="card compact-configured-card">` +
      `<div class="list schedule-list">${p.schedules.map(x => `<div class="list-item configured-object schedule-list-item ${SD.Schedule.isActive(x) ? 'active-object' : ''} ${x.id === A.selectedScheduleId ? 'editing-object' : ''}">` +
        `${scheduleIcon()}` +
        `<div class="schedule-entry-copy">` +
        `<div class="list-title">${A.esc(x.name)}</div>` +
        `<div class="schedule-entry-meta"><span class="list-meta">${A.esc(SD.Schedule.describe(x))}</span><span class="object-state schedule-state ${SD.Schedule.isActive(x) ? 'online' : 'idle'}" title="${SD.Schedule.isActive(x) ? 'Active now' : 'Inactive now'}"></span></div>` +
        `</div>` +
        `<button class="btn btn-small schedule-edit-button" data-action="edit-schedule" data-id="${x.id}">Edit</button></div>`).join('') || '<div class="empty">No schedules configured.</div>'}</div></div></div>${sc ? `<div class="card editor-card">` +
          `<div class="row-between">` +
          `<div class="section-title">${A.esc(sc.name)}</div>` +
          `<div class="row">` +
          `<button class="btn btn-primary btn-small" data-action="save-schedule">Save Schedule</button>` +
          `<button class="btn btn-small" data-action="cancel-schedule-editor">Cancel</button>${A.scheduleDraftIsNew ? '' : '<button class="btn btn-danger btn-small" data-action="delete-schedule">Delete</button>'}</div>` +
          `</div>` +
          `<div class="grid-2 section-gap">` +
          `<div class="field">` +
          `<label>Name</label>` +
          `<input class="input" maxlength="80" data-schedule-prop="name" value="${A.esc(sc.name)}">` +
          `</div>` +
          `<div class="field">` +
          `<label>Timezone</label>` +
          `<input class="input" maxlength="80" data-schedule-prop="timeZone" value="${A.esc(sc.timeZone)}">` +
          `</div>` +
          `</div>` +
          `<div class="field section-gap">` +
          `<label>Days</label>` +
          `<div class="day-grid">${DAYS.map(d => `<label class="day-chip"><input type="checkbox" data-schedule-day="${d.id}" ${(sc.days || []).includes(d.id) ? 'checked' : ''}>${d.short}</label>`).join('')}</div>` +
          `</div>` +
          `<div class="grid-2 section-gap">` +
          `<div class="field">` +
          `<label>Start</label>` +
          `<input class="input mono" type="time" step="1" data-schedule-prop="startTime" value="${A.esc(sc.startTime)}">` +
          `</div>` +
          `<div class="field">` +
          `<label>End</label>` +
          `<input class="input mono" type="time" step="1" data-schedule-prop="endTime" value="${A.esc(sc.endTime)}">` +
          `</div>` +
          `<div class="field">` +
          `<label>Start date · optional</label>` +
          `<input class="input" type="date" data-schedule-prop="startDate" value="${A.esc(sc.startDate || '')}">` +
          `</div>` +
          `<div class="field">` +
          `<label>End date · optional</label>` +
          `<input class="input" type="date" data-schedule-prop="endDate" value="${A.esc(sc.endDate || '')}">` +
          `</div>` +
          `</div>` +
          `<div class="setting-line section-gap">` +
          `<span>Enabled</span>` +
          `<label class="master-switch">` +
          `<input type="checkbox" data-schedule-prop="enabled" ${sc.enabled ? 'checked' : ''}>` +
          `<span>` +
          `</span>` +
          `</label>` +
          `</div>` +
          `</div>` : ''}<div class="card">` +
      `<div class="section-title">Polling cadence</div>` +
      `<div class="time-value-row section-gap">` +
      `<div class="field">` +
      `<label>Interval</label>` +
      `<input id="pollInterval" class="input" type="number" min="1" step="1" value="${A.esc(SD.Utils.timeFromSeconds(p.monitoring.intervalSeconds || 60, pu))}">` +
      `</div>` +
      `<div class="field time-unit-field">` +
      `<label>Unit</label>` +
      `<select id="pollUnit" class="select">${units(pu)}</select>` +
      `</div>` +
      `<div class="field">` +
      `<label>Timing jitter (%)</label>` +
      `<input id="pollJitter" class="input" type="number" min="0" max="${SD.Constants.LIMITS.POLL_JITTER_MAX}" value="${p.monitoring.pollJitterPercent ?? 10}">` +
      `</div>` +
      `</div>` +
      `<button class="btn btn-small" data-action="save-polling">Save Polling</button>` +
      `</div>` +
      `</section>`;
  };
})();
