(() => {
  const A = globalThis.SDApp,
    SD = globalThis.SDCompanion,
    { head, noServer, avatar, projectLogo, freshness } = A.View;
  const transitionItems = s => {
    const rows = [];
    for (const ctx of s.transitionCatalog || []) for (const t of ctx.transitions || []) rows.push({
      ...t,
      projectKey: ctx.projectKey || '',
      projectName: ctx.projectName || '',
      issueTypeId: String(ctx.issueTypeId || ''),
      issueTypeName: ctx.issueTypeName || '',
      fromStatusId: String(ctx.statusId || ''),
      fromStatusName: ctx.statusName || '',
      contextId: ctx.id || '',
      issuesScanned: Number(ctx.issuesScanned) || 0,
      candidateIssueCount: Number(ctx.candidateIssueCount) || 0,
      sampleIssueKeys: ctx.sampleIssueKeys || [],
      workflowName: ctx.workflowName || t.workflowName || '',
      workflowSource: ctx.workflowSource || '',
      representativeIssueKey: ctx.representativeIssueKey || '',
      stale: Boolean(ctx.stale),
      syncError: ctx.syncError || ''
    });
    return rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')) || String(a.projectKey || '').localeCompare(String(b.projectKey || '')) || String(a.issueTypeName || '').localeCompare(String(b.issueTypeName || '')) || String(a.fromStatusName || '').localeCompare(String(b.fromStatusName || '')));
  };
  const inventoryItems = (s, type) => ({
    projects: s.projects,
    users: s.users,
    filters: s.filters,
    issueTypes: s.issueTypes,
    statuses: s.statuses,
    transitions: transitionItems(s),
    fields: s.fields,
    priorities: s.priorities,
    resolutions: s.resolutions
  }[type] || []);
  const defs = [
    ['projects', 'Projects', 'Project directory'],
    ['filters', 'Filters', 'Saved filters'],
    ['users', 'Users', 'Assignable users'],
    ['issueTypes', 'Issue Types', 'Project issue types'],
    ['statuses', 'Statuses', 'Workflow statuses'],
    ['transitions', 'Transitions', 'Workflow-context transitions'],
    ['fields', 'Fields', 'Visible Jira fields'],
    ['priorities', 'Priorities', 'Shared priorities'],
    ['resolutions', 'Resolutions', 'Shared resolutions']
  ];
  const iconSvg = type => ({
    issueType: '<path d="M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3Z"/><path d="m9 12 2 2 4-4"/>',
    status: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-4.8"/>',
    transition: '<path d="M5 7h9"/><path d="m11 4 3 3-3 3"/><path d="M19 17h-9"/><path d="m13 14-3 3 3 3"/>',
    field: '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="11" cy="18" r="1.5"/>',
    filter: '<path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z"/>',
    generic: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'
  }[type] || '');
  const metaIcon = (type, url = '') => `<span class="metadata-icon ${type}">${url ? `<img data-entity-icon src="${A.esc(url)}" alt="">` : ''}<svg viewBox="0 0 24 24" aria-hidden="true">${iconSvg(type)}</svg></span>`;
  const filteredInventory = (s, type, query = '') => {
    const items = inventoryItems(s, type),
      q = String(query || '').trim().toLowerCase(),
      matched = q ? items.filter(x => JSON.stringify(x).toLowerCase().includes(q)) : items;
    return { items, filtered: matched.slice(0, 400), matchedCount: matched.length };
  };
  const inventoryResultHtml = (s, type, query = '') => {
    const { items, filtered, matchedCount } = filteredInventory(s, type, query),
      emptyCopy = type === 'transitions' ? 'No synchronized transitions.' : 'No synchronized items.';
    return {
      items,
      matchedCount,
      rows: filtered.map(x => row(x, type)).join('') || `<div class="empty">${A.esc(emptyCopy)}</div>`,
      limit: matchedCount > 400 ? `Showing 400 of ${matchedCount} matching item${matchedCount === 1 ? '' : 's'}.` : ''
    };
  };
  A.refreshInventorySearchDom = () => {
    if (A.page !== 'data') return;
    const s = A.site();
    if (!s) return;
    const result = inventoryResultHtml(s, A.inventoryType, A.inventorySearch),
      list = A.$('inventoryResults'),
      limit = A.$('inventoryResultLimit');
    if (list) list.innerHTML = result.rows;
    if (limit) {
      limit.textContent = result.limit;
      limit.hidden = !result.limit;
    }
    document.querySelectorAll('#inventoryResults [data-entity-icon]').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
  };
  const row = (x, type) => {
    if (type === 'projects') return `<div class="list-item entity-row">${projectLogo(x)}<div><div class="list-title">${A.esc(x.name)}</div><div class="list-meta">${A.esc(x.key)} · ${A.esc(x.projectTypeKey || 'project')}</div></div></div>`;
    if (type === 'users') return `<div class="list-item entity-row">${avatar(x)}<div><div class="list-title">${A.esc(x.displayName)}</div><div class="list-meta">${A.esc(x.key || x.accountId || x.name || '')}</div></div></div>`;
    if (type === 'filters') return `<div class="list-item entity-row">${metaIcon('filter')}<div><div class="list-title">${A.esc(x.name)}</div><div class="list-meta">#${A.esc(x.id)} · ${A.esc(x.owner?.displayName || 'Accessible filter')}</div></div></div>`;
    if (type === 'issueTypes') return `<div class="list-item entity-row">${metaIcon('issueType', x.iconUrl || '')}<div><div class="list-title">${A.esc(x.name)}</div><div class="list-meta">${A.esc(x.projectKey || 'Global')} · ${A.esc(x.id)}</div></div></div>`;
    if (type === 'statuses') return `<div class="list-item entity-row">${metaIcon('status')}<div>` +
      `<div class="list-title">${A.esc(x.statusName || x.name)} · ${A.esc(x.projectKey)}</div>` +
      `<div class="list-meta">${A.esc(x.issueTypeName || '')} · ${A.esc(x.statusCategory || '')}</div></div></div>`;
    if (type === 'transitions') {
      const required = (x.requiredFields || []).length,
        sourceBase = x.workflowSource === 'issue-extraction' ? 'Issue extraction sample' : 'Jira read-only workflow',
        sourceTitle = x.stale ? `Cached ${sourceBase.toLowerCase()}` : sourceBase,
        sourceDetail = x.stale ? (x.syncError || 'Latest transition refresh failed; previous contextual data was retained.') : (x.workflowSource === 'issue-extraction' ? [x.issuesScanned ? `${x.issuesScanned} issue(s) inspected` : '', x.candidateIssueCount ? `${x.candidateIssueCount} candidates` : ''].filter(Boolean).join(' · ') : [x.workflowName ? `Workflow: ${x.workflowName}` : '', x.representativeIssueKey ? `Mapped via ${x.representativeIssueKey}` : ''].filter(Boolean).join(' · '));
      return `<details class="transition-card">` +
        `<summary>${metaIcon('transition')}<span class="transition-card-title">` +
        `<strong>${A.esc(x.name || 'Transition')}</strong>` +
        `<small>${A.esc(x.issueTypeName || x.issueTypeId || 'Issue type')} · ${A.esc(x.fromStatusName || x.fromStatusId || 'Status')} → ${A.esc(x.toStatusName || x.toStatusId || 'Status')}</small>` +
        `</span>` +
        `<span class="transition-project-chip">${A.esc(x.projectKey || 'Project')}</span>` +
        `</summary>` +
        `<div class="transition-card-body">` +
        `<div class="transition-detail-grid">` +
        `<div>` +
        `<span>Project</span>` +
        `<strong>${A.esc(x.projectName || x.projectKey || '—')}</strong>${x.projectName && x.projectKey ? `<small>${A.esc(x.projectKey)}</small>` : ''}</div>` +
        `<div>` +
        `<span>Issue type</span>` +
        `<strong>${A.esc(x.issueTypeName || x.issueTypeId || '—')}</strong>` +
        `</div>` +
        `<div>` +
        `<span>Before status</span>` +
        `<strong>${A.esc(x.fromStatusName || x.fromStatusId || '—')}</strong>` +
        `</div>` +
        `<div>` +
        `<span>After status</span>` +
        `<strong>${A.esc(x.toStatusName || x.toStatusId || '—')}</strong>` +
        `</div>` +
        `</div>` +
        `<div class="transition-observation">` +
        `<span>Discovery</span>` +
        `<strong>${A.esc(sourceTitle)}</strong>` +
        `<small>${A.esc(sourceDetail || 'Complete workflow topology')}</small></div>${required ? `<div class="transition-required"><span>Required transition fields</span><div>${(x.requiredFields || []).map(f => `<span class="freshness-chip">${A.esc(f.name || f.id)}</span>`).join('')}</div></div>` : ''}</div></details>`;
    }
    if (type === 'fields') return `<div class="list-item entity-row">${metaIcon('field')}<div><div class="list-title">${A.esc(x.name || x.id)}</div><div class="list-meta mono">${x.custom ? 'Custom' : 'System'} · ${A.esc(x.id)}</div></div></div>`;
    return `<div class="list-item entity-row">${metaIcon('generic')}<div><div class="list-title">${A.esc(x.name || x.id)}</div><div class="list-meta">${A.esc(x.id || '')}</div></div></div>`;
  };
  A.pageData = () => {
    const s = A.site();
    if (!s) return noServer();
    if (!defs.some(([k]) => k === A.inventoryType)) A.inventoryType = 'projects';
    const hasPat = Boolean(A.credentialStatus?.[s.id]),
      result = inventoryResultHtml(s, A.inventoryType, A.inventorySearch),
      selected = SD.Utils.discoveryProjectKeys(s.inventorySettings).length,
      active = defs.find(([k]) => k === A.inventoryType) || defs[0];
    return `<section class="page data-page">${head('API Data', '', `<div class="row">` +
      `<button class="btn btn-small" data-action="discover-projects" ${hasPat ? '' : 'disabled'}>Projects & Filters</button>` +
      `<button class="btn btn-primary btn-small" data-action="sync-data" ${selected && hasPat ? '' : 'disabled'}>Sync Configured Data</button></div>`)}${hasPat ? '' : `<div class="notice warn credential-missing-notice">` +
        `<b>PAT missing</b>` +
        `<span>Imported/saved metadata remains available to browse, but Jira synchronization is disabled until a PAT is configured.</span>` +
        `<button class="btn btn-small" data-action="go-servers">Configure PAT</button>` +
        `</div>`}<div class="data-summary-table-wrap">` +
      `<table class="data-summary-table">` +
      `<tbody>` +
      `<tr>` +
      `<th>Project scope</th>` +
      `<td>${selected} project${selected === 1 ? '' : 's'}</td>` +
      `</tr>` +
      `<tr>` +
      `<th>Projects refreshed</th>` +
      `<td>${A.esc(freshness(s, 'projects'))}</td>` +
      `</tr>` +
      `<tr>` +
      `<th>Deep sync</th>` +
      `<td>${A.esc(SD.Utils.formatDateTime(s.inventory?.lastFullSyncAt))}</td>` +
      `</tr>` +
      `<tr>` +
      `<th>Warnings</th>` +
      `<td class="${(s.inventory?.warnings || []).length ? 'warn' : ''}">${(s.inventory?.warnings || []).length || 'None'}</td>` +
      `</tr>` +
      `</tbody>` +
      `</table>` +
      `</div>` +
      `<div class="data-workspace">` +
      `<aside class="data-catalog">${defs.map(([k, n]) => `<button class="data-catalog-item ${A.inventoryType === k ? 'active' : ''}" data-action="inventory-type" data-type="${k}"><span><b>${n}</b></span><strong>${inventoryItems(s, k).length}</strong></button>`).join('')}</aside>` +
      `<div class="data-content">` +
      `<div class="data-content-head">` +
      `<div class="section-title">${active[1]}</div>` +
      `<span class="freshness-chip">${A.esc(freshness(s, A.inventoryType))}</span>` +
      `</div>` +
      `<input id="inventorySearch" class="input" placeholder="Search ${A.esc(active[1])}" value="${A.esc(A.inventorySearch || '')}" autocomplete="off">` +
      `<div class="card inventory-list ${A.inventoryType === 'transitions' ? 'transition-inventory' : ''}">` +
      `<div id="inventoryResults" class="list">${result.rows}</div>` +
      `<div id="inventoryResultLimit" class="muted result-limit" ${result.limit ? '' : 'hidden'}>${A.esc(result.limit)}</div></div></div></div></section>`;
  };
})();
