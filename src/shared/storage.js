(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const { STORAGE_KEYS, LIMITS } = root.Constants;
  const localGet = k => chrome.storage.local.get(k),
    localSet = v => chrome.storage.local.set(v),
    localRemove = k => chrome.storage.local.remove(k),
    sessionGet = k => chrome.storage.session.get(k),
    sessionSet = v => chrome.storage.session.set(v),
    sessionRemove = k => chrome.storage.session.remove(k);
  let stateQueue = Promise.resolve();
  const withStateLock = fn => {
    const run = stateQueue.then(fn, fn);
    stateQueue = run.catch(() => {});
    return run;
  };
  const migrate = raw => root.Migrations.migrateState(raw).state;
  const ensureState = () => withStateLock(async () => {
    const r = await localGet(STORAGE_KEYS.STATE),
      m = root.Migrations.migrateState(r[STORAGE_KEYS.STATE]);
    if (m.changed || !r[STORAGE_KEYS.STATE]) await localSet({ [STORAGE_KEYS.STATE]: m.state });
    return structuredClone(m.state);
  });
  const saveState = s => withStateLock(async () => {
    const m = root.Migrations.migrateState(s);
    await localSet({ [STORAGE_KEYS.STATE]: m.state });
    return structuredClone(m.state);
  });
  const updateState = (mutator, { configWrite = false, expectedRevision = null } = {}) => withStateLock(async () => {
    const r = await localGet(STORAGE_KEYS.STATE), state = migrate(r[STORAGE_KEYS.STATE]);
    if (configWrite && expectedRevision !== null && Number(expectedRevision) !== Number(state.configRevision || 0)) {
      const e = new Error('Configuration changed in the background. Reload this page and retry your edit.');
      e.code = 'STATE_REVISION_CONFLICT';
      e.expected = expectedRevision;
      e.actual = state.configRevision;
      throw e;
    }
    const result = await mutator(state);
    const next = root.Migrations.migrateState(result && typeof result === 'object' && result.schemaVersion ? result : state).state;
    if (configWrite) next.configRevision = (Number(state.configRevision) || 0) + 1;
    await localSet({ [STORAGE_KEYS.STATE]: next });
    return structuredClone(next);
  });
  const compactDetails = value => {
    try {
      const text = JSON.stringify(value ?? {});
      if (text.length <= 16000) return value ?? {};
      return { truncated: true, preview: text.slice(0, 16000) };
    } catch {
      return { message: String(value) };
    }
  };
  const rank = { debug: 0, info: 1, success: 1, warn: 2, error: 3 };
  const getLogs = async () => {
    const r = await localGet(STORAGE_KEYS.LOGS);
    return Array.isArray(r[STORAGE_KEYS.LOGS]) ? r[STORAGE_KEYS.LOGS] : [];
  };
  const appendLog = async e => {
    let level = 'info';
    try {
      const s = await ensureState();
      level = s.system?.logLevel || 'info';
    } catch {}
    if ((rank[e?.level] ?? 1) < (rank[level] ?? 1)) return;
    const logs = await getLogs();
    logs.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...e, details: compactDetails(e?.details) });
    await localSet({ [STORAGE_KEYS.LOGS]: logs.slice(0, LIMITS.LOG_MAX) });
  };
  const clearLogs = () => localSet({ [STORAGE_KEYS.LOGS]: [] });
  const getAudit = async () => {
    const r = await localGet(STORAGE_KEYS.AUDIT);
    return Array.isArray(r[STORAGE_KEYS.AUDIT]) ? r[STORAGE_KEYS.AUDIT] : [];
  };
  const appendAudit = async e => {
    const a = await getAudit();
    a.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), event: e.event || 'event', ...e, details: compactDetails(e?.details) });
    await localSet({ [STORAGE_KEYS.AUDIT]: a.slice(0, LIMITS.AUDIT_MAX) });
  };
  const clearAudit = () => localSet({ [STORAGE_KEYS.AUDIT]: [] });
  const getMap = async (key, session = false) => {
    const r = await (session ? sessionGet(key) : localGet(key));
    return r[key] || {};
  };
  const setMap = async (key, map, session = false) => (session ? sessionSet({ [key]: map }) : localSet({ [key]: map }));
  const saveCredential = async (siteId, token, persistence = 'local') => {
    await deleteCredential(siteId);
    const session = persistence === 'session',
      key = session ? STORAGE_KEYS.SESSION_CREDENTIALS : STORAGE_KEYS.LOCAL_CREDENTIALS,
      map = await getMap(key, session);
    map[siteId] = token;
    await setMap(key, map, session);
  };
  const getCredential = async siteId => {
    const sm = await getMap(STORAGE_KEYS.SESSION_CREDENTIALS, true);
    if (sm[siteId]) return sm[siteId];
    const lm = await getMap(STORAGE_KEYS.LOCAL_CREDENTIALS, false);
    return lm[siteId] || '';
  };
  const deleteCredential = async siteId => {
    for (const [key, session] of [[STORAGE_KEYS.SESSION_CREDENTIALS, true], [STORAGE_KEYS.LOCAL_CREDENTIALS, false]]) {
      const m = await getMap(key, session);
      if (siteId in m) {
        delete m[siteId];
        await setMap(key, m, session);
      }
    }
  };
  const hasCredential = async siteId => Boolean(await getCredential(siteId));
  const bytesToB64 = bytes => {
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000)out += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 0x8000)));
    return btoa(out);
  };
  const b64ToBytes = value => Uint8Array.from(atob(String(value || '')), c => c.charCodeAt(0));
  const securityConfig = async () => {
    const r = await localGet(STORAGE_KEYS.SECURITY), raw = r[STORAGE_KEYS.SECURITY];
    if (!raw?.enabled) return { enabled: false, method: 'password', sessionMinutes: 30 };
    return {
      enabled: true,
      method: raw.method === 'pin' ? 'pin' : 'password',
      sessionMinutes: Math.max(LIMITS.SECURITY_SESSION_MINUTES_MIN, Math.min(LIMITS.SECURITY_SESSION_MINUTES_MAX, Number(raw.sessionMinutes) || 30)),
      salt: String(raw.salt || ''),
      verifier: String(raw.verifier || ''),
      iterations: Number(raw.iterations) || 310000,
      updatedAt: raw.updatedAt || null
    };
  };
  const securitySession = async () => {
    const r = await sessionGet(STORAGE_KEYS.SECURITY_SESSION);
    return r[STORAGE_KEYS.SECURITY_SESSION] || {};
  };
  const securityStatus = async () => {
    const cfg = await securityConfig(),
      sess = await securitySession(),
      until = Number(sess.unlockedUntil) || 0,
      unlocked = Boolean(cfg.enabled && until > Date.now());
    return { enabled: cfg.enabled, method: cfg.method, sessionMinutes: cfg.sessionMinutes, unlocked: !cfg.enabled || unlocked, unlockedUntil: unlocked ? new Date(until).toISOString() : null };
  };
  const validateSecuritySecret = (method, secret) => {
    const value = String(secret || '');
    if (method === 'pin') {
      if (!/^\d{4,12}$/.test(value)) throw Object.assign(new Error('PIN must contain 4 to 12 digits.'), { code: 'SECURITY_VALIDATION' });
    }
    else {
      if (value.length < 8 || value.length > LIMITS.SECURITY_PASSWORD_MAX_CHARS) throw Object.assign(new Error(`Password must contain 8 to ${LIMITS.SECURITY_PASSWORD_MAX_CHARS} characters.`), { code: 'SECURITY_VALIDATION' });
    }
    return value;
  };
  const deriveSecurityVerifier = async (secret, salt, iterations = 310000) => {
    const enc = new TextEncoder(),
      base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']),
      bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, 256);
    return new Uint8Array(bits);
  };
  const constantTimeEqual = (a, b) => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)diff |= a[i] ^ b[i];
    return diff === 0;
  };
  const authFailureState = async () => {
    const sess = await securitySession(), blockedUntil = Number(sess.blockedUntil) || 0;
    if (blockedUntil > Date.now()) throw Object.assign(new Error(`Too many incorrect attempts. Try again in ${Math.ceil((blockedUntil - Date.now()) / 1000)} seconds.`), { code: 'SECURITY_RATE_LIMIT' });
    return sess;
  };
  const verifySecuritySecret = async secret => {
    const cfg = await securityConfig();
    if (!cfg.enabled) return true;
    const sess = await authFailureState();
    let salt, expected;
    try {
      salt = b64ToBytes(cfg.salt);
      expected = b64ToBytes(cfg.verifier);
    } catch {
      throw Object.assign(new Error('Extension lock configuration is invalid.'), { code: 'SECURITY_CONFIG_INVALID' });
    }
    const actual = await deriveSecurityVerifier(String(secret || ''), salt, cfg.iterations),
      ok = constantTimeEqual(actual, expected);
    if (!ok) {
      const failed = Math.max(0, Number(sess.failedAttempts) || 0) + 1,
        blockedUntil = failed >= 5 ? Date.now() + Math.min(60000, 15000 * (failed - 4)) : 0;
      await sessionSet({ [STORAGE_KEYS.SECURITY_SESSION]: { ...sess, failedAttempts: failed, blockedUntil } });
      throw Object.assign(new Error('Incorrect PIN or password.'), { code: 'SECURITY_AUTH_FAILED' });
    }
    await sessionSet({ [STORAGE_KEYS.SECURITY_SESSION]: { ...sess, failedAttempts: 0, blockedUntil: 0 } });
    return true;
  };
  const unlockSecurity = async secret => {
    const cfg = await securityConfig();
    if (!cfg.enabled) return securityStatus();
    await verifySecuritySecret(secret);
    const sess = await securitySession(), until = Date.now() + cfg.sessionMinutes * 60000;
    await sessionSet({ [STORAGE_KEYS.SECURITY_SESSION]: { ...sess, unlockedAt: Date.now(), unlockedUntil: until, failedAttempts: 0, blockedUntil: 0 } });
    return securityStatus();
  };
  const lockSecurity = async () => {
    const sess = await securitySession();
    await sessionSet({ [STORAGE_KEYS.SECURITY_SESSION]: { ...sess, unlockedUntil: 0, unlockedAt: 0 } });
    return securityStatus();
  };
  const setSecurityPasscode = async ({ method = 'password', passcode = '', sessionMinutes = 30 } = {}) => {
    method = method === 'pin' ? 'pin' : 'password';
    const secret = validateSecuritySecret(method, passcode),
      minutes = Math.max(LIMITS.SECURITY_SESSION_MINUTES_MIN, Math.min(LIMITS.SECURITY_SESSION_MINUTES_MAX, Math.round(Number(sessionMinutes) || 30))),
      salt = crypto.getRandomValues(new Uint8Array(16)),
      iterations = 310000,
      verifier = await deriveSecurityVerifier(secret, salt, iterations);
    await localSet({ [STORAGE_KEYS.SECURITY]: { enabled: true, method, sessionMinutes: minutes, salt: bytesToB64(salt), verifier: bytesToB64(verifier), iterations, updatedAt: new Date().toISOString() } });
    await sessionRemove(STORAGE_KEYS.SECURITY_RISK_TOKENS);
    return unlockSecurity(secret);
  };
  const updateSecuritySettings = async ({ sessionMinutes } = {}) => {
    const cfg = await securityConfig();
    if (!cfg.enabled) throw Object.assign(new Error('Extension lock is not enabled.'), { code: 'SECURITY_NOT_ENABLED' });
    const minutes = Math.max(LIMITS.SECURITY_SESSION_MINUTES_MIN, Math.min(LIMITS.SECURITY_SESSION_MINUTES_MAX, Math.round(Number(sessionMinutes) || cfg.sessionMinutes)));
    const r = await localGet(STORAGE_KEYS.SECURITY), raw = r[STORAGE_KEYS.SECURITY] || {};
    await localSet({ [STORAGE_KEYS.SECURITY]: { ...raw, sessionMinutes: minutes, updatedAt: new Date().toISOString() } });
    const sess = await securitySession();
    if (Number(sess.unlockedUntil) > Date.now()) await sessionSet({ [STORAGE_KEYS.SECURITY_SESSION]: { ...sess, unlockedUntil: Date.now() + minutes * 60000 } });
    return securityStatus();
  };
  const disableSecurity = async () => {
    await localRemove(STORAGE_KEYS.SECURITY);
    await sessionRemove(STORAGE_KEYS.SECURITY_SESSION);
    await sessionRemove(STORAGE_KEYS.SECURITY_RISK_TOKENS);
    return securityStatus();
  };
  const issueSecurityRiskToken = async secret => {
    const cfg = await securityConfig();
    if (!cfg.enabled) return { token: '', status: await securityStatus() };
    await verifySecuritySecret(secret);
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`,
      r = await sessionGet(STORAGE_KEYS.SECURITY_RISK_TOKENS),
      map = r[STORAGE_KEYS.SECURITY_RISK_TOKENS] || {},
      now = Date.now();
    for (const [k, v] of Object.entries(map)) if (Number(v?.expiresAt) || 0 <= now) delete map[k];
    map[token] = { expiresAt: now + 90000 };
    await sessionSet({ [STORAGE_KEYS.SECURITY_RISK_TOKENS]: map });
    const status = await unlockSecurity(secret);
    return { token, status };
  };
  const validateSecurityRiskToken = async token => {
    const cfg = await securityConfig();
    if (!cfg.enabled) return true;
    const r = await sessionGet(STORAGE_KEYS.SECURITY_RISK_TOKENS),
      row = (r[STORAGE_KEYS.SECURITY_RISK_TOKENS] || {})[String(token || '')];
    return Boolean(row && Number(row.expiresAt) > Date.now());
  };
  const isSecurityUnlocked = async () => {
    const status = await securityStatus();
    return status.unlocked;
  };
  const getJobs = async () => {
    const r = await localGet(STORAGE_KEYS.JOBS);
    return Array.isArray(r[STORAGE_KEYS.JOBS]) ? r[STORAGE_KEYS.JOBS] : [];
  };
  const saveJobs = jobs => localSet({ [STORAGE_KEYS.JOBS]: (jobs || []).slice(-LIMITS.JOBS_MAX) });
  const getLedger = async () => {
    const r = await localGet(STORAGE_KEYS.LEDGER);
    return r[STORAGE_KEYS.LEDGER] || {};
  };
  const saveLedger = ledger => {
    const entries = Object.entries(ledger || {}).sort((a, b) => new Date(b[1]?.at || 0) - new Date(a[1]?.at || 0)).slice(0, LIMITS.LEDGER_MAX);
    return localSet({ [STORAGE_KEYS.LEDGER]: Object.fromEntries(entries) });
  };
  const getCursors = () => getMap(STORAGE_KEYS.CURSORS, false),
    saveCursors = m => setMap(STORAGE_KEYS.CURSORS, m, false);
  const cursorKey = (profileId, ruleId) => `${profileId}:${ruleId}`;
  const getCursor = async (profileId, ruleId) => (await getCursors())[cursorKey(profileId, ruleId)] || null;
  const setCursor = async (profileId, ruleId, value) => {
    const m = await getCursors();
    m[cursorKey(profileId, ruleId)] = { ...(m[cursorKey(profileId, ruleId)] || {}), ...value };
    await saveCursors(m);
    return m[cursorKey(profileId, ruleId)];
  };
  const clearProfileRuntime = async profileId => {
    const existing = await getJobs(),
      removed = existing.filter(x => x.profileId === profileId),
      jobs = existing.filter(x => x.profileId !== profileId);
    await saveJobs(jobs);
    for (const j of removed) try {
      await chrome.alarms?.clear?.(`sd-job-${j.id}`);
    } catch {}
    const ledger = await getLedger();
    for (const k of Object.keys(ledger)) if (k.includes(`:${profileId}:`) || k.startsWith(`${profileId}:`) || ledger[k]?.profileId === profileId) delete ledger[k];
    await saveLedger(ledger);
    const cursors = await getCursors();
    for (const k of Object.keys(cursors)) if (k.startsWith(`${profileId}:`)) delete cursors[k];
    await saveCursors(cursors);
  };
  const deleteByProfile = async profileId => {
    await clearProfileRuntime(profileId);
    const audit = (await getAudit()).filter(x => x.profileId !== profileId);
    await localSet({ [STORAGE_KEYS.AUDIT]: audit });
    const logs = (await getLogs()).filter(x => x.profileId !== profileId);
    await localSet({ [STORAGE_KEYS.LOGS]: logs });
  };
  const deleteBySite = async siteId => {
    await deleteCredential(siteId);
    const state = await ensureState();
    for (const p of state.profiles.filter(p => p.siteId === siteId)) await deleteByProfile(p.id);
    const audit = (await getAudit()).filter(x => x.siteId !== siteId);
    await localSet({ [STORAGE_KEYS.AUDIT]: audit });
    const logs = (await getLogs()).filter(x => x.siteId !== siteId);
    await localSet({ [STORAGE_KEYS.LOGS]: logs });
  };
  const clearCache = async siteId => updateState(state => {
    const s = state.jiraSites.find(x => x.id === siteId);
    if (!s) throw new Error('Server not found.');
    s.filters = [];
    s.projects = [];
    s.users = [];
    s.issueTypes = [];
    s.statuses = [];
    s.fields = [];
    s.priorities = [];
    s.resolutions = [];
    s.projectStatusMatrix = [];
    s.transitionCatalog = [];
    s.issues = [];
    s.inventory = { ...s.inventory, lastFullSyncAt: null, lastProjectSyncAt: null, snapshotId: '', scopeHash: '', warnings: [], counts: {}, freshness: {} };
  }, { configWrite: true });
  const clearProfileData = async profileId => {
    await clearProfileRuntime(profileId);
    return updateState(state => {
      const p = state.profiles.find(x => x.id === profileId);
      if (p) {
        p.runtime = { ...root.Defaults.profile(p.name).runtime };
        for (const r of p.rules || []) r.runtime = { ...root.Defaults.rule(r.name).runtime };
      }
      for (const s of state.jiraSites) {
        s.runtime.radarEvents = (s.runtime.radarEvents || []).filter(e => e.profileId !== profileId);
        s.runtime.radarMarkers = (s.runtime.radarMarkers || []).filter(e => e.profileId !== profileId);
      }
    });
  };
  const cleanupLegacyExecutionArtifacts = async () => {
    const jobs = await getJobs(),
      keepJobs = jobs.filter(j => String(j?.status || '').toLowerCase() !== 'simulated' && !j?.blockedByDryRun);
    if (keepJobs.length !== jobs.length) await saveJobs(keepJobs);
    const ledger = await getLedger();
    let changed = false;
    for (const [k, v] of Object.entries(ledger)) {
      if (v?.simulated || String(v?.status || '').toLowerCase() === 'simulated') {
        delete ledger[k];
        changed = true;
      }
    }
    if (changed) await saveLedger(ledger);
    return { removedJobs: jobs.length - keepJobs.length, removedLedger: changed };
  };
  const factoryReset = async () => withStateLock(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    const state = root.Defaults.state();
    await localSet({
      [STORAGE_KEYS.STATE]: state,
      [STORAGE_KEYS.LOGS]: [],
      [STORAGE_KEYS.AUDIT]: [],
      [STORAGE_KEYS.JOBS]: [],
      [STORAGE_KEYS.LEDGER]: {},
      [STORAGE_KEYS.CURSORS]: {},
      [STORAGE_KEYS.INSTALL]: { installedAt: new Date().toISOString(), build: root.Constants.BUILD_VERSION }
    });
    return structuredClone(state);
  });
  root.Storage = Object.freeze({
    ensureState,
    saveState,
    updateState,
    getLogs,
    appendLog,
    clearLogs,
    getAudit,
    appendAudit,
    clearAudit,
    saveCredential,
    getCredential,
    deleteCredential,
    hasCredential,
    securityStatus,
    unlockSecurity,
    lockSecurity,
    setSecurityPasscode,
    updateSecuritySettings,
    disableSecurity,
    issueSecurityRiskToken,
    validateSecurityRiskToken,
    isSecurityUnlocked,
    getJobs,
    saveJobs,
    getLedger,
    saveLedger,
    getCursors,
    getCursor,
    setCursor,
    clearProfileRuntime,
    deleteByProfile,
    deleteBySite,
    clearCache,
    clearProfileData,
    cleanupLegacyExecutionArtifacts,
    factoryReset
  });
})();
