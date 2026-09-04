(() => {
  const A = globalThis.SDApp, SD = globalThis.SDCompanion, { head, noServer } = A.View;
  const capLabel = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase());
  A.pageHealth = () => {
    const s = A.site();
    if (!s) return noServer();
    const r = s.runtime || {},
      hasPat = Boolean(A.credentialStatus?.[s.id]),
      apiOnline = Boolean(hasPat && r.apiHealthy),
      perms = Object.entries(s.permissions || {}),
      caps = Object.entries(s.capabilities || {}),
      stats = r.apiStats || {};
    return `<section class="page">${head('Health & Compatibility', '', `<button class="btn btn-primary btn-small" data-action="refresh-health" ${hasPat ? '' : 'disabled'}>Health Check</button>`)}${hasPat ? '' : `<div class="notice warn credential-missing-notice">` +
      `<b>PAT missing</b>` +
      `<span>API health checks, monitoring, metadata synchronization and connection-loss alarms are paused for this server until a PAT is configured.</span>` +
      `<button class="btn btn-small" data-action="go-servers">Configure PAT</button>` +
      `</div>`}<div class="grid-3">` +
      `<div class="stat">` +
      `<strong class="${!hasPat ? 'warning' : apiOnline ? 'success' : 'danger'}">${!hasPat ? 'PAT MISSING' : apiOnline ? 'ONLINE' : 'OFFLINE'}</strong>` +
      `<span>API</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${r.tabCount || 0}</strong>` +
      `<span>Jira tabs</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong class="${hasPat ? 'success' : 'warning'}">${hasPat ? 'YES' : 'NO'}</strong>` +
      `<span>PAT stored</span>` +
      `</div>` +
      `</div>` +
      `<div class="card">` +
      `<div class="section-title">Request statistics</div>` +
      `<div class="grid-3 section-gap">` +
      `<div class="stat">` +
      `<strong>${stats.requests || 0}</strong>` +
      `<span>Requests</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${stats.failures || 0}</strong>` +
      `<span>Failures</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${stats.retries || 0}</strong>` +
      `<span>Retries</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${stats.rateLimited || 0}</strong>` +
      `<span>Rate limited</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${stats.avgLatencyMs || 0} ms</strong>` +
      `<span>Average latency</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${stats.maxLatencyMs || 0} ms</strong>` +
      `<span>Max latency</span>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="card">` +
      `<div class="row-between">` +
      `<div class="section-title">Jira tab refresh & focus</div>` +
      `<span class="freshness-chip">Refresh ${s.behavior?.autoRefreshJiraTabsOnDetection ? 'ON' : 'OFF'} · Focus ${s.behavior?.focusJiraTabOnDetection ? 'ON' : 'OFF'}</span>` +
      `</div>` +
      `<div class="grid-3 section-gap">` +
      `<div class="stat">` +
      `<strong>${r.lastTabRefreshMatched ?? '—'}</strong>` +
      `<span>Matched tabs</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${r.lastTabRefreshCount ?? '—'}</strong>` +
      `<span>Reloaded</span>` +
      `</div>` +
      `<div class="stat">` +
      `<strong>${r.lastTabRefreshFailures ?? '—'}</strong>` +
      `<span>Failures</span>` +
      `</div>` +
      `</div>` +
      `<div class="list-meta section-gap">Last attempt: ${A.esc(SD.Utils.formatDateTime(r.lastTabRefreshAt))}</div>` +
      `</div>` +
      `<div class="card">` +
      `<div class="section-title">Server capabilities</div>` +
      `<div class="matrix-list section-gap">${caps.map(([k, v]) => `<div class="matrix-row"><span>${A.esc(capLabel(k))}</span><span class="pill ${v ? 'good' : 'bad'}">${v ? 'YES' : 'NO'}</span></div>`).join('')}</div>` +
      `</div>` +
      `<div class="card">` +
      `<div class="section-title">Permission matrix</div>` +
      `<div class="matrix-list section-gap">${perms.slice(0, 120).map(([k, v]) => `<div class="matrix-row"><span><b>${A.esc(v?.name || k)}</b><small class="mono">${A.esc(k)}</small></span><span class="pill ${v?.havePermission ? 'good' : 'bad'}">${v?.havePermission ? 'YES' : 'NO'}</span></div>`).join('') || '<div class="empty">No permission map returned.</div>'}</div></div>${r.lastHealthError || r.lastError ? `<div class="notice bad"><b>${A.esc(r.lastErrorCode || 'API error')}</b><br>${A.esc(r.lastHealthError || r.lastError)}</div>` : ''}</section>`;
  };
})();
