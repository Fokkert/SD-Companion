(async () => {
  const A = globalThis.SDApp;
  chrome.runtime.onMessage.addListener(m => {
    if (m?.type === "SD_SYNC_PROGRESS") {
      if (!A.currentOperationId || !m.operationId || m.operationId === A.currentOperationId) A.showOperation?.("Synchronizing Jira", `${m.progress?.phase || "sync"} · ${m.progress?.detail || ""}${m.progress?.total ? ` · ${m.progress.current}/${m.progress.total}` : ""}`, true);
      return;
    }
    if (m?.type === "SD_SYNC_DONE") {
      if (!A.currentOperationId || !m.operationId || m.operationId === A.currentOperationId) {
        A.hideOperation?.();
        A.toast?.(`Metadata snapshot committed${m.warnings ? ` with ${m.warnings} warning(s)` : ""}.`, m.warnings ? "error" : "success");
      }
      return;
    }
    if (m?.type === "SD_ALARM_STATE") {
      if (!A.state) return;
      A.state.runtime = A.state.runtime || {};
      A.state.runtime.activeAlarm = m.active ? {
        active: true,
        startedAt: new Date().toISOString(),
        siteId: m.alarm?.siteId || "",
        profileId: m.alarm?.profileId || "",
        issueKey: m.alarm?.issueKey || "",
        summary: m.alarm?.summary || "",
        ruleName: m.alarm?.ruleName || "",
        source: m.alarm?.source || "",
        stopMethod: m.alarm?.stopMethod || "",
        preset: m.alarm?.preset || ""
      } : { active: false };
      A.renderShell?.();
      if (A.page === "home") A.renderPage?.();
      return;
    }
    if (m?.type === "SD_CYCLE_DONE") {
      const site = A.site?.(), profile = A.profile?.();
      if (A.page === "home" && site?.id === m.siteId && profile?.id === m.profileId) A.tryHomeActivityRefresh?.();
    }
  });
  A.homeActivityRefreshPending = false;
  A.homeActivityBusy = () => false;
  A.tryHomeActivityRefresh = async () => {
    if (A.page !== 'home') return;
    try {
      await A.pullHomeActivity?.();
    } catch {}
  };
  let homeRefreshTimer = null;
  A.scheduleHomeRefresh = () => {
    if (homeRefreshTimer) clearTimeout(homeRefreshTimer);
    const L = globalThis.SDCompanion.Constants.LIMITS,
      sec = Math.max(L.ACTIVITY_REFRESH_MIN_SECONDS, Math.min(L.ACTIVITY_REFRESH_MAX_SECONDS, Number(A.state?.system?.activityRefreshSeconds) || 3));
    homeRefreshTimer = setTimeout(async () => {
      await A.tryHomeActivityRefresh?.();
      A.scheduleHomeRefresh?.();
    }, sec * 1000);
  };
  const surface = document.body.dataset.surface === 'sidepanel' || new URLSearchParams(location.search).get('surface') === 'sidepanel' ? 'sidepanel' : 'popup';
  document.body.dataset.surface = surface;
  document.documentElement.dataset.surface = surface;
  const ro = new ResizeObserver(entries => {
    const w = Math.round(entries[0]?.contentRect?.width || innerWidth);
    document.documentElement.style.setProperty('--surface-width', `${w}px`);
    document.body.dataset.compact = w < 720 ? 'true' : 'false';
    A.closeSoftSelects?.();
  });
  ro.observe(document.documentElement);
  A.bindEvents();
  const security = await A.refreshSecurityStatus();
  if (security.enabled && !security.unlocked) {
    A.showSecurityLock();
    return;
  }
  await A.load();
  A.scheduleHomeRefresh?.();
})().catch(e => {
  document.body.replaceChildren();
  const pre = document.createElement('pre');
  pre.style.cssText = 'white-space:pre-wrap;padding:20px;color:#ff8aa2;font-size:14px';
  pre.textContent = String(e?.stack || e);
  document.body.appendChild(pre);
});
