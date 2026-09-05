(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    randomInt = (min, max) => {
      const a = Math.ceil(Number(min) || 0), b = Math.floor(Number(max) || a);
      return Math.floor(Math.random() * (b - a + 1)) + a;
    },
    sleep = ms => new Promise(r => setTimeout(r, ms)),
    nowIso = () => new Date().toISOString();
  const normalizeText = v => String(v ?? "").replace(/\s+/g, " ").trim(),
    parseLines = v => String(v ?? "").split(/[\n,]/).map(normalizeText).filter(Boolean);
  const uniqueBy = (items, keyFn) => {
    const m = new Map();
    for (const item of items || []) {
      const k = keyFn(item);
      if (k) m.set(k, item);
    }
    return [...m.values()];
  },
    mergeUnique = (a, b, keyFn) => {
      const m = new Map();
      for (const item of [...(a || []), ...(b || [])]) {
        const k = keyFn(item);
        if (k) m.set(k, { ...(m.get(k) || {}), ...item });
      }
      return [...m.values()];
    };
  const normalizeBaseUrl = v => {
    try {
      const u = new URL(String(v).trim());
      if (!/^https?:$/.test(u.protocol)) return "";
      let p = u.pathname.replace(/\/+$/, "");
      if (p === "/") p = "";
      return `${u.origin}${p}`;
    } catch {
      return "";
    }
  },
    siteIdFromBaseUrl = v => {
      const s = normalizeBaseUrl(v).toLowerCase();
      let h = 2166136261;
      for (const c of s) {
        h ^= c.codePointAt(0);
        h = Math.imul(h, 16777619);
      }
      return `jira-${(h >>> 0).toString(16).padStart(8, "0")}`;
    };
  const formatDateTime = v => {
    if (!v) return "Never";
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(v));
    } catch {
      return String(v);
    }
  },
    randomChoice = a => a?.length ? a[randomInt(0, a.length - 1)] : null,
    delaySeconds = (range = {}, jitter = 0) => {
      const min = clamp(range.minSeconds, 0, 86400),
        max = clamp(range.maxSeconds, min, 86400),
        base = randomInt(min, max);
      return Math.max(0, Math.round(base * (1 + ((Math.random() * 2 - 1) * clamp(jitter, 0, 100) / 100))));
    };
  const discoveryProjectKeys = settings => Object.entries(settings?.projectDatasets || {}).filter(([key, cfg]) => Boolean(key) && cfg && typeof cfg === "object" && Object.values(cfg).some(Boolean)).map(([key]) => key);
  const userKey = u => u && (u.accountId || u.key || u.name) || "",
    safeError = e => ({ name: e?.name || "Error", message: e?.message || String(e), status: e?.status || null, code: e?.code || null, url: e?.url || null, details: e?.details || null });
  const downloadJson = (filename, value) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const getPath = (obj, path) => String(path || "").split(".").reduce((v, k) => v?.[k], obj);
  const templateValue = value => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(templateValue).filter(Boolean).join(", ");
    if (typeof value === "object") {
      for (const key of ["displayName", "name", "key", "value", "id"]) {
        if (value[key] !== null && value[key] !== undefined && String(value[key]).trim()) return String(value[key]);
      }
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  };
  const resolveTemplatePath = (issue, path, extra = {}) => {
    const key = String(path || "").trim();
    if (key === "now") return new Date().toISOString();
    const map = {
      issue,
      project: { key: issue?.projectKey, name: issue?.projectName, id: issue?.projectId },
      assignee: issue?.assignee || {},
      reporter: issue?.reporter || {},
      creator: issue?.creator || {},
      ...extra
    };
    const rooted = key.startsWith("issue.") || key.startsWith("project.") || key.startsWith("assignee.") || key.startsWith("reporter.") || key.startsWith("creator.") ? key : `issue.${key}`;
    return getPath(map, rooted);
  };
  const template = (text, issue, extra = {}) => String(text ?? "").replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => templateValue(resolveTemplatePath(issue, path, extra)));
  const insideJsonString = (text, at) => {
    let quoted = false, escaped = false;
    for (let i = 0; i < at; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') quoted = !quoted;
    }
    return quoted;
  };
  const templateJson = (text, issue, extra = {}) => {
    const source = String(text ?? "");
    return source.replace(/\{\{\s*([^}]+)\s*\}\}/g, (token, path, offset) => {
      const raw = resolveTemplatePath(issue, path, extra);
      if (insideJsonString(source, offset)) {
        const encoded = JSON.stringify(templateValue(raw));
        return encoded.slice(1, -1);
      }
      if (raw === undefined) return 'null';
      try { return JSON.stringify(raw); } catch { return JSON.stringify(templateValue(raw)); }
    });
  };
  const normalizeTimeUnit = u => ["seconds", "minutes", "hours"].includes(String(u)) ? String(u) : "seconds";
  const timeUnitMultiplier = u => ({ seconds: 1, minutes: 60, hours: 3600 }[normalizeTimeUnit(u)] || 1);
  const timeToSeconds = (value, unit) => Number(value || 0) * timeUnitMultiplier(unit);
  const timeFromSeconds = (seconds, unit) => Number(seconds || 0) / timeUnitMultiplier(unit);
  root.Utils = Object.freeze({
    normalizeTimeUnit,
    timeUnitMultiplier,
    timeToSeconds,
    timeFromSeconds,
    clamp,
    randomInt,
    sleep,
    nowIso,
    normalizeText,
    parseLines,
    uniqueBy,
    mergeUnique,
    normalizeBaseUrl,
    siteIdFromBaseUrl,
    formatDateTime,
    randomChoice,
    delaySeconds,
    discoveryProjectKeys,
    userKey,
    safeError,
    downloadJson,
    template,
    templateJson
  });
})();
