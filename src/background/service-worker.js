importScripts('../shared/alarm-catalog.js', '../shared/constants.js', '../shared/utils.js', '../shared/schedule.js', '../shared/condition-registry.js', '../shared/rule-query.js', '../shared/defaults.js', '../shared/migrations.js', '../shared/storage.js', '../shared/validators.js', 'operations.js', 'request-scheduler.js', 'jira-tabs.js', '../api/jira-client.js', 'discovery.js', 'rule-engine.js', 'job-queue.js');
const SD = globalThis.SDCompanion, { MESSAGE, ALARMS, LEVEL } = SD.Constants;
const log = (level, message, details = {}, extra = {}) => SD.Storage.appendLog({ level, message, details, ...extra });
const audit = (event, details = {}, extra = {}) => SD.Storage.appendAudit({ event, details, ...extra });
const securityAlwaysAllowed = new Set([MESSAGE.GET_SECURITY_STATUS, MESSAGE.VERIFY_SECURITY, MESSAGE.LOCK_EXTENSION, MESSAGE.STOP_ALARM, 'SD_OFFSCREEN_ENDED', 'SD_SYNC_PROGRESS', 'SD_SYNC_DONE', 'SD_ALARM_STATE']);
const enforceExtensionUnlock = async type => {
  const status = await SD.Storage.securityStatus();
  if (status.enabled && !status.unlocked && !securityAlwaysAllowed.has(type)) {
    const e = new Error('SD Companion is locked. Unlock the extension to continue.');
    e.code = 'EXTENSION_LOCKED';
    throw e;
  }
  return status;
};
const requireRiskAuth = async (message, label = 'this sensitive action') => {
  const status = await SD.Storage.securityStatus();
  if (!status.enabled) return;
  if (!await SD.Storage.validateSecurityRiskToken(message.securityAuthToken)) {
    const e = new Error(`Re-enter your extension PIN or password to ${label}.`);
    e.code = 'SECURITY_REAUTH_REQUIRED';
    throw e;
  }
};
const getSiteProfile = (state, siteId = null, profileId = null) => {
  const site = state.jiraSites.find(s => s.id === (siteId || state.activeSiteId)) || state.jiraSites[0] || null,
    profile = state.profiles.find(p => p.id === (profileId || site?.activeProfileId || state.activeProfileId)) || state.profiles.find(p => p.siteId === site?.id) || state.profiles[0] || null;
  return { site, profile };
};
const ensureOffscreen = async () => {
  if (!chrome.offscreen) return;
  const contexts = chrome.runtime.getContexts ? await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL('src/offscreen/alarm.html')] }) : [];
  if (contexts.length) return;
  try {
    await chrome.offscreen.createDocument({ url: 'src/offscreen/alarm.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Play user-configured Jira detection alarms.' });
  } catch (e) {
    if (!/single offscreen/i.test(e.message || '')) throw e;
  }
};
const setAlarmRuntime = async (active, alarm = {}, meta = {}) => SD.Storage.updateState(state => {
  state.runtime = state.runtime || {};
  state.runtime.activeAlarm = active ? {
    active: true,
    startedAt: SD.Utils.nowIso(),
    siteId: meta.siteId || "",
    profileId: meta.profileId || "",
    issueKey: meta.issueKey || "",
    summary: meta.summary || "",
    ruleName: meta.ruleName || "",
    source: meta.source || "Jira detection",
    stopMethod: alarm.stopMethod || "duration-or-controls",
    preset: alarm.preset || "radar",
    volume: Number(alarm.volume ?? .8),
    loop: alarm.loop !== false,
    showSystemNotification: alarm.showSystemNotification !== false,
    showPagePopup: alarm.showPagePopup !== false
  } : { active: false, startedAt: null, siteId: "", profileId: "", issueKey: "", summary: "", ruleName: "", source: "", stopMethod: "", preset: "" };
});
const setNotificationPermission = level => SD.Storage.updateState(state => {
  state.runtime = state.runtime || {};
  state.runtime.notificationPermission = level || "unknown";
}).catch(() => {});
const showAlarmNotification = async (alarm, meta = {}) => {
  if (alarm.showSystemNotification === false && alarm.preset !== "system") return false;
  let permission = "unknown";
  try {
    permission = await chrome.notifications.getPermissionLevel();
  } catch {}
  await setNotificationPermission(permission);
  if (permission === "denied") {
    await log(LEVEL.WARN, "Chrome notifications are disabled for SD Companion.", { permission }, { siteId: meta.siteId, profileId: meta.profileId });
    return false;
  }
  try {
    const connectionAlarm = meta.source === "Connection monitor";
    const title = connectionAlarm ? "SD Companion · API Unreachable" : (meta.issueKey ? `SD Companion · ${meta.issueKey}` : "SD Companion Alarm");
    const message = connectionAlarm ? (meta.summary || "Jira API connection is unavailable.") : (meta.summary || meta.ruleName ? `${meta.summary || "Jira detection"}${meta.ruleName ? ` · ${meta.ruleName}` : ""}` : "Jira detection alarm");
    await chrome.notifications.create("sd-companion-active-alarm", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title,
      message,
      priority: 2,
      requireInteraction: true,
      silent: alarm.preset !== "system",
      buttons: [{ title: "Stop alarm" }]
    });
    return true;
  } catch (e) {
    await log(LEVEL.ERROR, "Chrome notification could not be shown.", SD.Utils.safeError(e), { siteId: meta.siteId, profileId: meta.profileId });
    return false;
  }
};
const alarmThemePalette = theme => ({
  "emerald-glass": { a: "#35d49a", b: "#0d9f72", glow: "rgba(53,212,154,.34)" },
  "midnight-glass": { a: "#6d9cff", b: "#355fcc", glow: "rgba(74,119,255,.30)" },
  "graphite-glass": { a: "#d0d5dc", b: "#8b939e", glow: "rgba(208,213,220,.18)" },
  "violet-glass": { a: "#c58cff", b: "#8747d4", glow: "rgba(197,140,255,.30)" },
  "amber-glass": { a: "#ffc45c", b: "#c97d12", glow: "rgba(255,196,92,.28)" },
  "frost-light": { a: "#2875c7", b: "#55a5d9", glow: "rgba(40,117,199,.22)" }
}[theme] || { a: "#35d49a", b: "#0d9f72", glow: "rgba(53,212,154,.34)" });
const jiraAlarmPopupScript = payload => {
  const ID = "sd-companion-jira-alarm-popup";
  document.getElementById(ID)?.remove();
  const root = document.createElement("div");
  root.id = ID;
  root.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:2147483647;width:min(404px,calc(100vw - 48px));font-family:Inter,'Segoe UI',Arial,sans-serif;";
  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>
    *{box-sizing:border-box}
    .box{overflow:hidden;border-radius:26px;border:1px solid ${payload.palette.a}66;background:radial-gradient(circle at top left,${payload.palette.a}30,transparent 42%),linear-gradient(145deg,rgba(8,13,20,.98),rgba(13,20,29,.98));color:#eefcf7;box-shadow:0 28px 80px rgba(0,0,0,.62),0 0 34px ${payload.palette.glow};animation:in .22s cubic-bezier(.22,1,.36,1)}
    .rail{height:4px;background:linear-gradient(90deg,transparent,${payload.palette.a},${payload.palette.b},transparent);background-size:200% 100%;animation:sig 1.8s linear infinite}
    .inner{padding:19px}.head{display:grid;grid-template-columns:48px minmax(0,1fr);gap:13px;align-items:center}
    .icon{width:48px;height:48px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(135deg,${payload.palette.a},${payload.palette.b});color:#07110d;font-weight:950;box-shadow:0 0 25px ${payload.palette.glow}}
    .k{font-size:10px;font-weight:950;letter-spacing:1.1px;color:${payload.palette.a}}.t{margin-top:4px;font-size:12px;color:#9fb0ba}
    .issue{margin-top:14px;padding:13px 14px;border:1px solid rgba(255,255,255,.11);border-radius:17px;background:rgba(255,255,255,.055);font-size:14px;font-weight:850;line-height:1.42;color:#f4fbf8;word-break:break-word}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.meta>div{min-width:0;padding:11px 12px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.045)}
    .meta span{display:block;font-size:9px;color:#8fa1ad;text-transform:uppercase;letter-spacing:.8px;font-weight:900}.meta b{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
    .actions{margin-top:15px;display:grid}.stop{border:0;border-radius:15px;padding:12px 14px;background:linear-gradient(135deg,#ef4444,#991b1b);color:#fff;font-size:13px;font-weight:950;cursor:pointer;box-shadow:0 8px 22px rgba(239,68,68,.34)}
    .stop:hover{filter:brightness(1.08);transform:translateY(-1px)}.stop:active{transform:scale(.97)}
    @keyframes in{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}@keyframes sig{from{background-position:100% 0}to{background-position:-100% 0}}
  </style>` +
    `<div class="box" role="alertdialog" aria-label="SD Companion Jira alarm">` +
    `<div class="rail">` +
    `</div>` +
    `<div class="inner">` +
    `<div class="head">` +
    `<div class="icon">SD</div>` +
    `<div>` +
    `<div class="k">SD COMPANION</div>` +
    `<div class="t" data-kind>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<div class="issue" data-issue>` +
    `</div>` +
    `<div class="meta">` +
    `<div>` +
    `<span>Rule</span>` +
    `<b data-rule>` +
    `</b>` +
    `</div>` +
    `<div>` +
    `<span>Server</span>` +
    `<b data-server>` +
    `</b>` +
    `</div>` +
    `</div>` +
    `<div class="actions">` +
    `<button class="stop" type="button">Stop alarm</button>` +
    `</div>` +
    `</div>` +
    `</div>`;
  shadow.querySelector("[data-kind]").textContent = payload.kind || "Jira issue detected";
  shadow.querySelector("[data-issue]").textContent = payload.issueKey ? `${payload.issueKey}${payload.summary ? ` · ${payload.summary}` : ""}` : (payload.summary || "Alarm test");
  shadow.querySelector("[data-rule]").textContent = payload.ruleName || payload.source || "Alarm";
  shadow.querySelector("[data-server]").textContent = payload.serverName || location.host;
  shadow.querySelector(".stop").addEventListener("click", async e => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Stopping…";
    try {
      const response = await chrome.runtime.sendMessage({ type: "STOP_ALARM" });
      if (response?.ok === false) throw new Error(response?.error?.message || "Stop failed");
      root.remove();
    } catch {
      btn.disabled = false;
      btn.textContent = "Stop alarm";
    }
  });
  (document.documentElement || document.body).appendChild(root);
  return true;
};
const removeJiraAlarmPopupScript = () => {
  document.getElementById("sd-companion-jira-alarm-popup")?.remove();
  return true;
};
const showJiraAlarmPopup = async (alarm, meta = {}) => {
  if (alarm.showPagePopup === false || !meta.siteId) return false;
  const state = await SD.Storage.ensureState(), site = state.jiraSites.find(s => s.id === meta.siteId);
  if (!site) return false;
  const tabs = await SD.JiraTabs.candidateTabs(site);
  if (!tabs.length) return false;
  const payload = {
    issueKey: meta.issueKey || "",
    summary: meta.summary || "",
    ruleName: meta.ruleName || "",
    source: meta.source || "",
    kind: meta.source === "Connection monitor" ? "API Unreachable" : "Jira issue detected",
    serverName: site.name,
    palette: alarmThemePalette(state.appearance?.theme)
  };
  let shown = 0;
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world: "ISOLATED", func: jiraAlarmPopupScript, args: [payload] });
      shown++;
    } catch (e) {
      await log(LEVEL.DEBUG, "Jira alarm popup could not be injected.", SD.Utils.safeError(e), { siteId: site.id });
    }
  }
  return shown > 0;
};
const hideJiraAlarmPopup = async siteId => {
  if (!siteId) return;
  const state = await SD.Storage.ensureState(), site = state.jiraSites.find(s => s.id === siteId);
  if (!site) return;
  const tabs = await SD.JiraTabs.candidateTabs(site);
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world: "ISOLATED", func: removeJiraAlarmPopupScript });
    } catch {}
  }
};
SD.Audio = Object.freeze({
  play: async (alarm, meta = {}) => {
    await SD.Audio.stop(false);
    await setAlarmRuntime(true, alarm, meta);
    try {
      chrome.runtime.sendMessage({ type: "SD_ALARM_STATE", active: true, alarm: { ...alarm, ...meta } }).catch(() => {});
    } catch {}
    await showAlarmNotification(alarm, meta);
    await showJiraAlarmPopup(alarm, meta);
    const timed = ["duration", "duration-or-controls", "notification-controls", "any-interaction"].includes(alarm.stopMethod || "duration-or-controls");
    if (timed) await chrome.alarms.create(ALARMS.ALARM_STOP, { when: Date.now() + Math.max(1, Number(alarm.durationSeconds) || 12) * 1000 });
    if (alarm.preset !== "system") {
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ type: "SD_OFFSCREEN_PLAY", alarm }).catch(() => {});
    }
  },
  stop: async (clearNotification = true) => {
    const state = await SD.Storage.ensureState(), active = state.runtime?.activeAlarm;
    await chrome.alarms.clear(ALARMS.ALARM_STOP).catch(() => {});
    await chrome.alarms.clear("sd-active-alarm-escalate").catch(() => {}); // remove any timer left by pre-1.5.19 builds
    // Ask the offscreen player to stop gracefully, then destroy the entire
    // offscreen audio context as a hard guarantee. The next alarm recreates it.
    await chrome.runtime.sendMessage({ type: "SD_OFFSCREEN_STOP" }).catch(() => {});
    if (chrome.offscreen?.closeDocument) {
      try {
        const contexts = chrome.runtime.getContexts ? await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [chrome.runtime.getURL("src/offscreen/alarm.html")] }) : [{}];
        if (contexts.length) await chrome.offscreen.closeDocument();
      } catch (e) {
        await log(LEVEL.DEBUG, "Offscreen alarm document close fallback failed.", SD.Utils.safeError(e));
      }
    }
    if (clearNotification) await chrome.notifications.clear("sd-companion-active-alarm").catch(() => {});
    if (active?.siteId) await hideJiraAlarmPopup(active.siteId);
    await setAlarmRuntime(false);
    await setBadge().catch(() => {});
    try {
      chrome.runtime.sendMessage({ type: "SD_ALARM_STATE", active: false }).catch(() => {});
    } catch {}
  },
  completion: async () => {
    try {
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ type: "SD_OFFSCREEN_COMPLETION" });
      return true;
    } catch (e) {
      await log(LEVEL.DEBUG, "Completion tone could not be played.", SD.Utils.safeError(e));
      return false;
    }
  }
});
const POPUP_PATH = 'src/ui/app/app.html', SIDEPANEL_PATH = 'src/ui/app/sidepanel.html';
const configureActionTarget = async (state = null) => {
  state = state || await SD.Storage.ensureState();
  const target = state.appearance?.openTarget === 'sidepanel' ? 'sidepanel' : 'popup';
  if (chrome.sidePanel) await chrome.sidePanel.setOptions({ path: SIDEPANEL_PATH, enabled: true }).catch(() => {});
  if (target === 'sidepanel') {
    await chrome.action.setPopup({ popup: '' });
    await chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
  }
  else {
    await chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
    await chrome.action.setPopup({ popup: POPUP_PATH });
  }
  return target;
};
const credentialSiteIds = async state => {
  const ids = new Set();
  for (const site of state?.jiraSites || []) if (await SD.Storage.hasCredential(site.id)) ids.add(site.id);
  return ids;
};
const reconcileCredentialTruth = async (state = null) => {
  state = state || await SD.Storage.ensureState();
  const credentialStatus = {}, missing = [];
  for (const site of state.jiraSites || []) {
    const has = await SD.Storage.hasCredential(site.id);
    credentialStatus[site.id] = has;
    if (Boolean(site.auth?.configured) !== has || (!has && (site.runtime?.apiHealthy || site.runtime?.connectionStatus !== 'pat-missing' || site.runtime?.healthState !== 'not-configured' || site.runtime?.connectionLossStartedAt || site.runtime?.connectionLossFailures || site.runtime?.connectionLossAlarmFiredAt)) || (has && site.runtime?.connectionStatus === 'pat-missing')) missing.push({ id: site.id, has });
  }
  if (missing.length) state = await SD.Storage.updateState(latest => {
    for (const x of missing) {
      const site = latest.jiraSites.find(s => s.id === x.id);
      if (!site) continue;
      site.auth = { ...(site.auth || {}), configured: x.has };
      if (!x.has) {
        site.auth.user = null;
        site.auth.lastValidatedAt = null;
        site.runtime = {
          ...(site.runtime || {}),
          apiHealthy: false,
          connectionStatus: 'pat-missing',
          healthState: 'not-configured',
          lastHealthError: '',
          lastError: '',
          lastErrorCode: 'PAT_MISSING',
          consecutiveHealthFailures: 0,
          connectionLossStartedAt: null,
          connectionLossFailures: 0,
          connectionLossAlarmFiredAt: null
        };
      }
      else if (site.runtime?.connectionStatus === 'pat-missing') {
        site.runtime = { ...(site.runtime || {}), apiHealthy: false, connectionStatus: 'check-required', healthState: 'unknown', lastHealthError: '', lastError: '', lastErrorCode: '' };
      }
    }
  });
  return { state, credentialStatus };
};
const configureMetadataSyncAlarm = async (state, credentialIds = null) => {
  await chrome.alarms.clear(ALARMS.METADATA_SYNC).catch(() => {});
  credentialIds = credentialIds || await credentialSiteIds(state);
  const now = Date.now(), due = [];
  for (const site of state.jiraSites || []) {
    const a = site.inventorySettings?.autoSync;
    if (!credentialIds.has(site.id) || !a?.enabled) continue;
    const interval = Math.max(SD.Constants.LIMITS.METADATA_SYNC_MIN_SECONDS, Math.min(SD.Constants.LIMITS.METADATA_SYNC_MAX_SECONDS, Number(a.intervalSeconds) || 3600)) * 1000;
    const next = a.nextRunAt ? new Date(a.nextRunAt).getTime() : ((site.inventory?.lastFullSyncAt ? new Date(site.inventory.lastFullSyncAt).getTime() : now) + interval);
    due.push(Math.max(now + 1000, next));
  }
  if (due.length) await chrome.alarms.create(ALARMS.METADATA_SYNC, { when: Math.min(...due) });
};
const monitoringEnabledForSite = (state, siteId) => Boolean((state?.profiles || []).some(p => p.siteId === siteId && p.monitoring?.enabled));
const monitoredSiteIds = state => new Set((state?.jiraSites || []).filter(s => s.auth?.configured && monitoringEnabledForSite(state, s.id)).map(s => s.id));
const configureAlarms = async (state = null) => {
  state = state || await SD.Storage.ensureState();
  const credentialIds = await credentialSiteIds(state);
  await chrome.alarms.clear("sd-active-alarm-escalate").catch(() => {});
  await chrome.alarms.clear(ALARMS.MONITOR).catch(() => {});
  await chrome.alarms.clear(ALARMS.HEALTH).catch(() => {});
  if (state.profiles.some(p => p.monitoring?.enabled && credentialIds.has(p.siteId))) await chrome.alarms.create(ALARMS.MONITOR, { periodInMinutes: .5 });
  if (state.jiraSites.some(s => credentialIds.has(s.id) && monitoringEnabledForSite(state, s.id))) await chrome.alarms.create(ALARMS.HEALTH, { periodInMinutes: 1 });
  await configureMetadataSyncAlarm(state, credentialIds);
};
const setBadge = async () => {
  const state = await SD.Storage.ensureState(),
    { site, profile } = getSiteProfile(state),
    hasPat = site ? await SD.Storage.hasCredential(site.id) : false;
  let text = '', color = '#64748b';
  if (state.runtime?.activeAlarm?.active) {
    text = '!';
    color = '#ef4444';
  }
  else if (site && !hasPat) {
    text = 'PAT';
    color = '#d97706';
  }
  else if (site?.runtime?.connectionStatus === 'authentication-failed' || (site && !site.runtime?.apiHealthy)) {
    text = 'ERR';
    color = '#ef4444';
  }
  else if (profile?.monitoring?.enabled) {
    const n = Number(profile.runtime?.lastDetectionCount) || 0;
    text = n > 0 ? String(Math.min(99, n)) : 'ON';
    color = '#16a36a';
  }
  else if (profile) {
    text = 'OFF';
    color = '#64748b';
  }
  await chrome.action.setBadgeText({ text });
  if (text) await chrome.action.setBadgeBackgroundColor({ color });
};
const mergeApiStats = (old = {}, stats = {}) => {
  const prev = Number(old.requests) || 0, add = Number(stats.requests) || 0, total = prev + add;
  return {
    requests: total,
    failures: (old.failures || 0) + (stats.failures || 0),
    retries: (old.retries || 0) + (stats.retries || 0),
    rateLimited: (old.rateLimited || 0) + (stats.rateLimited || 0),
    avgLatencyMs: total ? Math.round(((old.avgLatencyMs || 0) * prev + (stats.avgLatencyMs || 0) * add) / total) : 0,
    maxLatencyMs: Math.max(old.maxLatencyMs || 0, stats.maxLatencyMs || 0),
    lastRequestAt: stats.lastRequestAt || old.lastRequestAt || null,
    transport: stats.transport || old.transport || ''
  };
};
const connectionLossSettings = site => ({ enabled: true, trigger: 'either', durationSeconds: 300, durationUnit: 'minutes', failedChecks: 5, ...(site?.behavior?.connectionLossAlarm || {}) });
const connectionLossDue = site => {
  const cfg = connectionLossSettings(site),
    started = site?.runtime?.connectionLossStartedAt ? new Date(site.runtime.connectionLossStartedAt).getTime() : 0,
    elapsed = started ? Math.max(0, (Date.now() - started) / 1000) : 0,
    failures = Math.max(0, Number(site?.runtime?.connectionLossFailures) || 0),
    durationHit = Boolean(started && elapsed >= Math.max(SD.Constants.LIMITS.CONNECTION_LOSS_MIN_SECONDS, Number(cfg.durationSeconds) || 300)),
    failureHit = failures >= Math.max(1, Number(cfg.failedChecks) || 5);
  return cfg.enabled && (cfg.trigger === 'duration' ? durationHit : cfg.trigger === 'failures' ? failureHit : (durationHit || failureHit));
};
const maybePlayConnectionLossAlarm = async siteId => {
  const state = await SD.Storage.ensureState(), site = state.jiraSites.find(x => x.id === siteId);
  if (!site || !await SD.Storage.hasCredential(siteId) || !monitoringEnabledForSite(state, siteId) || site.runtime?.connectionLossAlarmFiredAt || !connectionLossDue(site) || state.runtime?.activeAlarm?.active) return false;
  const profile = state.profiles.find(p => p.id === site.activeProfileId && p.siteId === site.id && p.monitoring?.enabled) || state.profiles.find(p => p.siteId === site.id && p.monitoring?.enabled);
  if (!profile) return false;
  const cfg = { ...profile.alarmDefaults },
    started = site.runtime.connectionLossStartedAt,
    failures = Number(site.runtime.connectionLossFailures) || 0;
  await SD.Audio.play(cfg, {
    siteId: site.id,
    profileId: profile.id,
    issueKey: '',
    summary: `Jira connection to ${site.name} has been unavailable since ${SD.Utils.formatDateTime(started)} (${failures} failed health check${failures === 1 ? '' : 's'}).`,
    ruleName: 'Jira connection lost',
    source: 'Connection monitor'
  });
  const firedAt = SD.Utils.nowIso();
  await SD.Storage.updateState(latest => {
    const current = latest.jiraSites.find(x => x.id === siteId);
    if (current && !current.runtime.connectionLossAlarmFiredAt) current.runtime.connectionLossAlarmFiredAt = firedAt;
  });
  await audit('connection-loss-alarm', { startedAt: started, failures }, { siteId, profileId: profile.id });
  return true;
};
const testConnection = async (siteId, { operationId = '' } = {}) => {
  const state = await SD.Storage.ensureState(), site = state.jiraSites.find(s => s.id === siteId);
  if (!site) throw new Error('Jira server not found.');
  const token = await SD.Storage.getCredential(siteId);
  if (!token) {
    await SD.Storage.updateState(latest => {
      const s = latest.jiraSites.find(x => x.id === siteId);
      if (s) {
        s.auth = { ...(s.auth || {}), configured: false, user: null, lastValidatedAt: null };
        s.runtime = {
          ...(s.runtime || {}),
          apiHealthy: false,
          connectionStatus: 'pat-missing',
          healthState: 'not-configured',
          lastHealthError: '',
          lastError: '',
          lastErrorCode: 'PAT_MISSING',
          consecutiveHealthFailures: 0,
          connectionLossStartedAt: null,
          connectionLossFailures: 0,
          connectionLossAlarmFiredAt: null
        };
      }
    });
    await log(LEVEL.WARN, 'Jira API check skipped because the PAT is missing.', {}, { siteId });
    throw Object.assign(new Error('PAT is missing. Configure a PAT for this Jira server.'), { code: 'PAT_MISSING' });
  }
  const client = new SD.JiraApi.JiraClient(site, token, { operationId });
  try {
    const d = await client.diagnose(),
      server = d.serverInfo || {},
      browser = await SD.JiraTabs.browserStatus(site),
      at = SD.Utils.nowIso(),
      stats = client.statsSnapshot(),
      outageStarted = site.runtime?.connectionLossStartedAt || null,
      outageFailures = Number(site.runtime?.connectionLossFailures) || 0;
    const updated = await SD.Storage.updateState(latest => {
      const s = latest.jiraSites.find(x => x.id === siteId);
      if (!s) return;
      s.server = { ...s.server, deploymentType: server.deploymentType || s.server.deploymentType, version: server.version || s.server.version, serverTitle: server.serverTitle || s.name };
      s.auth = { ...s.auth, configured: true, lastValidatedAt: at, user: SD.Discovery.normalizeUser(d.myself, 'myself') };
      s.permissions = d.permissions?.permissions || s.permissions || {};
      s.capabilities = { ...s.capabilities, ...client.capabilities };
      s.runtime = {
        ...s.runtime,
        ...browser,
        connectionStatus: 'connected',
        healthState: 'healthy',
        apiHealthy: true,
        lastHealthAt: at,
        lastSuccessfulHealthAt: at,
        lastError: '',
        lastErrorCode: '',
        lastHealthError: '',
        lastTransport: d.transport || client.lastTransport,
        consecutiveHealthFailures: 0,
        connectionLossStartedAt: null,
        connectionLossFailures: 0,
        connectionLossAlarmFiredAt: null,
        apiStats: mergeApiStats(s.runtime?.apiStats, stats)
      };
    });
    await audit('health-ok', { transport: d.transport || client.lastTransport, warnings: d.warnings }, { siteId });
    await log(LEVEL.INFO, 'Jira health check succeeded.', { transport: d.transport || client.lastTransport, warnings: d.warnings || [] }, { siteId });
    if (outageStarted) await audit('connection-recovered', { startedAt: outageStarted, failedChecks: outageFailures, recoveredAt: at }, { siteId });
    const s = updated.jiraSites.find(x => x.id === siteId);
    return { server: s?.server, user: s?.auth?.user, warnings: d.warnings, permissions: s?.permissions, capabilities: s?.capabilities };
  } catch (e) {
    if (e.code === 'OPERATION_CANCELLED') throw e;
    const authFailure = e.status === 401 || e.status === 403,
      at = SD.Utils.nowIso(),
      watching = monitoringEnabledForSite(state, siteId);
    await SD.Storage.updateState(latest => {
      const s = latest.jiraSites.find(x => x.id === siteId);
      if (!s) return;
      const failures = (s.runtime.consecutiveHealthFailures || 0) + 1,
        lossFailures = watching ? (s.runtime.connectionLossFailures || 0) + 1 : 0;
      s.runtime.lastHealthAt = at;
      s.runtime.lastHealthError = e.message;
      s.runtime.lastError = e.message;
      s.runtime.lastErrorCode = e.code || '';
      s.runtime.consecutiveHealthFailures = failures;
      s.runtime.connectionLossStartedAt = watching ? (s.runtime.connectionLossStartedAt || at) : null;
      s.runtime.connectionLossFailures = lossFailures;
      if (!watching) s.runtime.connectionLossAlarmFiredAt = null;
      s.runtime.apiHealthy = false;
      if (authFailure) {
        s.runtime.connectionStatus = 'authentication-failed';
        s.runtime.healthState = 'authentication-failed';
      }
      else if (e.code === 'NETWORK_REQUEST_FAILED') {
        s.runtime.connectionStatus = 'network-request-failed';
        s.runtime.healthState = 'network-request-failed';
      }
      else {
        s.runtime.connectionStatus = 'degraded';
        s.runtime.healthState = 'degraded';
      }
    });
    await log(authFailure ? LEVEL.ERROR : LEVEL.WARN, 'Jira health check failed.', SD.Utils.safeError(e), { siteId });
    await audit('health-failed', { error: SD.Utils.safeError(e), monitoring: watching }, { siteId });
    await maybePlayConnectionLossAlarm(siteId).catch(async alarmError => log(LEVEL.ERROR, 'Connection-loss alarm failed', SD.Utils.safeError(alarmError), { siteId }));
    throw e;
  }
};
const scheduleNextCycle = (profile, now = Date.now()) => {
  profile.runtime = profile.runtime || {};
  const L = SD.Constants.LIMITS,
    base = Math.max(L.POLL_MIN_SECONDS, Math.min(L.POLL_MAX_SECONDS, Number(profile.monitoring?.intervalSeconds) || 60)) * 1000,
    j = Math.max(0, Math.min(L.POLL_JITTER_MAX, Number(profile.monitoring?.pollJitterPercent) || 0)) / 100,
    span = base * j,
    delay = Math.max(30000, Math.round(base + (Math.random() * 2 - 1) * span));
  profile.runtime.nextCycleAt = new Date(now + delay).toISOString();
  return delay;
};
const queryRuleIssues = async (site, profile, { operationId = '', safety = null } = {}) => {
  const token = await SD.Storage.getCredential(site.id);
  if (!token) throw new Error('PAT is missing.');
  const client = new SD.JiraApi.JiraClient(site, token, { operationId }),
    map = new Map(),
    cursorUpdates = [],
    at = new Date();
  for (const rule of (profile.rules || []).filter(r => r.enabled)) {
    SD.Operations.throwIfCancelled(operationId);
    rule.runtime = rule.runtime || {};
    rule.runtime.lastRunAt = SD.Utils.nowIso();
    if (!SD.RuleEngine.ruleScheduleActive(profile, rule, at)) continue;
    const cursor = await SD.Storage.getCursor(profile.id, rule.id),
      preview = SD.RuleQuery.preview(rule, cursor);
    if (!preview.hasConstraint) {
      await audit('rule-skipped-unconstrained', { ruleName: rule.name }, { siteId: site.id, profileId: profile.id, ruleId: rule.id });
      continue;
    }
    const maxIssues = Math.max(1, Math.min(SD.Constants.LIMITS.RULE_MAX_ISSUES, Number(safety?.maxIssuesPerCycle) || 25)),
      raw = await client.search(preview.effectiveJql, { maxIssues, fields: SD.RuleEngine.requiredIssueFields(rule) });
    for (const x of raw) {
      const i = SD.Discovery.normalizeIssue(x, (rule.source?.filterIds || []).length === 1 ? String(rule.source.filterIds[0]) : ''),
        existing = map.get(i.key);
      if (existing) {
        existing._sourceRuleIds = [...new Set([...(existing._sourceRuleIds || []), rule.id])];
        existing.fields = { ...(existing.fields || {}), ...(i.fields || {}) };
      }
      else {
        i._sourceRuleIds = [rule.id];
        map.set(i.key, i);
      }
    }
    cursorUpdates.push({ ruleId: rule.id, lastSuccessfulAt: SD.Utils.nowIso(), lastResultCount: raw.length, lastJql: preview.baseJql });
  }
  return { issues: [...map.values()], cursorUpdates, client };
};
const collectCurrentMatches = async (site, profile, client, { operationId = '', safety = null } = {}) => {
  const rows = [],
    detections = [],
    seen = new Set(),
    at = new Date(),
    maxIssues = Math.max(1, Math.min(SD.Constants.LIMITS.RULE_MAX_ISSUES, Number(safety?.maxIssuesPerCycle) || 25));
  for (const rule of (profile.rules || []).filter(r => r.enabled).sort((a, b) => (Number(a.priority) || 100) - (Number(b.priority) || 100))) {
    SD.Operations.throwIfCancelled(operationId);
    if (!SD.RuleEngine.ruleScheduleActive(profile, rule, at)) continue;
    const jql = SD.RuleQuery.baseJql(rule);
    if (!jql) continue;
    const raw = await client.search(`${jql} ORDER BY updated DESC`, { maxIssues, fields: SD.RuleEngine.requiredIssueFields(rule) });
    for (const x of raw) {
      const issue = SD.Discovery.normalizeIssue(x, (rule.source?.filterIds || []).length === 1 ? String(rule.source.filterIds[0]) : '');
      if (!SD.RuleEngine.matchesLogic(issue, rule.logic)) continue;
      const key = `${rule.id}:${issue.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const detectedAt = SD.Utils.nowIso();
      rows.push({ issueKey: issue.key, summary: issue.summary || '', projectKey: issue.projectKey || '', status: issue.status || '', ruleId: rule.id, ruleName: rule.name || 'Rule', at: detectedAt });
      detections.push({ issueKey: issue.key, ruleId: rule.id, issue, at: detectedAt });
      if (rows.length >= 500) break;
    }
    if (rows.length >= 500) break;
  }
  return { rows, detections };
};
const scanCurrentMatches = async (siteId, profileId, { operationId = '' } = {}) => {
  const state = await SD.Storage.ensureState(),
    { site, profile } = getSiteProfile(state, siteId, profileId);
  if (!site || !profile) throw new Error('Select a Jira server and profile.');
  const token = await SD.Storage.getCredential(site.id);
  if (!token) throw new Error('PAT is missing.');
  const client = new SD.JiraApi.JiraClient(site, token, { operationId }),
    snapshot = await collectCurrentMatches(site, profile, client, { operationId, safety: state.system?.safety }),
    checkedAt = SD.Utils.nowIso(),
    keys = [...new Set(snapshot.detections.map(d => d.issueKey))],
    stats = client.statsSnapshot();
  await SD.Storage.updateState(latest => {
    const p = latest.profiles.find(x => x.id === profile.id),
      s = latest.jiraSites.find(x => x.id === site.id);
    if (p) {
      p.runtime = p.runtime || {};
      p.runtime.currentDetections = snapshot.rows;
      p.runtime.currentDetectionsAt = checkedAt;
      p.runtime.lastDetectionKeys = keys;
      p.runtime.lastDetectionCount = snapshot.detections.length;
    }
    if (s) {
      s.runtime.apiStats = mergeApiStats(s.runtime.apiStats, stats);
      updateRadar(s, p || profile, snapshot.detections);
    }
  });
  await audit('current-matches-refreshed', { matches: snapshot.rows.length }, { siteId: site.id, profileId: profile.id });
  await setBadge();
  return { matches: snapshot.rows, checkedAt };
};
const updateRadar = (site, profile, detections) => {
  const retention = Math.max(1, Number(profile.radar?.retentionMinutes) || 45) * 60000,
    cut = Date.now() - retention,
    history = (site.runtime.radarEvents || []).filter(e => new Date(e.at).getTime() >= cut),
    profileMarkers = (site.runtime.radarMarkers || []).filter(e => e.profileId === profile.id),
    previousMarkers = new Map(profileMarkers.map(e => [e.issueKey, e])),
    otherMarkers = (site.runtime.radarMarkers || []).filter(e => e.profileId !== profile.id),
    uniqueIssues = new Map();
  for (const d of detections) {
    if (!uniqueIssues.has(d.issueKey)) uniqueIssues.set(d.issueKey, d);
  }
  const current = [...uniqueIssues.values()].slice(0, profile.radar?.maxMarkers || 12).map(d => {
    const previous = previousMarkers.get(d.issueKey);
    return {
      id: `${profile.id}:${d.issueKey}`,
      at: previous?.at || d.at,
      issueKey: d.issueKey,
      summary: d.issue.summary,
      projectKey: d.issue.projectKey,
      status: d.issue.status,
      ruleId: d.ruleId,
      profileId: profile.id
    };
  });
  site.runtime.radarMarkers = [...otherMarkers, ...current].slice(0, 100);
  for (const d of detections) {
    const row = { id: crypto.randomUUID(), at: d.at, issueKey: d.issueKey, summary: d.issue.summary, projectKey: d.issue.projectKey, status: d.issue.status, ruleId: d.ruleId, profileId: profile.id },
      key = `${profile.id}:${d.ruleId}:${d.issueKey}`,
      idx = history.findIndex(e => `${e.profileId}:${e.ruleId}:${e.issueKey}` === key);
    if (idx >= 0) history.splice(idx, 1);
    history.unshift(row);
  }
  site.runtime.radarEvents = history.slice(0, 100);
};
const handleJiraTabsForDetection = async (site, newDetections = []) => {
  const refresh = Boolean(site?.behavior?.autoRefreshJiraTabsOnDetection),
    focus = Boolean(site?.behavior?.focusJiraTabOnDetection);
  if ((!refresh && !focus) || !newDetections.length) return { refreshed: 0, focused: 0 };
  const tabs = await SD.JiraTabs.matchingTabs(site), failures = [];
  let refreshed = 0, focused = 0, focusTarget = null;
  if (refresh) {
    for (const tab of tabs) {
      if (!Number.isInteger(tab.id)) continue;
      try {
        await chrome.tabs.reload(tab.id, { bypassCache: false });
        refreshed++;
      }
      catch (e) {
        try {
          const url = tab.url || tab.pendingUrl;
          if (!url) throw e;
          await chrome.tabs.update(tab.id, { url });
          refreshed++;
        } catch (fallbackError) {
          failures.push({ tabId: tab.id, url: tab.url || tab.pendingUrl || '', primary: SD.Utils.safeError(e), fallback: SD.Utils.safeError(fallbackError) });
        }
      }
    }
  }
  if (focus && tabs.length) {
    const keys = [...new Set(newDetections.map(d => String(d.issueKey || '')).filter(Boolean))];
    focusTarget = tabs.find(t => keys.some(k => String(t.url || t.pendingUrl || '').includes(`/browse/${k}`))) || tabs.find(t => t.active) || tabs[0];
    if (Number.isInteger(focusTarget?.id)) {
      try {
        await chrome.tabs.update(focusTarget.id, { active: true });
        if (Number.isInteger(focusTarget.windowId) && chrome.windows?.update) await chrome.windows.update(focusTarget.windowId, { focused: true });
        focused = 1;
      } catch (e) {
        failures.push({ tabId: focusTarget.id, url: focusTarget.url || focusTarget.pendingUrl || '', focus: SD.Utils.safeError(e) });
      }
    }
  }
  const at = SD.Utils.nowIso();
  await SD.Storage.updateState(state => {
    const current = state.jiraSites.find(x => x.id === site.id);
    if (current) {
      if (refresh) {
        current.runtime.lastTabRefreshAt = at;
        current.runtime.lastTabRefreshCount = refreshed;
        current.runtime.lastTabRefreshMatched = tabs.length;
        current.runtime.lastTabRefreshFailures = failures.length;
      }
      if (focus) {
        current.runtime.lastTabFocusAt = at;
        current.runtime.lastTabFocusCount = focused;
        current.runtime.lastTabFocusIssueKey = focusTarget ? String(newDetections[0]?.issueKey || '') : '';
      }
    }
  }).catch(() => {});
  await audit('jira-tabs-detection-handling', { matchedTabs: tabs.length, refreshEnabled: refresh, refreshed, focusEnabled: focus, focused, failures, newIssueKeys: [...new Set(newDetections.map(d => d.issueKey))] }, { siteId: site.id });
  if (!tabs.length) await log(LEVEL.WARN, 'Jira tab detection behavior was enabled, but no matching Jira tab was open.', { refresh, focus, baseUrl: site.baseUrl }, { siteId: site.id });
  if (failures.length) await log(LEVEL.WARN, 'Some Jira tab detection operations failed.', { refreshed, focused, failures }, { siteId: site.id });
  return { refreshed, focused };
};
const runCycle = async (siteId = null, profileId = null, { operationId = "", manual = false } = {}) => {
  let state = await SD.Storage.ensureState();
  let { site, profile } = getSiteProfile(state, siteId, profileId);
  if (!site || !profile) throw new Error("Select a Jira server and profile.");
  if (!manual && !profile.monitoring?.enabled) throw new Error("Monitoring is off.");
  SD.Operations.throwIfCancelled(operationId);
  const q = await queryRuleIssues(site, profile, { operationId, safety: state.system?.safety });
  SD.Operations.throwIfCancelled(operationId);
  const { plans, detections } = await SD.RuleEngine.planCycle(site, profile, q.issues, new Date(), { safety: state.system?.safety });
  SD.Operations.throwIfCancelled(operationId);
  // Action planning stays incremental/cursor-based, but the UI/radar must represent the full current truth.
  const current = await collectCurrentMatches(site, profile, q.client, { operationId, safety: state.system?.safety }),
    at = SD.Utils.nowIso();
  const previousKeys = new Set(profile.runtime?.lastDetectionKeys || []),
    currentKeys = [...new Set(current.detections.map(d => d.issueKey))];
  const newDetections = [...new Map(current.detections.filter(d => !previousKeys.has(d.issueKey)).map(d => [d.issueKey, d])).values()];
  for (const c of q.cursorUpdates) await SD.Storage.setCursor(profile.id, c.ruleId, c);
  profile.runtime = profile.runtime || {};
  profile.runtime.lastCycleAt = at;
  profile.runtime.lastIssueCount = q.issues.length;
  profile.runtime.lastDetectionCount = current.detections.length;
  profile.runtime.lastPlanCount = plans.length;
  profile.runtime.lastDetectionKeys = currentKeys;
  profile.runtime.currentDetections = current.rows;
  profile.runtime.currentDetectionsAt = at;
  if (profile.monitoring?.enabled) scheduleNextCycle(profile);
  await SD.Storage.updateState(latest => {
    const s = latest.jiraSites.find(x => x.id === site.id),
      p = latest.profiles.find(x => x.id === profile.id);
    if (p) {
      p.runtime = { ...p.runtime, ...profile.runtime };
      const byId = new Map((profile.rules || []).map(r => [r.id, r]));
      for (const rr of p.rules || []) {
        const src = byId.get(rr.id);
        if (src?.runtime) rr.runtime = src.runtime;
      }
    }
    if (s) {
      s.runtime.lastCycleAt = at;
      s.runtime.lastIssueCount = q.issues.length;
      s.runtime.apiStats = mergeApiStats(s.runtime.apiStats, q.client.statsSnapshot());
      updateRadar(s, p || profile, current.detections);
    }
  });
  await SD.JobQueue.enqueue(plans);
  await handleJiraTabsForDetection(site, newDetections);
  for (const d of detections) await audit("issue-matched", { summary: d.issue.summary, status: d.issue.status, projectKey: d.issue.projectKey }, { siteId: site.id, profileId: profile.id, ruleId: d.ruleId, issueKey: d.issueKey });
  await audit("cycle-complete", { manual, issues: q.issues.length, incrementalDetections: detections.length, currentDetections: current.detections.length, newDetections: newDetections.length, plans: plans.length }, { siteId: site.id, profileId: profile.id });
  await log(LEVEL.INFO, 'Monitoring cycle completed.', { manual, issues: q.issues.length, currentDetections: current.detections.length, newDetections: newDetections.length, queuedActions: plans.length }, { siteId: site.id, profileId: profile.id });
  try {
    chrome.runtime.sendMessage({ type: "SD_CYCLE_DONE", siteId: site.id, profileId: profile.id, manual, issues: q.issues.length, detections: current.detections.length, newDetections: newDetections.length, plans: plans.length }).catch(() => {});
  } catch {}
  await setBadge();
  return { skipped: false, issues: q.issues, plans, detections: current.detections, newDetections };
};
const monitorTick = async () => {
  let state = await SD.Storage.ensureState();
  for (const seed of state.profiles.filter(p => p.monitoring?.enabled)) {
    state = await SD.Storage.ensureState();
    const profile = state.profiles.find(p => p.id === seed.id);
    if (!profile?.monitoring?.enabled) continue;
    const site = state.jiraSites.find(s => s.id === profile.siteId);
    if (!site || !await SD.Storage.hasCredential(site.id)) continue;
    const next = profile.runtime?.nextCycleAt ? new Date(profile.runtime.nextCycleAt).getTime() : 0;
    if (next && Date.now() < next) continue;
    try {
      await runCycle(site.id, profile.id, { manual: false });
    } catch (e) {
      scheduleNextCycle(profile);
      await SD.Storage.updateState(latest => {
        const p = latest.profiles.find(x => x.id === profile.id);
        if (p) p.runtime = { ...p.runtime, ...profile.runtime };
      });
      await log(LEVEL.ERROR, 'Scheduled cycle failed', SD.Utils.safeError(e), { siteId: site.id, profileId: profile.id });
    }
  }
  await setBadge();
};
const healthTick = async () => {
  await SD.Discovery.refreshBrowserStatus();
  const { state } = await reconcileCredentialTruth();
  for (const site of state.jiraSites.filter(s => s.auth.configured && monitoringEnabledForSite(state, s.id))) {
    if (!await SD.Storage.hasCredential(site.id)) continue;
    const degraded = site.runtime?.healthState === 'degraded' || !site.runtime?.apiHealthy,
      watching = connectionLossSettings(site).enabled,
      seconds = degraded || watching ? 60 : Math.max(60, Number(site.network?.requestPolicy?.healthIntervalSeconds) || 300),
      interval = seconds * 1000,
      last = site.runtime.lastHealthAt ? new Date(site.runtime.lastHealthAt).getTime() : 0;
    if (Date.now() - last >= interval) try {
      await testConnection(site.id);
    } catch {}
    else if (site.runtime?.connectionLossStartedAt) await maybePlayConnectionLossAlarm(site.id).catch(() => {});
  }
  await setBadge();
};
const metadataSyncTick = async () => {
  let state = await SD.Storage.ensureState(), now = Date.now();
  for (const seed of state.jiraSites.filter(s => s.auth?.configured && s.inventorySettings?.autoSync?.enabled)) {
    state = await SD.Storage.ensureState();
    const site = state.jiraSites.find(s => s.id === seed.id);
    if (!site?.inventorySettings?.autoSync?.enabled || !await SD.Storage.hasCredential(site.id)) continue;
    const a = site.inventorySettings.autoSync,
      interval = Math.max(SD.Constants.LIMITS.METADATA_SYNC_MIN_SECONDS, Math.min(SD.Constants.LIMITS.METADATA_SYNC_MAX_SECONDS, Number(a.intervalSeconds) || 3600));
    const due = a.nextRunAt ? new Date(a.nextRunAt).getTime() : ((site.inventory?.lastFullSyncAt ? new Date(site.inventory.lastFullSyncAt).getTime() : 0) + interval * 1000);
    if (due && now < due) continue;
    try {
      if (!SD.Utils.discoveryProjectKeys(site.inventorySettings).length) throw new Error('Periodic metadata sync has no configured project datasets.');
      await SD.Discovery.syncSite(site.id);
      await SD.Storage.updateState(latest => {
        const x = latest.jiraSites.find(v => v.id === site.id);
        if (x) {
          x.inventorySettings.autoSync.lastRunAt = SD.Utils.nowIso();
          x.inventorySettings.autoSync.nextRunAt = new Date(Date.now() + interval * 1000).toISOString();
        }
      });
      await audit('metadata-auto-sync-complete', { intervalSeconds: interval }, { siteId: site.id });
    } catch (e) {
      await SD.Storage.updateState(latest => {
        const x = latest.jiraSites.find(v => v.id === site.id);
        if (x) {
          x.inventorySettings.autoSync.lastRunAt = SD.Utils.nowIso();
          x.inventorySettings.autoSync.nextRunAt = new Date(Date.now() + interval * 1000).toISOString();
        }
      }).catch(() => {});
      await log(LEVEL.ERROR, 'Periodic metadata sync failed', SD.Utils.safeError(e), { siteId: site.id });
    }
  }
  await configureMetadataSyncAlarm(await SD.Storage.ensureState());
};
const setMonitoringEnabled = async (profileId, enabled) => {
  const before = await SD.Storage.ensureState(), was = monitoredSiteIds(before);
  let state = await SD.Storage.updateState(latest => {
    const p = latest.profiles.find(x => x.id === profileId);
    if (!p) throw new Error('Profile not found.');
    p.monitoring = p.monitoring || {};
    p.monitoring.enabled = Boolean(enabled);
    p.runtime = p.runtime || {};
    p.runtime.nextCycleAt = null;
  }, { configWrite: true });
  const now = monitoredSiteIds(state),
    started = [...now].filter(id => !was.has(id)),
    stopped = [...was].filter(id => !now.has(id));
  if (stopped.length) {
    state = await SD.Storage.updateState(latest => {
      for (const id of stopped) {
        const site = latest.jiraSites.find(x => x.id === id);
        if (site) {
          site.runtime.connectionLossStartedAt = null;
          site.runtime.connectionLossFailures = 0;
          site.runtime.connectionLossAlarmFiredAt = null;
        }
      }
    });
    const active = state.runtime?.activeAlarm;
    if (active?.active && active.source === 'Connection monitor' && stopped.includes(active.siteId)) await SD.Audio.stop();
  }
  await configureActionTarget(state);
  await configureAlarms();
  for (const id of started) {
    const latest = await SD.Storage.ensureState();
    if (monitoredSiteIds(latest).has(id)) await testConnection(id).catch(() => {});
  }
  state = await SD.Storage.ensureState();
  await setBadge();
  return state;
};
const mergeProfileConfig = (cur, client) => {
  const runtime = cur?.runtime || client.runtime || {},
    curRules = new Map((cur?.rules || []).map(r => [r.id, r]));
  return { ...client, runtime, rules: (client.rules || []).map(r => ({ ...r, runtime: curRules.get(r.id)?.runtime || r.runtime })) };
};
const sameArray = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
const discoveryScopeSignature = v => JSON.stringify({
  selected: [...SD.Utils.discoveryProjectKeys(v)].sort(),
  projectDatasets: Object.fromEntries(Object.entries(v?.projectDatasets || {}).sort(([a], [b]) => a.localeCompare(b))),
  globalDatasets: v?.globalDatasets || {}
});
const validateProfileState = (state, scope = 'profile') => {
  if (scope === 'none') return [];
  const errors = [];
  if (scope === 'profile') {
    const p = state.profiles.find(x => x.id === state.activeProfileId) || state.profiles.find(x => x.siteId === state.activeSiteId);
    if (p?.siteId) errors.push(...SD.Validators.validateProfile(p));
    return errors;
  }
  for (const p of state?.profiles || []) if (p.siteId) errors.push(...SD.Validators.validateProfile(p));
  return errors;
};
const mergeClientState = (latest, incoming, { fullImport = false } = {}) => {
  latest.appearance = { ...latest.appearance, ...(incoming.appearance || {}) };
  latest.system = { ...latest.system, ...(incoming.system || {}) };
  latest.activeSiteId = incoming.activeSiteId ?? latest.activeSiteId;
  latest.activeProfileId = incoming.activeProfileId ?? latest.activeProfileId;
  if (fullImport) {
    latest.profiles = structuredClone(incoming.profiles || []);
    latest.jiraSites = structuredClone(incoming.jiraSites || []).map(s => ({ ...s, auth: { ...(s.auth || {}), token: undefined } }));
    return latest;
  }
  const currentProfiles = new Map(latest.profiles.map(p => [p.id, p]));
  latest.profiles = (incoming.profiles || []).map(p => mergeProfileConfig(currentProfiles.get(p.id), p));
  const currentSites = new Map(latest.jiraSites.map(s => [s.id, s]));
  latest.jiraSites = (incoming.jiraSites || []).map(client => {
    const cur = currentSites.get(client.id);
    if (!cur) return client;
    const inv = { ...cur.inventorySettings, ...client.inventorySettings };
    if (discoveryScopeSignature(cur.inventorySettings) !== discoveryScopeSignature(client.inventorySettings)) inv.scopeRevision = (Number(cur.inventorySettings?.scopeRevision) || 0) + 1;
    return {
      ...cur,
      name: client.name,
      baseUrl: client.baseUrl,
      activeProfileId: client.activeProfileId,
      icon: client.icon,
      behavior: { ...cur.behavior, ...(client.behavior || {}) },
      network: { ...cur.network, ...client.network, requestPolicy: { ...cur.network?.requestPolicy, ...client.network?.requestPolicy } },
      inventorySettings: inv,
      auth: { ...cur.auth, persistence: client.auth?.persistence || cur.auth?.persistence }
    };
  });
  return latest;
};
const withOperation = async (message, type, fn) => {
  const id = message.operationId || crypto.randomUUID();
  SD.Operations.start(id, type);
  try {
    return await fn(id);
  } finally {
    SD.Operations.finish(id);
  }
};
let tabRefreshTimer = null;
const queueTabStatusRefresh = () => {
  clearTimeout(tabRefreshTimer);
  tabRefreshTimer = setTimeout(() => SD.Discovery.refreshBrowserStatus().catch(() => {}), 3000);
};
chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === 'install') await SD.Storage.factoryReset();
  else {
    await SD.Storage.ensureState();
    await SD.Storage.cleanupLegacyExecutionArtifacts();
  }
  await configureActionTarget();
  await configureAlarms();
  await SD.JobQueue.restore();
  await SD.Discovery.refreshBrowserStatus();
  await setBadge();
});
chrome.runtime.onStartup.addListener(async () => {
  await SD.Storage.cleanupLegacyExecutionArtifacts();
  await configureActionTarget();
  await configureAlarms();
  await SD.JobQueue.restore();
  await SD.Discovery.refreshBrowserStatus();
  await setBadge();
});
chrome.tabs.onUpdated.addListener(queueTabStatusRefresh);
chrome.tabs.onRemoved.addListener(queueTabStatusRefresh);
chrome.alarms.onAlarm.addListener(async a => {
  try {
    if (a.name === ALARMS.MONITOR) await monitorTick();
    else if (a.name === ALARMS.HEALTH) await healthTick();
    else if (a.name === ALARMS.METADATA_SYNC) await metadataSyncTick();
    else if (a.name === ALARMS.ALARM_STOP) await SD.Audio.stop();
    else if (a.name === "sd-active-alarm-escalate") await chrome.alarms.clear(a.name);
    else if (a.name.startsWith('sd-job-')) await SD.JobQueue.process(a.name.slice(7));
  } catch (e) {
    await log(LEVEL.ERROR, 'Alarm handler failed', SD.Utils.safeError(e));
  }
});
chrome.commands?.onCommand?.addListener(command => {
  if (command === 'stop-alarm') SD.Audio.stop().catch(() => {});
});
chrome.notifications.onButtonClicked.addListener((id, index) => {
  if (id === 'sd-companion-active-alarm' && index === 0) SD.Audio.stop().catch(() => {});
});
chrome.notifications.onClicked.addListener(id => {
  if (id === 'sd-companion-active-alarm') chrome.action.openPopup?.().catch(() => {});
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SD_OFFSCREEN_ENDED') {
    SD.Audio.stop().catch(() => {});
    sendResponse?.({ ok: true });
    return false;
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      await enforceExtensionUnlock(message?.type);
      switch (message?.type) {
        case MESSAGE.GET_SECURITY_STATUS: return { ok: true, security: await SD.Storage.securityStatus() };
        case MESSAGE.VERIFY_SECURITY: {
          const mode = message.mode === 'risk' ? 'risk' : 'unlock';
          if (mode === 'risk') {
            const result = await SD.Storage.issueSecurityRiskToken(message.passcode);
            await audit('security-reauthenticated', { purpose: String(message.purpose || 'sensitive action').slice(0, 120) });
            return { ok: true, security: result.status, riskToken: result.token };
          }
          const security = await SD.Storage.unlockSecurity(message.passcode);
          await audit('extension-unlocked', {});
          return { ok: true, security };
        }
        case MESSAGE.SET_SECURITY_PASSCODE: {
          const current = await SD.Storage.securityStatus();
          if (current.enabled)
            await requireRiskAuth(message, 'change the extension passcode');
          const security = await SD.Storage.setSecurityPasscode({ method: message.method, passcode: message.passcode, sessionMinutes: message.sessionMinutes });
          await audit(current.enabled ? 'extension-passcode-changed' : 'extension-lock-enabled', { method: security.method, sessionMinutes: security.sessionMinutes });
          return { ok: true, security };
        }
        case MESSAGE.UPDATE_SECURITY_SETTINGS: {
          await requireRiskAuth(message, 'change extension lock settings');
          const security = await SD.Storage.updateSecuritySettings({ sessionMinutes: message.sessionMinutes });
          await audit('extension-lock-settings-changed', { sessionMinutes: security.sessionMinutes });
          return { ok: true, security };
        }
        case MESSAGE.DISABLE_SECURITY: {
          await requireRiskAuth(message, 'disable the extension lock');
          const security = await SD.Storage.disableSecurity();
          await audit('extension-lock-disabled', {});
          return { ok: true, security };
        }
        case MESSAGE.LOCK_EXTENSION: {
          const security = await SD.Storage.lockSecurity();
          await audit('extension-locked', {});
          return { ok: true, security };
        }
        case MESSAGE.GET_STATE: {
          const { state, credentialStatus } = await reconcileCredentialTruth();
          return { ok: true, state, credentialStatus };
        }
        case MESSAGE.SET_MONITORING: return { ok: true, state: await setMonitoringEnabled(message.profileId, message.enabled) };
        case MESSAGE.SAVE_STATE: {
          if (message.fullImport)
            await requireRiskAuth(message, 'apply an imported profile backup');
          const before = await SD.Storage.ensureState(), was = monitoredSiteIds(before);
          let state = await SD.Storage.updateState(latest => {
            mergeClientState(latest, message.state, { fullImport: Boolean(message.fullImport) });
            const errors = validateProfileState(latest, message.validationScope || 'profile');
            if (errors.length)
              throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
          }, { configWrite: true, expectedRevision: message.baseRevision });
          const now = monitoredSiteIds(state),
            started = [...now].filter(id => !was.has(id)),
            stopped = [...was].filter(id => !now.has(id));
          if (stopped.length) {
            state = await SD.Storage.updateState(latest => {
              for (const id of stopped) {
                const site = latest.jiraSites.find(x => x.id === id);
                if (site) {
                  site.runtime.connectionLossStartedAt = null;
                  site.runtime.connectionLossFailures = 0;
                  site.runtime.connectionLossAlarmFiredAt = null;
                }
              }
            });
            const active = state.runtime?.activeAlarm;
            if (active?.active && active.source === 'Connection monitor' && stopped.includes(active.siteId))
              await SD.Audio.stop();
          }
          await configureActionTarget(state);
          await configureAlarms(state);
          for (const id of started)
            await testConnection(id).catch(() => {});
          if (started.length)
            state = await SD.Storage.ensureState();
          await setBadge();
          return { ok: true, state };
        }
        case MESSAGE.UPDATE_APPEARANCE: {
          const state = await SD.Storage.updateState(s => {
            s.appearance = { ...s.appearance, ...(message.appearance || {}) };
          }, { configWrite: true });
          await configureActionTarget(state);
          return { ok: true, state };
        }
        case MESSAGE.UPDATE_SYSTEM: {
          const incoming = message.system || {};
          if (incoming.safety) {
            const next = { ...SD.Defaults.safety(), ...((await SD.Storage.ensureState()).system?.safety || {}), ...incoming.safety },
              errors = SD.Validators.validateSafety(next);
            if (errors.length)
              throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
          }
          if (incoming.activityRefreshSeconds !== undefined) {
            const n = Number(incoming.activityRefreshSeconds), L = SD.Constants.LIMITS;
            if (!Number.isFinite(n) || n < L.ACTIVITY_REFRESH_MIN_SECONDS || n > L.ACTIVITY_REFRESH_MAX_SECONDS)
              throw Object.assign(new Error(`Home activity refresh interval must be between ${L.ACTIVITY_REFRESH_MIN_SECONDS} and ${L.ACTIVITY_REFRESH_MAX_SECONDS} seconds.`), { code: 'VALIDATION_ERROR' });
          }
          const state = await SD.Storage.updateState(s => {
            s.system = { ...s.system, ...incoming, safety: incoming.safety ? { ...s.system?.safety, ...incoming.safety } : s.system?.safety };
          }, { configWrite: true });
          return { ok: true, state };
        }
        case MESSAGE.SAVE_SETTINGS: {
          const incoming = message.system || {},
            siteId = message.siteId || '',
            autoSync = message.autoSync || null,
            openTarget = message.openTarget === 'sidepanel' ? 'sidepanel' : 'popup',
            L = SD.Constants.LIMITS;
          if (incoming.safety) {
            const errors = SD.Validators.validateSafety({ ...SD.Defaults.safety(), ...incoming.safety });
            if (errors.length)
              throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
          }
          if (incoming.activityRefreshSeconds !== undefined) {
            const n = Number(incoming.activityRefreshSeconds);
            if (!Number.isFinite(n) || n < L.ACTIVITY_REFRESH_MIN_SECONDS || n > L.ACTIVITY_REFRESH_MAX_SECONDS)
              throw Object.assign(new Error(`Home activity refresh interval must be between ${L.ACTIVITY_REFRESH_MIN_SECONDS} and ${L.ACTIVITY_REFRESH_MAX_SECONDS} seconds.`), { code: 'VALIDATION_ERROR' });
          }
          if (autoSync) {
            const errors = SD.Validators.validateAutoSync(autoSync);
            if (errors.length)
              throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
          }
          const state = await SD.Storage.updateState(s => {
            s.system = { ...s.system, ...incoming, safety: incoming.safety ? { ...s.system?.safety, ...incoming.safety } : s.system?.safety };
            s.appearance.openTarget = openTarget;
            if (autoSync && siteId) {
              const site = s.jiraSites.find(x => x.id === siteId);
              if (!site)
                throw new Error('Server not found.');
              site.inventorySettings.autoSync = { ...site.inventorySettings.autoSync, ...autoSync };
            }
          }, { configWrite: true });
          await configureActionTarget(state);
          await configureAlarms(state);
          return { ok: true, state };
        }
        case MESSAGE.LOG_UI_EVENT: {
          const level = [LEVEL.DEBUG, LEVEL.INFO, LEVEL.WARN, LEVEL.ERROR].includes(message.level) ? message.level : LEVEL.INFO,
            text = String(message.message || '').slice(0, 1200);
          if (text) {
            const extra = { siteId: String(message.siteId || ''), profileId: String(message.profileId || '') };
            await log(level, text, { source: 'ui', page: String(message.page || '').slice(0, 80) }, extra);
            await audit(level === LEVEL.ERROR ? 'ui-error' : level === LEVEL.WARN ? 'ui-warning' : 'ui-notice', { message: text, page: String(message.page || '').slice(0, 80) }, extra);
          }
          return { ok: true };
        }
        case MESSAGE.GET_LOGS: {
          const logs = await SD.Storage.getLogs();
          return { ok: true, logs: message.limit ? logs.slice(0, Math.max(1, Number(message.limit) || 500)) : logs };
        }
        case MESSAGE.GET_AUDIT: {
          const auditRows = await SD.Storage.getAudit();
          return { ok: true, audit: message.limit ? auditRows.slice(0, Math.max(1, Number(message.limit) || 500)) : auditRows };
        }
        case MESSAGE.CLEAR_LOGS:
          await requireRiskAuth(message, 'clear the logs');
          await SD.Storage.clearLogs();
          return { ok: true };
        case MESSAGE.CLEAR_AUDIT:
          await requireRiskAuth(message, 'clear the audit journal');
          await SD.Storage.clearAudit();
          return { ok: true };
        case MESSAGE.CANCEL_OPERATION: return { ok: true, cancelled: SD.Operations.cancel(message.operationId) };
        case MESSAGE.ADD_SERVER:
          if (message.token)
            await requireRiskAuth(message, 'save a Jira PAT');
          return await withOperation(message, 'add-server', async (operationId) => {
            const r = await SD.Discovery.upsertSite({ baseUrl: message.baseUrl, name: message.name, icon: message.icon });
            if (message.token) {
              await SD.Storage.saveCredential(r.site.id, message.token, message.persistence || 'local');
              await SD.Storage.updateState(state => {
                const s = state.jiraSites.find(x => x.id === r.site.id);
                if (s) {
                  s.auth.persistence = message.persistence || 'local';
                  s.auth.configured = true;
                }
              }, { configWrite: true });
            }
            let connection = null, sync = null;
            if (message.token) {
              connection = await testConnection(r.site.id, { operationId });
              if (message.sync !== false)
                sync = await SD.Discovery.discoverProjects(r.site.id, { operationId });
            }
            await configureAlarms(await SD.Storage.ensureState());
            return { ok: true, siteId: r.site.id, created: r.created, connection, sync };
          });
        case MESSAGE.UPDATE_SERVER: {
          const before = await SD.Storage.ensureState(),
            beforeSite = before.jiraSites.find(x => x.id === message.siteId),
            previousBaseUrl = SD.Utils.normalizeBaseUrl(beforeSite?.baseUrl || '');
          if (message.baseUrl !== undefined && SD.Utils.normalizeBaseUrl(message.baseUrl) !== previousBaseUrl)
            await requireRiskAuth(message, 'change the Jira server URL');
          const state = await SD.Storage.updateState(state => {
            const s = state.jiraSites.find(x => x.id === message.siteId);
            if (!s)
              throw new Error('Server not found.');
            const oldScope = discoveryScopeSignature(s.inventorySettings);
            if (message.baseUrl !== undefined) {
              const nextBase = SD.Utils.normalizeBaseUrl(message.baseUrl);
              if (!nextBase)
                throw Object.assign(new Error('Invalid Jira base URL.'), { code: 'VALIDATION_ERROR' });
              const duplicate = state.jiraSites.find(x => x.id !== s.id && SD.Utils.normalizeBaseUrl(x.baseUrl) === nextBase);
              if (duplicate)
                throw Object.assign(new Error(`This Jira URL is already configured as "${duplicate.name}".`), { code: 'DUPLICATE_SERVER_URL', siteId: duplicate.id });
              if (nextBase !== SD.Utils.normalizeBaseUrl(s.baseUrl)) {
                s.baseUrl = nextBase;
                s.runtime = {
                  ...s.runtime,
                  connectionStatus: 'not-configured',
                  healthState: 'unknown',
                  lastError: '',
                  lastErrorCode: '',
                  apiHealthy: false,
                  lastHealthAt: null,
                  tabOpen: false,
                  tabCount: 0,
                  tabUrls: [],
                  connectionLossStartedAt: null,
                  connectionLossFailures: 0,
                  connectionLossAlarmFiredAt: null
                };
              }
            }
            if (message.name !== undefined)
              s.name = message.name;
            if (message.icon)
              s.icon = { ...s.icon, ...message.icon };
            if (message.behavior) {
              const nextBehavior = { ...s.behavior, ...message.behavior, connectionLossAlarm: { ...s.behavior?.connectionLossAlarm, ...(message.behavior.connectionLossAlarm || {}) } },
                errors = SD.Validators.validateConnectionLossAlarm(nextBehavior.connectionLossAlarm || {});
              if (errors.length)
                throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
              s.behavior = nextBehavior;
            }
            if (message.network) {
              const nextPolicy = { ...s.network.requestPolicy, ...message.network.requestPolicy },
                errors = SD.Validators.validateRequestPolicy(nextPolicy);
              if (errors.length)
                throw Object.assign(new Error(errors[0]), { code: 'VALIDATION_ERROR' });
              s.network = { ...s.network, ...message.network, requestPolicy: nextPolicy };
            }
            if (message.inventorySettings) {
              const nextMethod = message.inventorySettings.transitionMethod ?? s.inventorySettings.transitionMethod,
                methodErrors = SD.Validators.validateTransitionMethod(nextMethod);
              if (methodErrors.length)
                throw Object.assign(new Error(methodErrors[0]), { code: 'VALIDATION_ERROR' });
              s.inventorySettings = {
                ...s.inventorySettings,
                ...message.inventorySettings,
                transitionMethod: nextMethod,
                projectDatasets: { ...(s.inventorySettings.projectDatasets || {}), ...(message.inventorySettings.projectDatasets || {}) },
                globalDatasets: { ...(s.inventorySettings.globalDatasets || {}), ...(message.inventorySettings.globalDatasets || {}) }
              };
              const selected = SD.Utils.discoveryProjectKeys(s.inventorySettings);
              s.inventorySettings.selectedProjectKeys = selected;
              if (discoveryScopeSignature(s.inventorySettings) !== oldScope)
                s.inventorySettings.scopeRevision = (Number(s.inventorySettings.scopeRevision) || 0) + 1;
            }
          }, { configWrite: true });
          const updatedSite = state.jiraSites.find(x => x.id === message.siteId),
            nextBaseUrl = SD.Utils.normalizeBaseUrl(updatedSite?.baseUrl || '');
          if (previousBaseUrl && nextBaseUrl && previousBaseUrl !== nextBaseUrl) {
            await log(LEVEL.INFO, 'Jira server URL changed.', { from: previousBaseUrl, to: nextBaseUrl }, { siteId: message.siteId });
            await audit('server-url-changed', { from: previousBaseUrl, to: nextBaseUrl }, { siteId: message.siteId });
          }
          await configureAlarms(state);
          return { ok: true, state };
        }
        case MESSAGE.DELETE_SITE: {
          await requireRiskAuth(message, 'delete this Jira server');
          await SD.Storage.deleteBySite(message.siteId);
          const state = await SD.Storage.updateState(state => {
            state.jiraSites = state.jiraSites.filter(s => s.id !== message.siteId);
            state.profiles = state.profiles.filter(p => p.siteId !== message.siteId);
            if (state.activeSiteId === message.siteId) {
              state.activeSiteId = state.jiraSites[0]?.id || '';
              state.activeProfileId = state.jiraSites[0]?.activeProfileId || state.profiles[0]?.id || '';
            }
          }, { configWrite: true });
          await configureAlarms(state);
          return { ok: true, state };
        }
        case MESSAGE.DELETE_PROFILE: {
          await requireRiskAuth(message, 'delete this profile');
          const state0 = await SD.Storage.ensureState(),
            p0 = state0.profiles.find(x => x.id === message.profileId);
          if (!p0)
            throw new Error('Profile not found.');
          await SD.Storage.deleteByProfile(message.profileId);
          const state = await SD.Storage.updateState(s => {
            s.profiles = s.profiles.filter(p => p.id !== message.profileId);
            const site = s.jiraSites.find(x => x.id === p0.siteId);
            let next = s.profiles.find(x => x.siteId === p0.siteId);
            if (site && !next) {
              next = SD.Defaults.profile('Default Profile', { id: p0.siteId });
              s.profiles.push(next);
            }
            if (site)
              site.activeProfileId = next?.id || '';
            if (s.activeProfileId === message.profileId)
              s.activeProfileId = next?.id || s.profiles[0]?.id || '';
          }, { configWrite: true });
          await configureAlarms(state);
          return { ok: true, state };
        }
        case MESSAGE.CLEAR_CACHE:
          await requireRiskAuth(message, 'clear synchronized Jira metadata');
          return { ok: true, state: await SD.Storage.clearCache(message.siteId) };
        case MESSAGE.CLEAR_PROFILE_DATA:
          await requireRiskAuth(message, 'clear profile runtime data');
          await SD.Storage.clearProfileData(message.profileId);
          return { ok: true, state: await SD.Storage.ensureState() };
        case MESSAGE.FACTORY_RESET: {
          await requireRiskAuth(message, 'erase all SD Companion data');
          const state = await SD.Storage.factoryReset();
          await configureActionTarget(state);
          await configureAlarms();
          await setBadge();
          return { ok: true, state };
        }
        case MESSAGE.SET_ACTIVE_SITE: {
          const state = await SD.Storage.updateState(state => {
            const s = state.jiraSites.find(x => x.id === message.siteId);
            if (!s)
              throw new Error('Server not found.');
            state.activeSiteId = s.id;
            state.activeProfileId = s.activeProfileId || state.profiles.find(p => p.siteId === s.id)?.id || state.activeProfileId;
          });
          return { ok: true, state };
        }
        case MESSAGE.SET_ACTIVE_PROFILE: {
          const state = await SD.Storage.updateState(state => {
            const p = state.profiles.find(x => x.id === message.profileId);
            if (!p)
              throw new Error('Profile not found.');
            state.activeProfileId = p.id;
            if (p.siteId)
              state.activeSiteId = p.siteId;
            const s = state.jiraSites.find(x => x.id === p.siteId);
            if (s)
              s.activeProfileId = p.id;
          });
          return { ok: true, state };
        }
        case MESSAGE.SAVE_CREDENTIAL:
          await requireRiskAuth(message, 'save or replace a Jira PAT');
          await SD.Storage.saveCredential(message.siteId, message.token, message.persistence || 'local');
          {
            const state = await SD.Storage.updateState(state => {
              const s = state.jiraSites.find(x => x.id === message.siteId);
              if (s) {
                s.auth.persistence = message.persistence || 'local';
                s.auth.configured = true;
              }
            }, { configWrite: true });
            await configureAlarms(state);
          }
          return { ok: true };
        case MESSAGE.DELETE_CREDENTIAL:
          await requireRiskAuth(message, 'remove a Jira PAT');
          await SD.Storage.deleteCredential(message.siteId);
          {
            const state = await SD.Storage.updateState(s => {
              const site = s.jiraSites.find(x => x.id === message.siteId);
              if (site) {
                site.auth = { ...(site.auth || {}), configured: false, user: null, lastValidatedAt: null };
                site.runtime = {
                  ...(site.runtime || {}),
                  apiHealthy: false,
                  connectionStatus: 'pat-missing',
                  healthState: 'not-configured',
                  lastHealthError: '',
                  lastError: '',
                  lastErrorCode: 'PAT_MISSING',
                  consecutiveHealthFailures: 0,
                  connectionLossStartedAt: null,
                  connectionLossFailures: 0,
                  connectionLossAlarmFiredAt: null
                };
              }
            }, { configWrite: true });
            await configureAlarms(state);
          }
          return { ok: true };
        case MESSAGE.TEST_CONNECTION: return await withOperation(message, 'test-connection', async (operationId) => ({ ok: true, ...await testConnection(message.siteId, { operationId }) }));
        case MESSAGE.DISCOVER_PROJECTS: return await withOperation(message, 'discover-projects', async (operationId) => ({ ok: true, site: await SD.Discovery.discoverProjects(message.siteId, { operationId }) }));
        case MESSAGE.SYNC_SITE: return await withOperation(message, 'sync-site', async (operationId) => {
          const site = await SD.Discovery.syncSite(message.siteId, { operationId }),
            interval = Math.max(SD.Constants.LIMITS.METADATA_SYNC_MIN_SECONDS, Number(site.inventorySettings?.autoSync?.intervalSeconds) || 3600);
          if (site.inventorySettings?.autoSync?.enabled)
            await SD.Storage.updateState(st => {
              const x = st.jiraSites.find(v => v.id === message.siteId);
              if (x) {
                x.inventorySettings.autoSync.lastRunAt = SD.Utils.nowIso();
                x.inventorySettings.autoSync.nextRunAt = new Date(Date.now() + interval * 1000).toISOString();
              }
            });
          await configureMetadataSyncAlarm(await SD.Storage.ensureState());
          return { ok: true, site: (await SD.Storage.ensureState()).jiraSites.find(x => x.id === message.siteId) };
        });
        case MESSAGE.REFRESH_HEALTH: return await withOperation(message, 'health', async (operationId) => ({ ok: true, ...await testConnection(message.siteId, { operationId }) }));
        case MESSAGE.REFRESH_TAB_STATUS: return { ok: true, sites: await SD.Discovery.refreshBrowserStatus(message.siteId) };
        case MESSAGE.RUN_CYCLE: return await withOperation(message, 'run-cycle', async (operationId) => ({ ok: true, ...await runCycle(message.siteId, message.profileId, { operationId, manual: true }) }));
        case MESSAGE.REFRESH_CURRENT_MATCHES: return await withOperation(message, 'current-matches', async (operationId) => ({ ok: true, ...await scanCurrentMatches(message.siteId, message.profileId, { operationId }) }));
        case MESSAGE.GET_RULE_PREVIEW: {
          const cursor = await SD.Storage.getCursor(message.profileId, message.ruleId),
            state = await SD.Storage.ensureState(),
            p = state.profiles.find(x => x.id === message.profileId),
            r = p?.rules.find(x => x.id === message.ruleId);
          if (!r)
            throw new Error('Rule not found.');
          return { ok: true, preview: SD.RuleQuery.preview(r, cursor), cursor };
        }
        case MESSAGE.SET_OPEN_TARGET: {
          const state = await SD.Storage.updateState(state => {
            state.appearance.openTarget = message.openTarget === 'sidepanel' ? 'sidepanel' : 'popup';
          }, { configWrite: true });
          await configureActionTarget(state);
          return { ok: true, state };
        }
        case MESSAGE.PLAY_ALARM:
          await SD.Audio.play(message.alarm || {}, message.meta || {});
          {
            const state = await SD.Storage.ensureState();
            return { ok: true, alarm: state.runtime?.activeAlarm || { active: false } };
          }
        case MESSAGE.STOP_ALARM:
          await SD.Audio.stop();
          return { ok: true };
        case MESSAGE.GET_ALARM_STATE: {
          const state = await SD.Storage.ensureState();
          return { ok: true, alarm: state.runtime?.activeAlarm || { active: false } };
        }
        case MESSAGE.GET_JOBS: return { ok: true, jobs: await SD.JobQueue.list() };
        case MESSAGE.CANCEL_JOB: return { ok: true, job: await SD.JobQueue.cancel(message.jobId) };
        case MESSAGE.CANCEL_JOBS:
          await requireRiskAuth(message, 'cancel all upcoming actions');
          return { ok: true, result: await SD.JobQueue.cancelPending({ siteId: String(message.siteId || ''), profileId: String(message.profileId || ''), issueKey: String(message.issueKey || '') }) };
        case MESSAGE.PROCESS_JOB:
          await requireRiskAuth(message, 'process this Jira action immediately');
          return { ok: true, job: await SD.JobQueue.processNow(message.jobId) };
        case MESSAGE.PROCESS_JOBS:
          await requireRiskAuth(message, 'process upcoming Jira actions immediately');
          return { ok: true, result: await SD.JobQueue.processPendingNow({ siteId: String(message.siteId || ''), profileId: String(message.profileId || ''), issueKey: String(message.issueKey || '') }) };
        case 'SD_SYNC_PROGRESS':
        case 'SD_SYNC_DONE':
        case 'SD_ALARM_STATE':
        case 'SD_OFFSCREEN_ENDED': return { ok: true };
        default: throw new Error(`Unknown message: ${message?.type}`);
      }
    } catch (e) {
      const err = SD.Utils.safeError(e), type = String(message?.type || 'unknown');
      if (![MESSAGE.GET_STATE, MESSAGE.GET_LOGS, MESSAGE.GET_AUDIT, MESSAGE.GET_JOBS, MESSAGE.GET_ALARM_STATE].includes(type)) await log(LEVEL.ERROR, `Worker request failed: ${type}`, err, { siteId: String(message?.siteId || ''), profileId: String(message?.profileId || ''), ruleId: String(message?.ruleId || ''), issueKey: String(message?.issueKey || '') }).catch(() => {});
      return { ok: false, error: err };
    }
  })().then(sendResponse);
  return true;
});
SD.Storage.cleanupLegacyExecutionArtifacts().catch(() => {});
configureActionTarget().catch(() => {});
configureAlarms().catch(() => {});
SD.JobQueue.restore().catch(() => {});
setBadge().catch(() => {});
