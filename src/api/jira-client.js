(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {},
    { API } = root.Constants,
    { sleep, normalizeBaseUrl, uniqueBy } = root.Utils;
  const isPrivateHost = (hostname = "") => {
    const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
    if (h === "localhost" || [".local", ".lan", ".internal", ".corp", ".dc", ".home.arpa"].some(x => h.endsWith(x))) return true;
    if (/^127\.|^10\.|^192\.168\.|^169\.254\./.test(h)) return true;
    const m = h.match(/^172\.(\d+)\./);
    if (m && +m[1] >= 16 && +m[1] <= 31) return true;
    return h === "::1" || /^f[cd][0-9a-f]:/i.test(h) || /^fe[89ab][0-9a-f]:/i.test(h);
  };
  class JiraApiError extends Error {
    constructor(message, status = 0, details = null, url = "", code = "JIRA_API_ERROR") {
      super(message);
      this.name = "JiraApiError";
      this.status = status;
      this.details = details;
      this.url = url;
      this.code = code;
    }
  }
  const networkError = (error, url) => new JiraApiError(
    "Jira API could not be reached before Jira returned an HTTP response. Chrome/Edge may have blocked the request because of Local Network Access/CORS policy, TLS certificate validation, DNS/proxy/VPN routing, or the server being unreachable. SD Companion leaves network and certificate validation to the browser and does not use a Jira-tab fallback. The current operation was stopped.",
    0,
    { endpoint: url, transport: "extension-worker", originalMessage: error?.message || String(error), networkPolicy: "browser-managed", certificateTrust: "browser-system" },
    url,
    "NETWORK_REQUEST_FAILED"
  );
  class JiraClient {
    constructor(site, token, { operationId = "" } = {}) {
      this.site = site;
      this.baseUrl = normalizeBaseUrl(site.baseUrl);
      this.token = String(token || "").trim();
      this.apiRoot = `${this.baseUrl}/rest/api/${API.VERSION}`;
      this.operationId = operationId;
      this.lastTransport = "";
      this.transportCounts = { extension: 0 };
      this.requestCount = 0;
      this.capabilities = { ...(site.capabilities || {}) };
      this.stats = { requests: 0, failures: 0, retries: 0, rateLimited: 0, totalLatencyMs: 0, maxLatencyMs: 0, lastRequestAt: null };
    }
    policy() {
      return { spacingMs: 350, jitterPercent: 15, timeoutMs: API.REQUEST_TIMEOUT_MS, retries: 2, maxRequestsPerMinute: 120, maxConcurrent: 1, backoffMaxSeconds: 60, ...(this.site?.network?.requestPolicy || {}) };
    }
    checkCancelled() {
      root.Operations?.throwIfCancelled(this.operationId);
    }
    markCap(name, value = true) {
      this.capabilities[name] = value;
    }
    async fetchResponse(url, init) {
      this.checkCancelled();
      try {
        const response = await fetch(url, init);
        this.lastTransport = "extension-worker";
        this.transportCounts.extension++;
        return response;
      } catch (e) {
        throw networkError(e, url);
      }
    }
    async request(path, { method = "GET", query = null, body = null, retries = null, timeoutMs = null, credentials = "omit", authorization = true, accept = "application/json" } = {}) {
      const policy = this.policy();
      if (retries === null) retries = Number(policy.retries) || 0;
      if (timeoutMs === null) timeoutMs = Number(policy.timeoutMs) || API.REQUEST_TIMEOUT_MS;
      let url = path.startsWith("http") ? path : `${this.apiRoot}${path.startsWith("/") ? path : `/${path}`}`;
      if (query) {
        const u = new URL(url);
        for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
        url = u.href;
      }
      let last;
      for (let attempt = 0; attempt <= retries; attempt++) {
        this.checkCancelled();
        await root.RequestScheduler?.before(this.site, this.operationId);
        const started = performance.now(),
          controller = new AbortController(),
          parent = root.Operations?.signal(this.operationId),
          onAbort = () => controller.abort();
        if (parent) parent.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let schedulerReleased = false;
        try {
          const headers = { Accept: accept };
          if (authorization) headers.Authorization = `Bearer ${this.token}`;
          if (body !== null) headers["Content-Type"] = "application/json";
          if (method !== "GET" && method !== "HEAD") headers["X-Atlassian-Token"] = "no-check";
          const init = { method, headers, body: body === null ? undefined : JSON.stringify(body), signal: controller.signal, credentials, cache: "no-store", redirect: "follow" };
          this.requestCount++;
          this.stats.requests++;
          this.stats.lastRequestAt = new Date().toISOString();
          const response = await this.fetchResponse(url, init),
            latency = Math.max(0, Math.round(performance.now() - started));
          this.stats.totalLatencyMs += latency;
          this.stats.maxLatencyMs = Math.max(this.stats.maxLatencyMs, latency);
          const retryAfter = Number(response.headers?.get?.("Retry-After")) || 0;
          root.RequestScheduler?.after(this.site, { status: response.status, retryAfterSeconds: retryAfter });
          schedulerReleased = true;
          const text = await response.text();
          let data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
          }
          if (response.ok) return data;
          const message = (data?.errorMessages || []).join("; ") || Object.values(data?.errors || {}).join("; ") || data?.message || `Jira returned HTTP ${response.status}`,
            code = response.status === 401 ? "PAT_UNAUTHORIZED" : response.status === 403 ? "PAT_FORBIDDEN" : response.status === 429 ? "RATE_LIMITED" : "JIRA_HTTP_ERROR",
            error = new JiraApiError(message, response.status, { response: data, transport: this.lastTransport, finalUrl: response.url || url }, url, code);
          this.stats.failures++;
          if (response.status === 429) this.stats.rateLimited++;
          if (![429, 502, 503, 504].includes(response.status) || attempt === retries) throw error;
          this.stats.retries++;
          await sleep(Math.min(Number(policy.backoffMaxSeconds) || 60, retryAfter || Math.min(2 ** attempt, 15)) * 1000);
          last = error;
        } catch (e) {
          let error = e;
          if (parent?.aborted || root.Operations?.signal(this.operationId)?.aborted) {
            error = new JiraApiError('Operation cancelled.', 0, null, url, 'OPERATION_CANCELLED');
          }
          else if (e?.name === "AbortError") error = new JiraApiError(`Request timed out after ${timeoutMs} ms`, 0, { timeoutMs }, url, "REQUEST_TIMEOUT");
          else if (!(e instanceof JiraApiError)) error = networkError(e, url);
          if (error.code === 'OPERATION_CANCELLED') throw error;
          if (error.code === 'NETWORK_REQUEST_FAILED') {
            this.stats.failures++;
            throw error;
          }
          if (error instanceof JiraApiError && error.status) throw error;
          this.stats.failures++;
          if (attempt === retries) throw error;
          this.stats.retries++;
          last = error;
          await sleep(Math.min(Number(policy.backoffMaxSeconds) || 60, Math.min(2 ** attempt, 10)) * 1000);
        } finally {
          clearTimeout(timer);
          if (parent) parent.removeEventListener('abort', onAbort);
          if (!schedulerReleased) root.RequestScheduler?.release(this.site);
        }
      }
      throw last || new JiraApiError("Unknown request failure", 0, null, url, "UNKNOWN_REQUEST_FAILURE");
    }
    statsSnapshot() {
      const n = this.stats.requests || 0;
      return { ...this.stats, avgLatencyMs: n ? Math.round(this.stats.totalLatencyMs / n) : 0, transport: this.lastTransport, transportCounts: { ...this.transportCounts } };
    }
    async arrayPages(path, { query = {}, pageSize = 100, max = 10000, valueKeys = ["values", "users", "issues"], retries = 1 } = {}) {
      const out = [], seen = new Set();
      let startAt = 0;
      for (let page = 0; page < Math.ceil(max / pageSize) + 2 && out.length < max; page++) {
        this.checkCancelled();
        const requested = Math.min(pageSize, max - out.length),
          data = await this.request(path, { query: { ...query, startAt, maxResults: requested }, retries }),
          values = Array.isArray(data) ? data : (valueKeys.map(k => data?.[k]).find(Array.isArray) || []),
          signature = JSON.stringify([values.length, values[0]?.accountId || values[0]?.key || values[0]?.id || "", values.at(-1)?.accountId || values.at(-1)?.key || values.at(-1)?.id || ""]);
        if (seen.has(signature) && page > 0) break;
        seen.add(signature);
        out.push(...values);
        if (data?.isLast || !values.length || values.length < requested) break;
        const next = Number(data?.startAt ?? startAt) + values.length;
        if (next <= startAt) break;
        startAt = next;
      }
      return out.slice(0, max);
    }
    myself() {
      return this.request("/myself", { retries: 1 });
    } serverInfo() {
      return this.request("/serverInfo", { retries: 1 }).then(x => (this.markCap('serverInfo', true), x)).catch(e => {
        this.markCap('serverInfo', false);
        throw e;
      });
    } myPermissions() {
      return this.request("/mypermissions", { retries: 1 }).then(x => (this.markCap('permissions', true), x)).catch(e => {
        this.markCap('permissions', false);
        throw e;
      });
    }
    async diagnose() {
      const r = { myself: await this.myself(), serverInfo: null, permissions: null, warnings: [], transport: "" };
      this.markCap('restApi2', true);
      for (const [name, fn] of [["serverInfo", () => this.serverInfo()], ["permissions", () => this.myPermissions()]]) try {
        r[name] = await fn();
      } catch (e) {
        r.warnings.push({ stage: name, message: e.message, status: e.status || 0, code: e.code || "" });
      }
      r.transport = this.lastTransport;
      r.transportCounts = { ...this.transportCounts };
      r.capabilities = { ...this.capabilities };
      r.stats = this.statsSnapshot();
      return r;
    }
    async projects() {
      let list = [];
      try {
        const data = await this.request("/project", { query: { expand: "description,lead,url,projectKeys" }, retries: 1 });
        list = Array.isArray(data) ? data : (data?.values || []);
        this.markCap('projects', true);
      } catch (e) {
        this.markCap('projects', false);
        if (![400, 404, 405].includes(e.status)) throw e;
      }
      if (list.length) return list;
      try {
        const x = await this.arrayPages("/project/search", { query: { expand: "description,lead,url,projectKeys" }, pageSize: 50, max: API.MAX_PROJECTS, valueKeys: ["values"], retries: 1 });
        this.markCap('projectSearch', true);
        return x;
      } catch (e) {
        this.markCap('projectSearch', false);
        if (![400, 404, 405].includes(e.status)) throw e;
        return list;
      }
    }
    project(key) {
      return this.request(`/project/${encodeURIComponent(key)}`, { query: { expand: "description,lead,url,projectKeys,issueTypes" }, retries: 1 });
    }
    fields() {
      return this.request("/field").then(x => (this.markCap('fields', true), x)).catch(e => {
        this.markCap('fields', false);
        throw e;
      });
    }
    async projectCreateIssueTypes(projectKey, max = 500) {
      const out = [];
      let startAt = 0;
      for (let page = 0; page < 20 && out.length < max; page++) {
        this.checkCancelled();
        const data = await this.request(`/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`, { query: { startAt, maxResults: Math.min(50, max - out.length) }, retries: 1 });
        const values = Array.isArray(data) ? data : (data?.values || []);
        out.push(...values);
        this.markCap('projectCreateMeta', true);
        if (!values.length || data?.last === true || data?.isLast === true || values.length < 50) break;
        startAt += values.length;
      }
      return out.slice(0, max);
    }
    async projectIssueTypeFields(projectKey, issueTypeId, max = 1000) {
      const out = [];
      let startAt = 0;
      for (let page = 0; page < 30 && out.length < max; page++) {
        this.checkCancelled();
        const data = await this.request(`/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes/${encodeURIComponent(issueTypeId)}`, { query: { startAt, maxResults: Math.min(50, max - out.length) }, retries: 1 });
        const values = Array.isArray(data) ? data : (data?.values || data?.fields || []);
        const list = Array.isArray(values) ? values : Object.entries(values || {}).map(([fieldId, v]) => ({ fieldId, ...v }));
        out.push(...list);
        this.markCap('projectCreateMeta', true);
        this.markCap('fields', true);
        if (!list.length || data?.last === true || data?.isLast === true || list.length < 50) break;
        startAt += list.length;
      }
      return out.slice(0, max);
    }
    priorities() {
      return this.request("/priority", { retries: 1 }).then(x => (this.markCap('priorities', true), x)).catch(e => {
        this.markCap('priorities', false);
        throw e;
      });
    } resolutions() {
      return this.request("/resolution", { retries: 1 }).then(x => (this.markCap('resolutions', true), x)).catch(e => {
        this.markCap('resolutions', false);
        throw e;
      });
    } projectStatuses(key) {
      return this.request(`/project/${encodeURIComponent(key)}/statuses`, { retries: 1 }).then(x => (this.markCap('projectStatuses', true), x)).catch(e => {
        this.markCap('projectStatuses', false);
        throw e;
      });
    }
    filter(id) {
      return this.request(`/filter/${encodeURIComponent(id)}`, { query: { expand: "owner,jql,viewUrl,searchUrl,sharePermissions" }, retries: 1 });
    }
    favouriteFilters() {
      return this.request("/filter/favourite", { query: { expand: "owner,jql,viewUrl,searchUrl,sharePermissions" }, retries: 1 }).then(x => (this.markCap('favouriteFilters', true), x)).catch(e => {
        this.markCap('favouriteFilters', false);
        throw e;
      });
    }
    myFilters() {
      return this.request("/filter/my", { query: { includeFavourites: true, expand: "owner,jql,viewUrl,searchUrl,sharePermissions" }, retries: 1 }).then(x => (this.markCap('filterMine', true), x)).catch(e => {
        this.markCap('filterMine', false);
        throw e;
      });
    }
    async ownedFilters(user, max = API.MAX_FILTERS) {
      const all = [], queries = [];
      if (user?.accountId) queries.push({ accountId: user.accountId });
      for (const owner of [user?.name, user?.key].filter(Boolean)) queries.push({ owner });
      const seen = new Set();
      let supported = false;
      for (const q of queries) {
        const sig = JSON.stringify(q);
        if (seen.has(sig)) continue;
        seen.add(sig);
        try {
          all.push(...await this.arrayPages("/filter/search", { query: { ...q, expand: "owner,jql,viewUrl,searchUrl,sharePermissions", orderBy: "name" }, pageSize: 100, max, valueKeys: ["values"], retries: 1 }));
          supported = true;
        } catch (e) {
          if (![400, 404, 405].includes(e.status)) throw e;
        }
      }
      this.markCap('filterSearch', supported);
      return uniqueBy(all, f => String(f.id));
    }
    async filters(user = null) {
      let owner = user;
      if (!owner) try {
        owner = await this.myself();
      } catch {}
      const all = [], sources = { mine: false, search: false, favourites: false }, errors = [];
      try {
        const x = await this.myFilters();
        all.push(...(Array.isArray(x) ? x : (x?.values || [])));
        sources.mine = true;
      } catch (e) {
        errors.push({ source: 'mine', status: e.status || 0, code: e.code || '', message: e.message });
        if (![400, 404, 405].includes(e.status)) throw e;
      }
      try {
        const x = await this.ownedFilters(owner);
        all.push(...x);
        sources.search = Boolean(this.capabilities.filterSearch);
      } catch (e) {
        errors.push({ source: 'search', status: e.status || 0, code: e.code || '', message: e.message });
      }
      try {
        const x = await this.favouriteFilters();
        all.push(...(Array.isArray(x) ? x : (x?.values || [])));
        sources.favourites = true;
      } catch (e) {
        errors.push({ source: 'favourites', status: e.status || 0, code: e.code || '', message: e.message });
      }
      this.markCap('filters', sources.mine || sources.search || sources.favourites);
      this.filterCoverage = sources.mine || sources.search ? 'owned-and-favourites' : sources.favourites ? 'favourites-only' : 'unavailable';
      this.filterCoverageDetails = { sources, errors };
      const merged = uniqueBy(all, f => String(f.id));
      for (let i = 0; i < merged.length; i++) {
        const f = merged[i];
        if (f?.jql || !f?.id) continue;
        try {
          merged[i] = { ...f, ...await this.filter(f.id) };
        } catch (e) {
          errors.push({ source: `filter:${f.id}`, status: e.status || 0, code: e.code || '', message: e.message });
        }
      }
      return merged;
    }
    async searchPage(jql, { startAt = 0, maxResults = 50, fields = null } = {}) {
      this.checkCancelled();
      const wanted = fields || ["summary", "issuetype", "status", "project", "updated"];
      const page = await this.request("/search", { method: "POST", body: { jql, startAt: Math.max(0, Number(startAt) || 0), maxResults: Math.max(1, Math.min(API.PAGE_SIZE, Number(maxResults) || 1)), fields: wanted } });
      return { ...page, issues: Array.isArray(page?.issues) ? page.issues : [], total: Number.isFinite(Number(page?.total)) ? Number(page.total) : null };
    }
    async searchCount(jql) {
      const page = await this.searchPage(jql, { startAt: 0, maxResults: 1, fields: ["status"] });
      return Number.isFinite(page.total) ? page.total : page.issues.length;
    }
    async search(jql, { maxIssues = API.MAX_ISSUES, fields = null } = {}) {
      const result = [];
      let startAt = 0;
      const wanted = fields || ["summary", "description", "issuetype", "status", "assignee", "reporter", "creator", "project", "priority", "created", "updated", "labels", "components", "resolution", "duedate"];
      while (result.length < maxIssues) {
        this.checkCancelled();
        const maxResults = Math.min(API.PAGE_SIZE, maxIssues - result.length),
          page = await this.searchPage(jql, { startAt, maxResults, fields: wanted }),
          issues = page?.issues || [];
        result.push(...issues);
        if (!issues.length) break;
        const total = Number(page?.total);
        if (Number.isFinite(total) && result.length >= total) break;
        if (!Number.isFinite(total) && issues.length < maxResults) break;
        startAt += issues.length;
      }
      return result;
    }
    async workflowNameFromIssuePage(key) {
      const issueKey = String(key || "").trim();
      if (!issueKey) throw new JiraApiError("Issue key is required for workflow discovery.", 0, null, "", "WORKFLOW_ISSUE_REQUIRED");
      const url = `${this.baseUrl}/browse/${encodeURIComponent(issueKey)}`;
      let html;
      try {
        html = await this.request(url, { retries: 0, credentials: "include", authorization: false, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" });
      }
      catch (e) {
        this.markCap('workflowBrowseName', false);
        throw e;
      }
      if (typeof html !== "string") html = String(html || "");
      const userMatch = html.match(/<meta\s+name=["']ajs-remote-user["']\s+content=["']([^"']*)["']/i) || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']ajs-remote-user["']/i);
      const nameMatch = html.match(/(?:[?&]|&amp;)workflowName=([^&"'<>\s]+)/i);
      if (!nameMatch) {
        this.markCap('workflowBrowseName', false);
        throw new JiraApiError("Jira did not expose a read-only workflow link for this issue. Sign in to this Jira server in the browser and ensure the browser user has the 'View (read-only) workflow' project permission.", 200, { issueKey, htmlLength: html.length, browserUser: userMatch?.[1] || "", hasIssueKey: html.includes(issueKey), hasViewWorkflowButton: html.includes("view-workflow-button") }, url, "WORKFLOW_NAME_UNAVAILABLE");
      }
      let encoded = nameMatch[1].replace(/&amp;/gi, "&").replace(/\+/g, " "), workflowName = "";
      try {
        workflowName = decodeURIComponent(encoded);
      } catch {
        workflowName = encoded;
      }
      workflowName = workflowName.trim();
      if (!workflowName) throw new JiraApiError("Jira returned an empty workflow name.", 200, { issueKey }, url, "WORKFLOW_NAME_UNAVAILABLE");
      this.markCap('workflowBrowseName', true);
      return { workflowName, browserUser: userMatch?.[1] || "", issueKey };
    }
    workflowDesigner(workflowName) {
      const name = String(workflowName || "").trim();
      if (!name) return Promise.reject(new JiraApiError("Workflow name is required.", 0, null, "", "WORKFLOW_NAME_REQUIRED"));
      const url = `${this.baseUrl}/rest/workflowDesigner/latest/workflows`;
      return this.request(url, { query: { name, draft: false }, retries: 1 }).then(x => {
        if (!x || typeof x !== "object" || !x.layout || !Array.isArray(x.layout.statuses) || !Array.isArray(x.layout.transitions)) throw new JiraApiError("Jira Workflow Designer returned an unexpected response.", 200, { workflowName: name }, url, "WORKFLOW_DESIGNER_INVALID_RESPONSE");
        this.markCap('workflowDesigner', true);
        return x;
      }).catch(e => {
        this.markCap('workflowDesigner', false);
        if (e instanceof JiraApiError && [401, 403, 404].includes(e.status)) e.code = "WORKFLOW_DESIGNER_UNAVAILABLE";
        throw e;
      });
    }
    issue(key, expand = "names,schema,transitions") {
      return this.request(`/issue/${encodeURIComponent(key)}`, { query: { expand } });
    } transitions(key) {
      return this.request(`/issue/${encodeURIComponent(key)}/transitions`, { query: { expand: "transitions.fields" } }).then(x => (this.markCap('transitions', true), x));
    } transitionMetadata(key) {
      return this.transitions(key);
    } assign(key, user) {
      const cloud = this.site.server?.deploymentType === "Cloud";
      const body = cloud ? { accountId: user?.accountId ?? null } : { name: user?.name ?? user?.key ?? null };
      return this.request(`/issue/${encodeURIComponent(key)}/assignee`, { method: "PUT", body });
    } comment(key, text) {
      return this.request(`/issue/${encodeURIComponent(key)}/comment`, { method: "POST", body: { body: text } });
    } transition(key, id, fields = {}) {
      const body = { transition: { id: String(id) } };
      if (Object.keys(fields || {}).length) body.fields = fields;
      return this.request(`/issue/${encodeURIComponent(key)}/transitions`, { method: "POST", body });
    } editIssue(key, fields, update = null) {
      const body = {};
      if (fields && Object.keys(fields).length) body.fields = fields;
      if (update && Object.keys(update).length) body.update = update;
      return this.request(`/issue/${encodeURIComponent(key)}`, { method: "PUT", body });
    }
    async assignableUsers(projectKeys, { maxUsers = API.MAX_USERS } = {}) {
      const keys = [...(projectKeys || [])].filter(Boolean), all = [];
      if (!keys.length) return [];
      try {
        all.push(...await this.arrayPages("/user/assignable/multiProjectSearch", { query: { projectKeys: keys.join(","), username: "" }, max: maxUsers }));
        this.markCap('assignableUsers', true);
      } catch {
        for (const key of keys) {
          if (all.length >= maxUsers) break;
          try {
            all.push(...await this.arrayPages("/user/assignable/search", { query: { project: key, username: "" }, max: Math.min(2000, maxUsers - all.length) }));
            this.markCap('assignableUsers', true);
          } catch {}
        }
      }
      return uniqueBy(all, u => u.accountId || u.key || u.name).slice(0, maxUsers);
    }
  }
  root.JiraApi = Object.freeze({ JiraClient, JiraApiError, isPrivateHost });
})();
