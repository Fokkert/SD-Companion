(() => {
  const SD = globalThis.SDCompanion, { MESSAGE } = SD.Constants;
  const A = globalThis.SDApp = {
    state: null,
    credentialStatus: {},
    logs: [],
    audit: [],
    jobs: [],
    page: "home",
    selectedRuleId: "",
    selectedScheduleId: "",
    scheduleDraft: null,
    scheduleDraftIsNew: false,
    inventoryType: "projects",
    inventorySearch: "",
    busyFlag: false,
    currentOperationId: "",
    serverAddOpen: false,
    serverEditId: "",
    settingsSection: "general",
    homeDetectionView: "current",
    pendingImport: null,
    ruleDraft: null,
    ruleDraftIsNew: false,
    ruleEditorSection: "setup",
    settingsDraft: null,
    alarmDraft: null,
    appearanceDraftTheme: null,
    monitoringToggleSeq: 0,
    securityStatus: { enabled: false, method: "password", sessionMinutes: 30, unlocked: true, unlockedUntil: null },
    securityRelockTimer: null,
    securityReauthResolve: null,
    securityReauthReject: null,
    securityReauthPurpose: ""
  };
  A.$ = id => document.getElementById(id);
  A.esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const opTypes = new Set([MESSAGE.ADD_SERVER, MESSAGE.TEST_CONNECTION, MESSAGE.DISCOVER_PROJECTS, MESSAGE.SYNC_SITE, MESSAGE.REFRESH_HEALTH, MESSAGE.RUN_CYCLE, MESSAGE.REFRESH_CURRENT_MATCHES]);
  A.send = (type, payload = {}) => new Promise((resolve, reject) => {
    const p = { ...payload };
    if (A.currentOperationId && opTypes.has(type) && !p.operationId) p.operationId = A.currentOperationId;
    chrome.runtime.sendMessage({ type, ...p }, r => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!r?.ok) {
        const err = Object.assign(new Error(r?.error?.message || "Request failed"), r?.error || {});
        if (err.code === 'EXTENSION_LOCKED') A.showSecurityLock?.();
        return reject(err);
      }
      resolve(r);
    });
  });
  const securityLabel = () => A.securityStatus?.method === 'pin' ? 'PIN' : 'Password';
  A.applySecurityInputMode = () => {
    for (const id of ['securityUnlockInput', 'securityReauthInput']) {
      const input = A.$(id);
      if (!input) continue;
      const pin = A.securityStatus?.method === 'pin';
      input.inputMode = pin ? 'numeric' : 'text';
      input.pattern = pin ? '[0-9]*' : '';
      input.maxLength = pin ? 12 : SD.Constants.LIMITS.SECURITY_PASSWORD_MAX_CHARS;
    }
    for (const id of ['securityUnlockLabel', 'securityReauthLabel']) if (A.$(id)) A.$(id).textContent = securityLabel();
  };
  A.scheduleSecurityRelock = status => {
    if (A.securityRelockTimer) clearTimeout(A.securityRelockTimer);
    A.securityRelockTimer = null;
    if (!status?.enabled || !status?.unlocked || !status.unlockedUntil) return;
    const delay = new Date(status.unlockedUntil).getTime() - Date.now();
    if (delay <= 0) {
      A.showSecurityLock();
      return;
    }
    A.securityRelockTimer = setTimeout(() => A.showSecurityLock(), Math.min(delay + 150, 2147483000));
  };
  A.showSecurityLock = () => {
    if (!A.securityStatus?.enabled) return;
    A.securityStatus = { ...A.securityStatus, unlocked: false, unlockedUntil: null };
    A.$('securityReauthOverlay')?.classList.add('hidden');
    if (A.securityReauthReject) {
      A.securityReauthReject(Object.assign(new Error('Extension locked.'), { code: 'EXTENSION_LOCKED' }));
      A.securityReauthResolve = null;
      A.securityReauthReject = null;
    }
    const o = A.$('securityLockOverlay');
    o?.classList.remove('hidden');
    A.applySecurityInputMode();
    const hint = A.$('securityLockHint');
    if (hint) hint.textContent = `Enter your ${securityLabel().toLowerCase()} to continue.`;
    const err = A.$('securityUnlockError');
    if (err) err.textContent = '';
    setTimeout(() => A.$('securityUnlockInput')?.focus(), 0);
  };
  A.hideSecurityLock = () => {
    A.$('securityLockOverlay')?.classList.add('hidden');
    const i = A.$('securityUnlockInput');
    if (i) i.value = '';
  };
  A.refreshSecurityStatus = async () => {
    const r = await A.send(MESSAGE.GET_SECURITY_STATUS);
    A.securityStatus = r.security || A.securityStatus;
    A.applySecurityInputMode();
    A.scheduleSecurityRelock(A.securityStatus);
    return A.securityStatus;
  };
  A.unlockExtension = async () => {
    const input = A.$('securityUnlockInput'),
      err = A.$('securityUnlockError'),
      passcode = input?.value || '';
    if (err) err.textContent = '';
    try {
      const r = await A.send(MESSAGE.VERIFY_SECURITY, { mode: 'unlock', passcode });
      A.securityStatus = r.security;
      A.hideSecurityLock();
      A.scheduleSecurityRelock(A.securityStatus);
      await A.load();
      A.scheduleHomeRefresh?.();
      return true;
    } catch (e) {
      if (err) err.textContent = e.message;
      input?.select?.();
      return false;
    }
  };
  A.requestSecurityReauth = purpose => {
    if (!A.securityStatus?.enabled) return Promise.resolve('');
    if (A.securityReauthReject) A.securityReauthReject(Object.assign(new Error('Authentication superseded.'), { code: 'SECURITY_AUTH_CANCELLED' }));
    A.securityReauthPurpose = String(purpose || 'continue');
    const o = A.$('securityReauthOverlay'),
      hint = A.$('securityReauthHint'),
      err = A.$('securityReauthError'),
      input = A.$('securityReauthInput');
    if (hint) hint.textContent = `Re-enter your ${securityLabel().toLowerCase()} to ${A.securityReauthPurpose}.`;
    if (err) err.textContent = '';
    if (input) input.value = '';
    A.applySecurityInputMode();
    o?.classList.remove('hidden');
    setTimeout(() => input?.focus(), 0);
    return new Promise((resolve, reject) => {
      A.securityReauthResolve = resolve;
      A.securityReauthReject = reject;
    });
  };
  A.confirmSecurityReauth = async () => {
    const input = A.$('securityReauthInput'), err = A.$('securityReauthError');
    if (err) err.textContent = '';
    try {
      const r = await A.send(MESSAGE.VERIFY_SECURITY, { mode: 'risk', passcode: input?.value || '', purpose: A.securityReauthPurpose });
      A.securityStatus = r.security || A.securityStatus;
      A.scheduleSecurityRelock(A.securityStatus);
      A.$('securityReauthOverlay')?.classList.add('hidden');
      if (input) input.value = '';
      const resolve = A.securityReauthResolve;
      A.securityReauthResolve = null;
      A.securityReauthReject = null;
      resolve?.(r.riskToken || '');
      return true;
    } catch (e) {
      if (err) err.textContent = e.message;
      input?.select?.();
      return false;
    }
  };
  A.cancelSecurityReauth = () => {
    A.$('securityReauthOverlay')?.classList.add('hidden');
    const reject = A.securityReauthReject;
    A.securityReauthResolve = null;
    A.securityReauthReject = null;
    reject?.(Object.assign(new Error('Security confirmation cancelled.'), { code: 'SECURITY_AUTH_CANCELLED' }));
  };
  A.site = () => A.state?.jiraSites.find(s => s.id === A.state.activeSiteId) || A.state?.jiraSites[0] || null;
  A.profile = () => A.state?.profiles.find(p => p.id === A.state.activeProfileId) || A.state?.profiles.find(p => p.siteId === A.site()?.id) || A.state?.profiles[0] || null;
  A.beginRuleEdit = (rule, { isNew = false } = {}) => {
    A.ruleDraft = structuredClone(rule);
    A.ruleDraftIsNew = Boolean(isNew);
    A.selectedRuleId = A.ruleDraft.id;
    A.ruleEditorSection = "setup";
    return A.ruleDraft;
  };
  A.discardRuleEdit = () => {
    A.ruleDraft = null;
    A.ruleDraftIsNew = false;
    A.selectedRuleId = "";
    A.ruleEditorSection = "setup";
  };
  A.beginScheduleEdit = (schedule, { isNew = false } = {}) => {
    A.scheduleDraft = structuredClone(schedule);
    A.scheduleDraftIsNew = Boolean(isNew);
    A.selectedScheduleId = A.scheduleDraft.id;
    return A.scheduleDraft;
  };
  A.discardScheduleEdit = () => {
    A.scheduleDraft = null;
    A.scheduleDraftIsNew = false;
    A.selectedScheduleId = "";
  };
  A.makeAlarmDraft = () => {
    const p = A.profile();
    return { profileId: p?.id || "", config: structuredClone(p?.alarmDefaults || {}) };
  };
  A.ensureAlarmDraft = () => {
    const p = A.profile(), pid = p?.id || "";
    if (!A.alarmDraft || A.alarmDraft.profileId !== pid) A.alarmDraft = A.makeAlarmDraft();
    return A.alarmDraft.config;
  };
  A.resetAlarmDraft = () => {
    A.alarmDraft = A.makeAlarmDraft();
    return A.alarmDraft.config;
  };
  A.makeSettingsDraft = () => {
    const site = A.site(),
      profile = A.profile(),
      sys = A.state?.system || {},
      auto = { ...SD.Defaults.inventorySettings().autoSync, ...(site?.inventorySettings?.autoSync || {}) };
    return {
      siteId: site?.id || "",
      profileId: profile?.id || "",
      appearance: { openTarget: A.state?.appearance?.openTarget || "popup" },
      system: {
        safety: structuredClone(sys.safety || SD.Defaults.safety()),
        activityRefreshSeconds: Number(sys.activityRefreshSeconds) || 3,
        activityRefreshUnit: sys.activityRefreshUnit || "seconds",
        completionToneEnabled: sys.completionToneEnabled !== false
      },
      autoSync: structuredClone(auto),
      alarm: structuredClone(profile?.alarmDefaults || SD.Defaults.profile().alarmDefaults)
    };
  };
  A.ensureSettingsDraft = () => {
    const siteId = A.site()?.id || "", profileId = A.profile()?.id || "";
    if (!A.settingsDraft || A.settingsDraft.siteId !== siteId || A.settingsDraft.profileId !== profileId) A.settingsDraft = A.makeSettingsDraft();
    return A.settingsDraft;
  };
  A.resetSettingsDraft = () => {
    A.settingsDraft = A.makeSettingsDraft();
    return A.settingsDraft;
  };
  A.toast = (message, type = "success") => {
    const text = String(message ?? '').trim();
    if (text) {
      const level = type === 'error' ? 'error' : type === 'warn' || type === 'warning' ? 'warn' : 'info';
      try {
        chrome.runtime.sendMessage({ type: MESSAGE.LOG_UI_EVENT, level, message: text, page: A.page || '', siteId: A.site?.()?.id || '', profileId: A.profile?.()?.id || '' }).catch?.(() => {});
      } catch {}
    }
    const host = A.$("toastHost");
    if (!host) return;
    const e = document.createElement("div");
    e.className = `toast ${type}`;
    e.textContent = message;
    host.appendChild(e);
    setTimeout(() => e.remove(), 4300);
  };
  A.operationLabels = {
    "discover-projects": ["Refreshing Projects & Filters", "Preparing a new discovery snapshot"],
    "sync-data": ["Synchronizing Selected Projects", "Preparing a transactional metadata snapshot"],
    "add-server": ["Connecting Jira Server", "Validating API access"],
    "run-cycle": ["Scanning Jira", "Evaluating enabled rules"],
    "refresh-health": ["Checking Jira", "API, permissions and secure connection"],
    "refresh-current-matches": ["Checking Current Matches", "Evaluating enabled rules without executing actions"],
    "change-pat": ["Validating PAT", "Checking Jira authentication"]
  };
  A.showOperation = (title = "Working…", detail = "", cancel = true) => {
    const o = A.$("operationOverlay");
    if (!o) return;
    o.classList.remove("hidden");
    A.$("operationTitle").textContent = title;
    A.$("operationDetail").textContent = detail || "Working…";
    const c = A.$("cancelOperation");
    if (c) c.hidden = !cancel;
  };
  A.updateOperation = (title, detail) => {
    if (title && A.$("operationTitle")) A.$("operationTitle").textContent = title;
    if (detail !== undefined && A.$("operationDetail")) A.$("operationDetail").textContent = detail;
  };
  A.hideOperation = () => A.$("operationOverlay")?.classList.add("hidden");
  A.busy = async (button, fn) => {
    if (A.busyFlag) return;
    A.busyFlag = true;
    const old = button?.innerHTML,
      act = button?.dataset?.action,
      label = A.operationLabels[act],
      cancellable = Boolean(label);
    if (cancellable) A.currentOperationId = crypto.randomUUID();
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="mini-spinner"></span> Working…';
    }
    if (label) A.showOperation(...label, true);
    try {
      return await fn(A.currentOperationId);
    } catch (e) {
      if (e.code === 'OPERATION_CANCELLED') A.toast('Operation cancelled.', 'info');
      else if (e.code !== 'SECURITY_AUTH_CANCELLED') A.toast(e.message, 'error');
      throw e;
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = old;
      }
      if (label) A.hideOperation();
      A.currentOperationId = "";
      A.busyFlag = false;
    }
  };
  A.refreshHomeActivity = async () => {
    try {
      const j = await A.send(MESSAGE.GET_JOBS);
      A.jobs = j.jobs || [];
    } catch {
      A.jobs = A.jobs || [];
    }
  };
  A.pullHomeActivity = async () => {
    const r = await A.send(MESSAGE.GET_STATE);
    A.state = r.state;
    A.credentialStatus = r.credentialStatus || A.credentialStatus || {};
    await A.refreshHomeActivity();
    A.renderShell?.();
    A.refreshHomeActivityDom?.();
  };
  A.load = async () => {
    const r = await A.send(MESSAGE.GET_STATE);
    A.state = r.state;
    A.credentialStatus = r.credentialStatus || {};
    if (A.page === "home") await A.refreshHomeActivity();
    A.applyTheme();
    A.renderShell();
    A.renderPage();
  };
  A.refreshLogs = async () => {
    A.logs = (await A.send(MESSAGE.GET_LOGS, { limit: 700 })).logs || [];
  };
  A.refreshAudit = async () => {
    A.audit = (await A.send(MESSAGE.GET_AUDIT, { limit: 800 })).audit || [];
  };
  A.save = async (render = true, validationScope = "profile") => {
    let errors = [];
    if (validationScope === "profile") {
      const p = A.profile();
      if (p?.siteId) errors = SD.Validators?.validateProfile?.(p) || [];
    }
    else if (validationScope === "all-profiles") {
      for (const p of A.state?.profiles || []) if (p.siteId) errors.push(...(SD.Validators?.validateProfile?.(p) || []));
    }
    if (errors.length) throw Object.assign(new Error(errors[0]), { code: "VALIDATION_ERROR" });
    const baseRevision = A.state.configRevision;
    try {
      A.state = (await A.send(MESSAGE.SAVE_STATE, { state: A.state, baseRevision, validationScope })).state;
    } catch (e) {
      if (e.code === 'STATE_REVISION_CONFLICT') {
        await A.load();
        A.toast('Configuration changed elsewhere. The latest state was reloaded.', 'error');
      }
      throw e;
    }
    if (render) {
      A.applyTheme();
      A.renderShell();
      A.renderPage();
    }
    return A.state;
  };
  A.applyTheme = () => document.documentElement.dataset.theme = A.state?.appearance?.theme || "emerald-glass";
  A.option = (v, label, sel = false) => `<option value="${A.esc(v)}" ${sel ? "selected" : ""}>${A.esc(label)}</option>`;
  A.multiOptions = (items, valueFn, labelFn, selected = []) => items.map(x => A.option(valueFn(x), labelFn(x), selected.includes(String(valueFn(x))))).join("");
  A.glassMulti = (items, valueFn, labelFn, selected = [], attrs = "", empty = "No options", searchPlaceholder = "") => {
    const set = new Set((selected || []).map(String)),
      rows = (items || []).map((x, index) => ({ x, index, v: String(valueFn(x)) })).sort((a, b) => Number(set.has(b.v)) - Number(set.has(a.v)) || a.index - b.index),
      choices = rows.map(({ x, index, v }) => `<label class="glass-choice ${set.has(v) ? "selected" : ""}" data-choice-order="${index}">` +
        `<input type="checkbox" data-multi-value value="${A.esc(v)}" ${set.has(v) ? "checked" : ""}>` +
        `<span class="glass-choice-dot">` +
        `</span>` +
        `<span class="glass-choice-label">${A.esc(labelFn(x))}</span></label>`).join("") || `<div class="glass-choice-empty">${A.esc(empty)}</div>`,
      multi = `<div class="glass-multi" data-multi-group ${attrs}>${choices}</div>`;
    return searchPlaceholder ? `<div class="glass-multi-wrap"><input class="input glass-multi-search" type="search" autocomplete="off" placeholder="${A.esc(searchPlaceholder)}">${multi}</div>` : multi;
  };
  A.multiGroupValues = el => [...(el.closest("[data-multi-group]")?.querySelectorAll("input[data-multi-value]:checked") || [])].map(x => x.value);
  A.selectedValues = el => el?.matches?.("[data-multi-group]") ? [...el.querySelectorAll("input[data-multi-value]:checked")].map(x => x.value) : [...(el?.selectedOptions || [])].map(x => x.value);
  A.uniqueIssueTypes = site => {
    const map = new Map();
    for (const x of site?.issueTypes || []) {
      const id = String(x?.id || '');
      if (!id || map.has(id)) continue;
      map.set(id, { ...x, id, projectKey: '' });
    }
    return [...map.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  };
  A.uniqueStatuses = site => {
    const map = new Map();
    for (const x of [...(site?.statuses || []), ...(site?.projectStatusMatrix || [])]) {
      const id = String(x?.id || x?.statusId || '');
      if (!id || map.has(id)) continue;
      map.set(id, { ...x, id, name: x.name || x.statusName || '', projectKey: '', issueTypeId: '' });
    }
    return [...map.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  };
  A.setPage = p => {
    A.closeSoftSelects?.();
    if (A.page === 'appearance' && p !== 'appearance' && A.appearanceDraftTheme) {
      A.appearanceDraftTheme = null;
      A.applyTheme();
    }
    A.page = p;
    const finish = () => {
      A.renderPage();
      document.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("active", b.dataset.nav === p || (p !== "home" && p !== "servers" && p !== "rules" && p !== "data" && b.dataset.nav === "settings")));
    };
    if (p === 'logs') A.refreshLogs().then(finish).catch(() => finish());
    else if (p === 'audit') A.refreshAudit().then(finish).catch(() => finish());
    else if (p === 'home') A.pullHomeActivity().then(finish).catch(() => finish());
    else finish();
  };
  A.hash = n => {
    let h = 2166136261;
    for (const c of String(n)) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  A.fileDataUrl = file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const bytesToB64 = u => {
    const bytes = u instanceof Uint8Array ? u : new Uint8Array(u), chunkSize = 0x8000, parts = [];
    for (let i = 0; i < bytes.length; i += chunkSize)parts.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))));
    return btoa(parts.join(""));
  },
    b64ToBytes = s => {
      const binary = atob(s), out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++)out[i] = binary.charCodeAt(i);
      return out;
    };
  const safeImportClone = value => {
    if (Array.isArray(value)) return value.map(safeImportClone);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "__proto__" || k === "prototype" || k === "constructor") continue;
      out[k] = safeImportClone(v);
    }
    return out;
  };
  A.encrypt = async (value, password) => {
    const enc = new TextEncoder(),
      salt = crypto.getRandomValues(new Uint8Array(16)),
      iv = crypto.getRandomValues(new Uint8Array(12)),
      base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]),
      key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]),
      cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
    return { format: "sd-companion-secure-backup", version: 1, kdf: "PBKDF2-SHA256", iterations: 250000, salt: bytesToB64(salt), iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(cipher)) };
  };
  A.decrypt = async (bundle, password) => {
    if (bundle?.format !== "sd-companion-secure-backup" || Number(bundle.version) !== 1 || bundle.kdf !== "PBKDF2-SHA256") throw new Error("Unsupported secure backup format.");
    const iterations = Number(bundle.iterations);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) throw new Error("Invalid backup key-derivation settings.");
    let salt, iv, ciphertext;
    try {
      salt = b64ToBytes(bundle.salt);
      iv = b64ToBytes(bundle.iv);
      ciphertext = b64ToBytes(bundle.ciphertext);
    } catch {
      throw new Error("Secure backup is malformed.");
    }
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw new Error("Secure backup is malformed.");
    const enc = new TextEncoder(),
      base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]),
      key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]),
      plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return safeImportClone(JSON.parse(new TextDecoder().decode(plain)));
  };
  A.profileBundle = async includeSecret => {
    const p = A.profile(), s = A.site();
    if (!p || !s) throw new Error("Select a server and profile.");
    const server = structuredClone(s);
    if (server.auth) delete server.auth.token;
    const bundle = {
      format: "sd-companion-profile",
      version: 3,
      exportedAt: new Date().toISOString(),
      profile: structuredClone(p),
      server,
      appearance: structuredClone(A.state.appearance || {}),
      system: structuredClone(A.state.system || {})
    };
    if (includeSecret) bundle.pat = await SD.Storage?.getCredential?.(s.id);
    if (includeSecret && !bundle.pat) bundle.pat = await new Promise((resolve, reject) => chrome.storage.session.get(SD.Constants.STORAGE_KEYS.SESSION_CREDENTIALS, sr => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      const token = sr[SD.Constants.STORAGE_KEYS.SESSION_CREDENTIALS]?.[s.id] || "";
      if (token) return resolve(token);
      chrome.storage.local.get(SD.Constants.STORAGE_KEYS.LOCAL_CREDENTIALS, lr => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(lr[SD.Constants.STORAGE_KEYS.LOCAL_CREDENTIALS]?.[s.id] || ""));
    }));
    return bundle;
  };
  A.exportProfile = async secure => {
    if (secure) await A.requestSecurityReauth('create an encrypted backup containing credentials');
    let bundle = await A.profileBundle(secure);
    if (secure) {
      const password = prompt("Backup password (8+ characters):");
      if (!password || password.length < 8) throw new Error("Use at least 8 characters.");
      bundle = await A.encrypt(bundle, password);
    }
    SD.Utils.downloadJson(`SD-Companion-${A.profile().name.replace(/[^a-z0-9]+/gi, "-")}${secure ? "-Secure" : ""}.json`, bundle);
  };
  const importDiffPaths = (a, b, prefix = '', out = []) => {
    if (out.length >= 30) return out;
    const skip = new Set(['id', 'siteId', 'createdAt', 'updatedAt', 'runtime']);
    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push(prefix || 'value');
      return out;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (skip.has(k)) continue;
        importDiffPaths(a[k], b[k], prefix ? `${prefix}.${k}` : k, out);
        if (out.length >= 30) break;
      }
      return out;
    }
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push(prefix || 'value');
    return out;
  };
  A.prepareImport = async raw => {
    let bundle = safeImportClone(raw);
    if (bundle?.format === "sd-companion-secure-backup") {
      const password = prompt("Backup password:");
      if (!password) throw new Error("A password is required.");
      bundle = await A.decrypt(bundle, password);
    }
    if (bundle?.format !== "sd-companion-profile" || !bundle.profile || !bundle.server?.baseUrl) throw new Error("Invalid SD Companion profile export.");
    const normalizedBaseUrl = SD.Utils.normalizeBaseUrl(bundle.server.baseUrl);
    if (!normalizedBaseUrl) throw new Error("The imported Jira server URL is invalid.");
    bundle.server.baseUrl = normalizedBaseUrl;
    const existing = A.state.jiraSites.find(s => s.baseUrl === SD.Utils.normalizeBaseUrl(bundle.server.baseUrl)),
      current = existing ? A.state.profiles.filter(p => p.siteId === existing.id) : [],
      sameName = current.find(x => String(x.name).toLowerCase() === String(bundle.profile.name || '').toLowerCase()) || null,
      diffPaths = [];
    if (sameName) importDiffPaths(sameName, bundle.profile, 'profile', diffPaths);
    if (existing) {
      importDiffPaths(existing.network || {}, bundle.server.network || {}, 'server.network', diffPaths);
      importDiffPaths(existing.inventorySettings || {}, bundle.server.inventorySettings || {}, 'server.discovery', diffPaths);
    }
    A.pendingImport = {
      bundle,
      diff: {
        server: existing ? 'Existing server' : 'New server',
        serverName: bundle.server.name || bundle.server.baseUrl,
        profileName: bundle.profile.name || 'Imported Profile',
        incomingRules: (bundle.profile.rules || []).length,
        incomingSchedules: (bundle.profile.schedules || []).length,
        currentProfiles: current.length,
        includesPat: Boolean(bundle.pat),
        ruleNames: (bundle.profile.rules || []).map(x => x.name || 'Unnamed rule'),
        scheduleNames: (bundle.profile.schedules || []).map(x => x.name || 'Unnamed schedule'),
        nameConflict: Boolean(sameName),
        comparisonProfile: sameName?.name || '',
        diffPaths
      }
    };
    A.setPage('profiles');
  };
  A.applyImport = async securityAuthToken => {
    const bundle = A.pendingImport?.bundle;
    if (!bundle) throw new Error('No import is waiting.');
    const normalized = SD.Utils.normalizeBaseUrl(bundle.server.baseUrl),
      existing = A.state.jiraSites.find(s => SD.Utils.normalizeBaseUrl(s.baseUrl) === normalized),
      add = existing ? { siteId: existing.id, created: false } : await A.send(MESSAGE.ADD_SERVER, { baseUrl: bundle.server.baseUrl, name: bundle.server.name, icon: bundle.server.icon, sync: false, securityAuthToken });
    if (bundle.pat) await A.send(MESSAGE.SAVE_CREDENTIAL, { siteId: add.siteId, token: bundle.pat, persistence: bundle.server.auth?.persistence || 'local', securityAuthToken });
    const r = await A.send(MESSAGE.GET_STATE);
    A.state = r.state;
    A.credentialStatus = r.credentialStatus || {};
    const currentSite = A.state.jiraSites.find(x => x.id === add.siteId),
      hadCredential = Boolean(A.credentialStatus[add.siteId]);
    if (add.created) A.state.profiles = A.state.profiles.filter(x => x.siteId !== add.siteId);
    const p = structuredClone(bundle.profile);
    p.siteId = add.siteId;
    const sameIndex = A.state.profiles.findIndex(x => x.id === p.id && x.siteId === add.siteId);
    if (sameIndex >= 0) A.state.profiles[sameIndex] = p;
    else if (A.state.profiles.some(x => x.id === p.id)) {
      p.id = crypto.randomUUID();
      A.state.profiles.push(p);
    }
    else A.state.profiles.push(p);
    const importedServer = structuredClone(bundle.server),
      s = A.state.jiraSites.find(x => x.id === add.siteId);
    if (s) {
      const originalId = s.id, credentialConfigured = Boolean(bundle.pat) || hadCredential;
      Object.assign(s, importedServer);
      s.id = originalId;
      s.baseUrl = normalized;
      s.activeProfileId = p.id;
      s.auth = { ...(importedServer.auth || {}), type: 'pat', persistence: bundle.server.auth?.persistence || s.auth?.persistence || 'local', configured: credentialConfigured, token: undefined };
      s.runtime = {
        ...(s.runtime || {}),
        apiHealthy: false,
        connectionStatus: credentialConfigured ? 'check-required' : 'pat-missing',
        healthState: credentialConfigured ? 'unknown' : 'not-configured',
        lastHealthError: '',
        lastError: '',
        lastErrorCode: credentialConfigured ? '' : 'PAT_MISSING',
        consecutiveHealthFailures: 0,
        connectionLossStartedAt: null,
        connectionLossFailures: 0,
        connectionLossAlarmFiredAt: null
      };
      if (!credentialConfigured) {
        s.auth.user = null;
        s.auth.lastValidatedAt = null;
      }
    }
    if (bundle.appearance && typeof bundle.appearance === 'object') A.state.appearance = structuredClone(bundle.appearance);
    if (bundle.system && typeof bundle.system === 'object') A.state.system = structuredClone(bundle.system);
    A.state.activeSiteId = add.siteId;
    A.state.activeProfileId = p.id;
    const baseRevision = A.state.configRevision;
    A.state = (await A.send(MESSAGE.SAVE_STATE, { state: A.state, baseRevision, validationScope: 'all-profiles', fullImport: true, securityAuthToken })).state;
    A.pendingImport = null;
    await A.load();
    const importedSite = A.site(), hasPat = Boolean(importedSite && A.credentialStatus[importedSite.id]);
    A.toast(hasPat ? 'Profile imported.' : 'Profile imported. PAT is missing; configure it in Jira Servers before API operations can run.', hasPat ? 'success' : 'info');
  };
})();
