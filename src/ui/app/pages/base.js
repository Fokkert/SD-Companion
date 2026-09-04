(() => {
  const A = globalThis.SDApp, SD = globalThis.SDCompanion;
  const head = (title, copy = "", actions = "") => {
    const back = A.settingsBackTarget && A.page !== 'settings'
      ? `<button type="button" class="btn btn-small settings-back-button" data-action="settings-back">← Back</button>`
      : '';
    return `<div class="page-head"><div class="page-head-copy">${back}<h1>${A.esc(title)}</h1>${copy ? `<p>${A.esc(copy)}</p>` : ""}</div>${actions ? `<div class="page-head-actions">${actions}</div>` : ""}</div>`;
  };
  const noServer = () => `<section class="page">${head("Jira Servers")}<div class="card empty-state"><strong>No Jira server configured</strong><button class="btn btn-primary" data-action="go-servers">Add Jira server</button></div></section>`;
  const avatarUrl = u => u?.avatarUrls?.['48x48'] || u?.avatarUrls?.['32x32'] || u?.avatarUrls?.['24x24'] || u?.avatarUrl || "";
  const avatar = (u, size = "md") => {
    const url = avatarUrl(u), name = u?.displayName || u?.name || u?.key || "?";
    return url ? `<span class="entity-avatar ${size}"><img src="${A.esc(url)}" alt="" referrerpolicy="no-referrer"><span>${A.esc(name.slice(0, 1).toUpperCase())}</span></span>` : `<span class="entity-avatar ${size} fallback">${A.esc(name.slice(0, 1).toUpperCase())}</span>`;
  };
  const projectLogo = p => {
    const url = p?.avatarUrls?.['48x48'] || p?.avatarUrls?.['32x32'] || p?.avatarUrl || "";
    return url ? `<span class="entity-avatar project"><img src="${A.esc(url)}" alt="" referrerpolicy="no-referrer"><span>${A.esc((p?.key || 'P').slice(0, 1))}</span></span>` : `<span class="entity-avatar project fallback">${A.esc((p?.key || 'P').slice(0, 2))}</span>`;
  };
  const freshness = (s, key) => {
    const f = s?.inventory?.freshness?.[key],
      at = typeof f === 'string' ? f : f?.at || f?.updatedAt || null;
    return at ? SD.Utils.formatDateTime(at) : "Never";
  };
  A.View = Object.freeze({ head, noServer, avatar, avatarUrl, projectLogo, freshness });
  A.renderShell = () => {
    const s = A.site(), p = A.profile();
    A.$("serverSelect").innerHTML = A.state.jiraSites.length ? A.state.jiraSites.map(x => A.option(x.id, x.name, x.id === s?.id)).join("") : A.option("", "No server", true);
    A.$("profileSelect").innerHTML = (s ? A.state.profiles.filter(x => x.siteId === s.id) : A.state.profiles).map(x => A.option(x.id, x.name, x.id === p?.id)).join("") || A.option("", "No profile", true);
    const badge = A.$("apiBadge"),
      hasPat = Boolean(s && A.credentialStatus?.[s.id]),
      healthy = Boolean(hasPat && s?.runtime?.apiHealthy),
      degraded = s?.runtime?.healthState === "degraded";
    if (badge) {
      badge.textContent = !s ? "NO SERVER" : !hasPat ? "PAT MISSING" : healthy ? (degraded ? "API DEGRADED" : "API ONLINE") : "API OFFLINE";
      badge.className = `pill ${!s ? "info" : !hasPat ? "warn" : healthy ? (degraded ? "warn" : "good") : "bad"}`;
    }
    const stop = A.$("quickStopAlarm"),
      alarmActive = Boolean(A.state?.runtime?.activeAlarm?.active),
      queuedAlarms = (A.jobs || []).some(j => j.action === SD.Constants.ACTION.ALARM && [SD.Constants.JOB.AWAITING_APPROVAL, SD.Constants.JOB.PENDING, SD.Constants.JOB.RUNNING].includes(j.status)),
      canStopAlarms = alarmActive || queuedAlarms;
    if (stop) {
      stop.classList.toggle("alarm-active", canStopAlarms);
      stop.disabled = !canStopAlarms;
      stop.title = canStopAlarms ? "Stop current alarm and cancel scheduled alarms" : "No active or scheduled alarms";
    }
    const av = A.$("serverAvatar");
    if (s?.icon?.mode === "auto" && s.icon.url) av.innerHTML = `<img src="${A.esc(s.icon.url)}" alt="" data-favicon data-fallback="../../../icons/server-${A.esc(s.icon?.preset || "emerald")}.svg">`;
    else if (s) av.innerHTML = `<img src="../../../icons/server-${A.esc(s.icon?.preset || "emerald")}.svg" alt="">`;
    else av.textContent = "SD";
    A.enhanceSoftSelects?.(document);
  };
})();
