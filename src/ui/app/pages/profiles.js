(() => {
  const A = globalThis.SDApp, { head } = A.View;
  const chips = (items, empty = 'None') => items?.length ? `<div class="import-chip-list">${items.map(x => `<span class="import-chip">${A.esc(x)}</span>`).join('')}</div>` : `<span class="muted">${A.esc(empty)}</span>`;
  const profileIcon = () => `<span class="profile-card-icon profile-context-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 19c.8-4 3.1-6 6.5-6s5.7 2 6.5 6"></path></svg></span>`;
  const importPreview = d => {
    if (!d) return '';
    const authCopy = d.includesPat ? 'PAT included in encrypted backup' : 'PAT not included — configure it later in Jira Servers';
    return `<div class="card import-preview">
    <div class="import-preview-head">` +
      `<div>` +
      `<div class="section-title">Import preview</div>` +
      `<div class="muted">Review exactly what will be restored before applying the backup.</div>` +
      `</div>` +
      `<span class="pill warn">NOT APPLIED</span>` +
      `</div>
    <div class="import-object-grid section-gap">
      <div class="import-object-card">` +
      `<span>Jira server</span>` +
      `<strong>${A.esc(d.serverName)}</strong>` +
      `<small>${A.esc(d.server)}</small>` +
      `</div>
      <div class="import-object-card">` +
      `<span>Profile</span>` +
      `<strong>${A.esc(d.profileName)}</strong>` +
      `<small>${d.nameConflict ? 'A profile with this name already exists' : 'New profile name'}</small>` +
      `</div>
    </div>
    <div class="import-summary-wrap section-gap">` +
      `<table class="import-summary-table">` +
      `<tbody>
      <tr>` +
      `<th>Rules</th>` +
      `<td>${d.incomingRules}</td>` +
      `<th>Schedules</th>` +
      `<td>${d.incomingSchedules}</td>` +
      `</tr>
      <tr>` +
      `<th>Existing profiles</th>` +
      `<td>${d.currentProfiles}</td>` +
      `<th>Authentication</th>` +
      `<td class="${d.includesPat ? 'good-text' : 'warn-text'}">${d.includesPat ? 'PAT included' : 'PAT missing'}</td></tr>
    </tbody></table></div>
    ${d.includesPat ? '' : `<div class="notice warn import-auth-notice"><b>PAT not included</b><span>${A.esc(authCopy)}. The profile can still be imported; authenticated API operations will remain paused until credentials are added.</span></div>`}
    <div class="import-detail-grid section-gap">
      <div class="import-detail-card">` +
      `<div class="import-detail-title">` +
      `<b>Rules</b>` +
      `<span>${d.ruleNames.length}</span></div>${chips(d.ruleNames, 'No rules')}</div>
      <div class="import-detail-card">` +
      `<div class="import-detail-title">` +
      `<b>Schedules</b>` +
      `<span>${d.scheduleNames.length}</span></div>${chips(d.scheduleNames, 'No schedules')}</div>
      <div class="import-detail-card import-comparison-card">` +
      `<div class="import-detail-title">` +
      `<b>${d.comparisonProfile ? `Changes vs ${A.esc(d.comparisonProfile)}` : 'Comparison'}</b>` +
      `<span>${d.diffPaths.length || 0}</span></div>${d.comparisonProfile ? chips(d.diffPaths, 'No configuration difference detected') : `<div class="muted">New profile — no same-name profile exists on this server.</div>`}</div>
    </div>
    <div class="row import-actions">` +
      `<button class="btn btn-primary" data-action="apply-import">Apply Import</button>` +
      `<button class="btn" data-action="cancel-import">Cancel</button>` +
      `</div>
  </div>`;
  };
  A.pageProfiles = () => {
    const s = A.site(), d = A.pendingImport?.diff;
    if (!s) return `<section class="page">${head('Profiles')}<div class="card editor-card">` +
      `<div class="section-title">Import profile</div>` +
      `<div class="muted section-gap">No Jira server is configured. You can still import a profile backup; its saved Jira server configuration will be restored without requiring a PAT or connection first.</div>` +
      `<div class="row section-gap">` +
      `<button class="btn btn-primary" data-action="import-profile">Import Profile</button>` +
      `</div>` +
      `</div>${importPreview(d)}</section>`;
    const profiles = A.state.profiles.filter(p => p.siteId === s.id), p = A.profile();
    return `<section class="page">${head('Profiles')}<div class="configured-section">` +
      `<div class="section-kicker">Profiles on ${A.esc(s.name)}</div>` +
      `<div class="card">` +
      `<div class="list profile-list">${profiles.map(x => `<div class="list-item configured-object profile-list-item ${x.id === p?.id ? 'active-object' : ''}">` +
        `${profileIcon()}` +
        `<div class="profile-card-copy">` +
        `<div class="list-title">${A.esc(x.name)}</div>` +
        `<div class="list-meta">${(x.rules || []).length} rules · ${(x.schedules || []).length} schedules</div>` +
        `</div>` +
        `<div class="row profile-card-actions">` +
        `<button class="btn btn-small" data-action="duplicate-profile" data-id="${x.id}">Duplicate</button>` +
        `<button class="btn btn-small ${x.id === p?.id ? 'btn-primary' : ''}" data-action="select-profile" data-id="${x.id}" ${x.id === p?.id ? 'disabled' : ''}>${x.id === p?.id ? 'Selected' : 'Select'}</button>` +
        `</div></div>`).join('')}</div>` +
      `</div>` +
      `</div>` +
      `<div class="card">` +
      `<div class="grid-2">` +
      `<div class="field">` +
      `<label>New profile name</label>` +
      `<input id="newProfileName" class="input" maxlength="80" placeholder="Operations Profile">` +
      `</div>` +
      `<button class="btn btn-primary" style="align-self:end" data-action="new-profile">Create Profile</button>` +
      `</div>` +
      `</div>` +
      `<div class="card editor-card">` +
      `<div class="section-title">Current profile</div>` +
      `<div class="grid-2 section-gap">` +
      `<div class="field">` +
      `<label>Name</label>` +
      `<input id="profileNameEdit" class="input" maxlength="80" value="${A.esc(p?.name || '')}">` +
      `</div>` +
      `<button class="btn" style="align-self:end" data-action="rename-profile">Rename</button>` +
      `</div>` +
      `<div class="row section-gap">` +
      `<button class="btn" data-action="export-profile">Export</button>` +
      `<button class="btn btn-primary" data-action="export-secure">Encrypted Backup</button>` +
      `<button class="btn" data-action="import-profile">Import</button>` +
      `<button class="btn btn-danger" data-action="delete-profile">Delete</button>` +
      `</div>` +
      `</div>${importPreview(d)}</section>`;
  };
})();
