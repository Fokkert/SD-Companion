(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {};
  const { normalizeBaseUrl, siteIdFromBaseUrl, nowIso, uniqueBy } = root.Utils;
  const normalizeUser = (u, source = 'api', projectKey = '') => u ? ({
    key: u.key || u.name || u.accountId || u.actorUser?.key || u.actorUser?.name || '',
    name: u.name || u.key || u.accountId || u.actorUser?.name || u.actorUser?.key || '',
    accountId: u.accountId || u.actorUser?.accountId || '',
    displayName: u.displayName || u.actorUser?.displayName || u.name || u.key || 'Unknown',
    emailAddress: u.emailAddress || u.actorUser?.emailAddress || '',
    active: u.active !== false,
    avatarUrl: u.avatarUrls?.['48x48'] || u.avatarUrls?.['32x32'] || u.actorUser?.avatarUrl || '',
    source,
    projectKeys: projectKey ? [projectKey] : []
  }) : null;
  const normalizeFilter = f => ({
    id: String(f.id || ''),
    name: f.name || `Filter ${f.id}`,
    jql: f.jql || '',
    description: f.description || '',
    favourite: Boolean(f.favourite),
    owner: normalizeUser(f.owner, 'filter-owner'),
    viewUrl: f.viewUrl || '',
    searchUrl: f.searchUrl || ''
  });
  const normalizeProject = p => ({
    id: String(p.id || ''),
    key: p.key || '',
    name: p.name || p.key || '',
    description: p.description || '',
    projectTypeKey: p.projectTypeKey || '',
    lead: normalizeUser(p.lead, 'project-lead', p.key || ''),
    avatarUrl: p.avatarUrls?.['48x48'] || p.avatarUrls?.['32x32'] || '',
    url: p.url || ''
  });
  const normalizeIssueType = (x, projectKey = '') => ({ id: String(x.id || ''), name: x.name || '', description: x.description || '', subtask: Boolean(x.subtask), projectKey, iconUrl: x.iconUrl || '' });
  const normalizeAllowedValue = v => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "object") return { value: String(v), name: String(v) };
    const out = {};
    for (const k of ['id', 'key', 'value', 'name', 'displayName', 'accountId']) if (v[k] !== undefined && v[k] !== null) out[k] = String(v[k]);
    if (Array.isArray(v.children)) out.children = v.children.map(normalizeAllowedValue).filter(Boolean);
    return Object.keys(out).length ? out : null;
  };
  const normalizeField = x => ({
    id: String(x.fieldId || x.id || x.key || ''),
    key: String(x.key || x.fieldId || x.id || ''),
    name: x.name || x.fieldName || x.fieldId || x.id || '',
    custom: Boolean(x.custom || x.schema?.custom),
    orderable: x.orderable !== false,
    navigable: x.navigable !== false,
    searchable: x.searchable !== false,
    schema: x.schema || {},
    clauseNames: Array.isArray(x.clauseNames) ? x.clauseNames : [],
    allowedValues: (Array.isArray(x.allowedValues) ? x.allowedValues : Array.isArray(x.values) ? x.values : []).map(normalizeAllowedValue).filter(Boolean)
  });
  const normalizeIssue = (i, filterId = '') => ({
    id: String(i.id || ''),
    key: i.key || '',
    filterId: String(filterId || ''),
    fields: i.fields && typeof i.fields === 'object' ? i.fields : {},
    summary: i.fields?.summary || '',
    description: typeof i.fields?.description === 'string' ? i.fields.description : '',
    issueType: i.fields?.issuetype?.name || '',
    issueTypeId: String(i.fields?.issuetype?.id || ''),
    status: i.fields?.status?.name || '',
    statusId: String(i.fields?.status?.id || ''),
    projectKey: i.fields?.project?.key || '',
    projectId: String(i.fields?.project?.id || ''),
    projectName: i.fields?.project?.name || '',
    assignee: normalizeUser(i.fields?.assignee, 'issue'),
    reporter: normalizeUser(i.fields?.reporter, 'issue'),
    creator: normalizeUser(i.fields?.creator, 'issue'),
    priority: i.fields?.priority?.name || '',
    priorityId: String(i.fields?.priority?.id || ''),
    resolution: i.fields?.resolution?.name || '',
    resolutionId: String(i.fields?.resolution?.id || ''),
    created: i.fields?.created || '',
    updated: i.fields?.updated || '',
    dueDate: i.fields?.duedate || '',
    labels: i.fields?.labels || [],
    components: (i.fields?.components || []).map(x => ({ id: String(x.id || ''), name: x.name || '' })),
    url: i.self || ''
  });
  const projectCfg = (settings, key) => ({ ...root.Defaults.projectDatasets(false), ...(settings?.projectDatasets?.[key] || {}) });
  const selectedFromDatasets = settings => root.Utils.discoveryProjectKeys(settings);
  const stableDatasets = settings => Object.fromEntries(Object.entries(settings?.projectDatasets || {}).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, projectCfg(settings, k)]));
  const scopeHash = (input, datasets = null) => {
    if (Array.isArray(input)) return `${[...input].sort().join('|')}::${datasets ? JSON.stringify(datasets) : ''}`;
    const s = input || {};
    return JSON.stringify({ projects: [...selectedFromDatasets(s)].sort(), datasets: stableDatasets(s), global: { priorities: s.globalDatasets?.priorities !== false, resolutions: s.globalDatasets?.resolutions !== false } });
  };
  const freshness = (at, count, scope = 'global') => ({ at, count, scope });
  const mergeStats = (old = {}, client) => {
    const n = client.statsSnapshot();
    const prevReq = Number(old.requests) || 0,
      newReq = Number(n.requests) || 0,
      total = prevReq + newReq,
      avg = total ? Math.round(((Number(old.avgLatencyMs) || 0) * prevReq + (Number(n.avgLatencyMs) || 0) * newReq) / total) : 0;
    return {
      requests: total,
      failures: (old.failures || 0) + (n.failures || 0),
      retries: (old.retries || 0) + (n.retries || 0),
      rateLimited: (old.rateLimited || 0) + (n.rateLimited || 0),
      avgLatencyMs: avg,
      maxLatencyMs: Math.max(old.maxLatencyMs || 0, n.maxLatencyMs || 0),
      lastRequestAt: n.lastRequestAt || old.lastRequestAt || null,
      transport: n.transport || old.transport || ''
    };
  };
  const publishProgress = (siteId, operationId, phase, current, total, detail = '') => {
    try {
      chrome.runtime.sendMessage({ type: 'SD_SYNC_PROGRESS', siteId, operationId, progress: { phase, current, total, detail, at: nowIso() } }).catch(() => {});
    } catch {}
  };
  const warn = async (warnings, siteId, stage, e) => {
    const w = { stage, ...root.Utils.safeError(e) };
    warnings.push(w);
    await root.Storage.appendLog({ level: 'warn', siteId, message: `API sync warning: ${stage}`, details: w });
    await root.Storage.appendAudit?.({ event: 'api-sync-warning', siteId, details: w });
  };
  const mergeUsers = list => {
    const map = new Map();
    for (const raw of list.filter(Boolean)) {
      const key = raw.accountId || raw.key || raw.name;
      if (!key) continue;
      const old = map.get(key);
      if (!old) {
        map.set(key, { ...raw, projectKeys: [...new Set(raw.projectKeys || [])] });
        continue;
      }
      old.projectKeys = [...new Set([...(old.projectKeys || []), ...(raw.projectKeys || [])])];
      if (!old.avatarUrl && raw.avatarUrl) old.avatarUrl = raw.avatarUrl;
      if (!old.emailAddress && raw.emailAddress) old.emailAddress = raw.emailAddress;
    }
    return [...map.values()];
  };
  const filterCoverageNote = coverage => coverage === 'owned-and-favourites' ? 'Owned and favourite filters are available from Jira REST.' : coverage === 'favourites-only' ? 'This Jira REST API exposes favourite filters but does not expose an owned-filter listing endpoint. Non-favourite filters shown in Manage Filters cannot be enumerated through the public REST API on this server.' : coverage === 'unavailable' ? 'Jira did not expose a usable filter-list endpoint to this PAT.' : '';
  const upsertSite = async descriptor => {
    const baseUrl = normalizeBaseUrl(descriptor.baseUrl);
    if (!baseUrl) throw new Error('Invalid Jira base URL.');
    const id = siteIdFromBaseUrl(baseUrl);
    let created = false;
    const state = await root.Storage.updateState(state => {
      const duplicate = state.jiraSites.find(s => normalizeBaseUrl(s.baseUrl) === baseUrl);
      if (duplicate) {
        const e = new Error(`This Jira URL is already configured as "${duplicate.name}".`);
        e.code = 'DUPLICATE_SERVER_URL';
        e.siteId = duplicate.id;
        throw e;
      }
      const site = root.Defaults.site({ ...descriptor, id, baseUrl });
      state.jiraSites.push(site);
      created = true;
      let p = state.profiles.find(x => !x.siteId);
      if (p) {
        p.siteId = id;
        p.name = 'Default Profile';
        p.updatedAt = nowIso();
      }
      else {
        p = root.Defaults.profile('Default Profile', site);
        state.profiles.push(p);
      }
      site.activeProfileId = p.id;
      state.activeSiteId = id;
      state.activeProfileId = p.id;
    }, { configWrite: true });
    return { site: state.jiraSites.find(s => s.id === id), created };
  };
  const connectClient = async (siteId, operationId = '') => {
    root.Operations?.throwIfCancelled(operationId);
    const snapshot = await root.Storage.ensureState(),
      sourceSite = snapshot.jiraSites.find(s => s.id === siteId);
    if (!sourceSite) throw new Error('Jira server not found.');
    const token = await root.Storage.getCredential(siteId);
    if (!token) throw new Error('PAT is missing.');
    const site = structuredClone(sourceSite),
      client = new root.JiraApi.JiraClient(site, token, { operationId });
    publishProgress(siteId, operationId, 'starting', 0, 1, 'Validating PAT');
    try {
      const me = await client.myself();
      client.markCap('restApi2', true);
      site.auth.user = normalizeUser(me, 'myself');
      site.auth.configured = true;
      site.auth.lastValidatedAt = nowIso();
      return { site, client, me, sourceRevision: snapshot.configRevision };
    } catch (e) {
      if (e.code === 'OPERATION_CANCELLED') throw e;
      await root.Storage.updateState(state => {
        const s = state.jiraSites.find(x => x.id === siteId);
        if (s) {
          s.runtime.connectionStatus = e.status === 401 || e.status === 403 ? 'authentication-failed' : e.code === 'NETWORK_REQUEST_FAILED' ? 'network-request-failed' : 'degraded';
          s.runtime.apiHealthy = e.status === 401 || e.status === 403 || e.code === 'NETWORK_REQUEST_FAILED' ? false : s.runtime.apiHealthy;
          s.runtime.lastError = e.message;
          s.runtime.lastErrorCode = e.code || '';
        }
      });
      throw e;
    }
  };
  const discoverProjects = async (siteId, { operationId = '' } = {}) => {
    const { site, client, me } = await connectClient(siteId, operationId), warnings = [];
    root.Operations?.throwIfCancelled(operationId);
    const fetchStage = async (name, fn, fallback = []) => {
      publishProgress(siteId, operationId, 'project-discovery', 0, 1, name);
      try {
        return await fn();
      } catch (e) {
        if (e.code === 'OPERATION_CANCELLED') throw e;
        await warn(warnings, siteId, name, e);
        return fallback;
      }
    };
    const projects = (await fetchStage('Projects', () => client.projects())).map(normalizeProject),
      filters = (await fetchStage('Saved filters', () => client.filters(me))).map(normalizeFilter),
      permissions = await fetchStage('Permissions', () => client.myPermissions(), {});
    root.Operations?.throwIfCancelled(operationId);
    const browser = await root.JiraTabs.browserStatus(site),
      syncedAt = nowIso(),
      allowed = new Set(projects.map(p => p.key)),
      map = {};
    for (const [key, cfg] of Object.entries(site.inventorySettings?.projectDatasets || {})) if (allowed.has(key)) map[key] = projectCfg(site.inventorySettings, key);
    for (const key of site.inventorySettings?.selectedProjectKeys || []) if (allowed.has(key) && !map[key]) map[key] = root.Defaults.projectDatasets(true);
    const selected = selectedFromDatasets({ projectDatasets: map }),
      coverage = client.filterCoverage || 'unknown',
      fresh = {
        ...(site.inventory?.freshness || {}),
        projects: freshness(syncedAt, projects.length, 'global'),
        filters: freshness(syncedAt, filters.length, 'global'),
        permissions: freshness(syncedAt, Object.keys(permissions?.permissions || permissions || {}).length, 'global')
      };
    const state = await root.Storage.updateState(latest => {
      const current = latest.jiraSites.find(s => s.id === siteId);
      if (!current) throw new Error('Jira server was removed during discovery.');
      current.projects = projects;
      current.filters = filters;
      current.inventorySettings.projectDatasets = map;
      current.inventorySettings.selectedProjectKeys = selected;
      current.auth = { ...current.auth, user: site.auth.user, configured: true, lastValidatedAt: site.auth.lastValidatedAt };
      current.permissions = permissions?.permissions || permissions || {};
      current.capabilities = { ...current.capabilities, ...client.capabilities };
      current.inventory = {
        ...current.inventory,
        lastProjectSyncAt: syncedAt,
        filterCoverage: coverage,
        filterCoverageNote: filterCoverageNote(coverage),
        filterCoverageDetails: client.filterCoverageDetails || {},
        warnings,
        snapshotId: crypto.randomUUID(),
        freshness: fresh,
        counts: { ...(current.inventory?.counts || {}), projects: projects.length, filters: filters.length, selectedProjects: selected.length }
      };
      current.runtime = {
        ...current.runtime,
        ...browser,
        connectionStatus: 'connected',
        healthState: 'healthy',
        lastSyncAt: syncedAt,
        lastError: '',
        lastErrorCode: '',
        apiHealthy: true,
        lastTransport: client.lastTransport,
        apiStats: mergeStats(current.runtime?.apiStats, client),
        consecutiveHealthFailures: 0,
        connectionLossStartedAt: null,
        connectionLossFailures: 0,
        connectionLossAlarmFiredAt: null
      };
    });
    await root.Storage.appendAudit({
      event: 'inventory-projects-committed',
      siteId,
      details: { projects: projects.length, filters: filters.length, filterCoverage: coverage, selectedProjects: selected.length, warnings: warnings.length }
    });
    try {
      chrome.runtime.sendMessage({ type: 'SD_SYNC_DONE', siteId, operationId, counts: { projects: projects.length, filters: filters.length, selectedProjects: selected.length }, warnings: warnings.length }).catch(() => {});
    } catch {}
    return state.jiraSites.find(s => s.id === siteId);
  };
  const syncProjectMetadata = async (client, site, siteId, projects, warnings, operationId) => {
    const details = [],
      storedMatrix = [],
      transitionMatrix = [],
      issueTypes = [],
      statuses = [],
      users = [];
    let n = 0;
    for (const p of projects) {
      root.Operations?.throwIfCancelled(operationId);
      n++;
      const cfg = projectCfg(site.inventorySettings, p.key);
      publishProgress(siteId, operationId, 'projects', n, projects.length, `${p.key} · ${p.name}`);
      const full = p;
      details.push(full);
      let matrix = [];
      if (cfg.issueTypes || cfg.statuses || cfg.transitions) {
        try {
          for (const it of await client.projectStatuses(p.key) || []) {
            const nt = normalizeIssueType(it, p.key);
            for (const st of it.statuses || []) matrix.push({
              projectId: p.id,
              projectKey: p.key,
              projectName: p.name,
              issueTypeId: nt.id,
              issueTypeName: nt.name,
              issueTypeIcon: nt.iconUrl,
              statusId: String(st.id || ''),
              statusName: st.name || '',
              statusCategory: st.statusCategory?.name || st.statusCategory?.key || ''
            });
          }
          matrix = uniqueBy(matrix, r => `${r.projectKey}:${r.issueTypeId}:${r.statusId}`);
          if (cfg.issueTypes) issueTypes.push(...uniqueBy(matrix.map(r => ({ id: r.issueTypeId, name: r.issueTypeName, projectKey: r.projectKey, iconUrl: r.issueTypeIcon || '' })), x => `${x.projectKey}:${x.id}`));
          if (cfg.statuses) statuses.push(...uniqueBy(matrix.map(r => ({ id: r.statusId, name: r.statusName, statusCategory: r.statusCategory, projectKey: r.projectKey, issueTypeId: r.issueTypeId, issueTypeName: r.issueTypeName })), x => `${x.projectKey}:${x.issueTypeId}:${x.id}`));
          if (cfg.issueTypes || cfg.statuses || cfg.transitions) storedMatrix.push(...matrix);
          if (cfg.transitions) transitionMatrix.push(...matrix);
        } catch (e) {
          if (e.code === 'OPERATION_CANCELLED') throw e;
          await warn(warnings, siteId, `statuses:${p.key}`, e);
        }
      }
      if (cfg.users) {
        try {
          const rows = await client.assignableUsers([p.key], { maxUsers: site.inventorySettings.maxUsers });
          users.push(...rows.map(x => normalizeUser(x, 'assignable', p.key)));
          if (full.lead) users.push({ ...full.lead, projectKeys: [...new Set([...(full.lead.projectKeys || []), p.key])] });
        } catch (e) {
          if (e.code === 'OPERATION_CANCELLED') throw e;
          await warn(warnings, siteId, `users:${p.key}`, e);
        }
      }
    }
    return {
      projects: details,
      matrix: uniqueBy(storedMatrix, r => `${r.projectKey}:${r.issueTypeId}:${r.statusId}`),
      transitionMatrix: uniqueBy(transitionMatrix, r => `${r.projectKey}:${r.issueTypeId}:${r.statusId}`),
      issueTypes,
      statuses,
      users
    };
  };
  const workflowActionId = t => {
    const direct = t?.actionId;
    if (direct !== undefined && direct !== null && String(direct) !== '') return String(direct);
    const m = String(t?.id || '').match(/^(?:I?A)<(\d+):/);
    return m ? m[1] : '';
  };
  const workflowTransitionContexts = (workflow, group, representative = {}) => {
    const layout = workflow?.layout || {},
      statuses = (layout.statuses || []).filter(x => !x?.initial && x?.statusId),
      byLayoutId = new Map(statuses.map(x => [String(x.id), x])),
      matrixByStatus = new Map((group.rows || []).map(x => [String(x.statusId), x])),
      contexts = new Map(),
      workflowName = representative.workflowName || '';
    const contextFor = status => {
      const statusId = String(status.statusId || ''), existing = contexts.get(statusId);
      if (existing) return existing;
      const matrix = matrixByStatus.get(statusId) || group.rows?.[0] || {},
        ctx = {
          id: `${group.projectKey}:${group.issueTypeId}:${statusId}`,
          projectId: String(matrix.projectId || group.projectId || ''),
          projectKey: group.projectKey,
          projectName: matrix.projectName || group.projectName || group.projectKey,
          issueTypeId: String(group.issueTypeId || ''),
          issueTypeName: group.issueTypeName || matrix.issueTypeName || '',
          statusId,
          statusName: status.name || matrix.statusName || statusId,
          statusCategory: status.statusCategory?.name || status.statusCategory?.key || status.statusCategory?.colourName || matrix.statusCategory || '',
          workflowName,
          workflowSource: 'workflow-designer',
          workflowUpdatedDate: workflow?.layout?.updatedDate || null,
          workflowUpdateAuthor: workflow?.layout?.updateAuthor || null,
          workflowPermissions: workflow?.workflowPermissions || {},
          representativeIssueKey: representative.issueKey || '',
          browserUser: representative.browserUser || '',
          stale: false,
          syncError: '',
          transitions: []
        };
      contexts.set(statusId, ctx);
      return ctx;
    };
    for (const status of statuses) contextFor(status);
    for (const t of layout.transitions || []) {
      if (t?.initial) continue;
      const transitionId = workflowActionId(t), target = byLayoutId.get(String(t?.targetId || ''));
      if (!transitionId || !target) continue;
      const sources = t?.globalTransition ? statuses : [byLayoutId.get(String(t?.sourceId || ''))].filter(Boolean);
      for (const source of sources) {
        const ctx = contextFor(source),
          key = `${transitionId}|${String(target.statusId || '')}|${String(t.name || '')}`;
        if (ctx.transitions.some(x => x.contextTransitionKey === key)) continue;
        ctx.transitions.push({
          id: transitionId,
          name: t.name || `Transition ${transitionId}`,
          toStatusId: String(target.statusId || ''),
          toStatusName: target.name || '',
          toStatusCategory: target.statusCategory?.name || target.statusCategory?.key || target.statusCategory?.colourName || '',
          isAvailable: true,
          isConditional: null,
          requiredFields: [],
          observedOn: [],
          workflowDefined: true,
          workflowName,
          contextTransitionKey: key,
          description: t.description || '',
          screenName: t.screenName || '',
          globalTransition: Boolean(t.globalTransition),
          loopedTransition: Boolean(t.loopedTransition),
          transitionOptions: Array.isArray(t.transitionOptions) ? t.transitionOptions : []
        });
      }
    }
    return [...contexts.values()];
  };
  const transitionProbeFeatures = issue => {
    const userKey = u => String(u?.accountId || u?.key || u?.name || '').trim(), tokens = new Set();
    tokens.add(`assignee:${userKey(issue.assignee) || 'none'}`);
    tokens.add(`reporter:${userKey(issue.reporter) || 'none'}`);
    tokens.add(`creator:${userKey(issue.creator) || 'none'}`);
    tokens.add(`priority:${issue.priorityId || issue.priority || 'none'}`);
    tokens.add(`resolution:${issue.resolutionId || issue.resolution || 'none'}`);
    for (const x of issue.components || []) tokens.add(`component:${x.id || x.name}`);
    for (const x of issue.labels || []) tokens.add(`label:${x}`);
    return tokens;
  };
  const transitionProbeDistance = (a, b) => {
    let n = 0;
    for (const x of a) if (!b.has(x)) n++;
    for (const x of b) if (!a.has(x)) n++;
    return n;
  };
  const selectTransitionProbeIssues = (issues, max = 8) => {
    const list = uniqueBy((issues || []).filter(x => x?.key), x => x.key);
    if (list.length <= max) return list;
    const features = new Map(list.map(x => [x.key, transitionProbeFeatures(x)])),
      selected = [],
      used = new Set(),
      add = x => {
        if (x && !used.has(x.key)) {
          used.add(x.key);
          selected.push(x);
        }
      };
    add(list[0]);
    add(list.at(-1));
    while (selected.length < max) {
      let best = null, bestScore = -1;
      for (const issue of list) {
        if (used.has(issue.key)) continue;
        const f = features.get(issue.key),
          score = Math.min(...selected.map(x => transitionProbeDistance(f, features.get(x.key))));
        if (score > bestScore) {
          best = issue;
          bestScore = score;
        }
      }
      if (!best) break;
      add(best);
    }
    return selected;
  };
  const transitionProbeBudget = total => {
    const n = Math.max(0, Number(total) || 0);
    if (n < 30) return n;
    if (n < 60) return Math.min(48, Math.ceil(n * 5 / 7));
    if (n < 100) return Math.min(48, Math.ceil(n * 4 / 7));
    if (n < 250) return Math.min(48, Math.ceil(n * 3 / 7));
    if (n < 1000) return 42;
    return 36;
  };
  const allocateTransitionProbeBudget = (contexts, budget) => {
    const active = (contexts || []).filter(x => Number(x.issueCount) > 0),
      out = new Map(active.map(x => [x.id, 0]));
    let remaining = Math.min(Math.max(0, Number(budget) || 0), active.reduce((n, x) => n + Number(x.issueCount || 0), 0));
    if (!remaining) return out;
    const seed = remaining >= active.length * 2 ? 2 : 1;
    for (const x of active) {
      const give = Math.min(seed, Number(x.issueCount) || 0, remaining);
      out.set(x.id, give);
      remaining -= give;
      if (!remaining) break;
    }
    while (remaining > 0) {
      let best = null, bestScore = -1;
      for (const x of active) {
        const current = out.get(x.id) || 0, capacity = (Number(x.issueCount) || 0) - current;
        if (capacity <= 0) continue;
        const score = Math.sqrt(Number(x.issueCount) || 1) / (current + 1);
        if (score > bestScore) {
          best = x;
          bestScore = score;
        }
      }
      if (!best) break;
      out.set(best.id, (out.get(best.id) || 0) + 1);
      remaining--;
    }
    return out;
  };
  const transitionSampleWindows = (total, take) => {
    const n = Math.max(0, Number(total) || 0), k = Math.min(n, Math.max(0, Number(take) || 0));
    if (!n || !k) return [];
    if (k >= n) return [{ startAt: 0, maxResults: n }];
    const windowCount = Math.min(5, k),
      base = Math.floor(k / windowCount),
      extra = k % windowCount,
      sizes = Array.from({ length: windowCount }, (_, i) => base + (i < extra ? 1 : 0)),
      windows = [];
    for (let i = 0; i < windowCount; i++) {
      const size = sizes[i],
        center = windowCount === 1 ? Math.floor((n - 1) / 2) : Math.round(i * (n - 1) / (windowCount - 1));
      let startAt = Math.max(0, Math.min(n - size, center - Math.floor(size / 2)));
      if (windows.length) {
        const prev = windows.at(-1), minStart = prev.startAt + prev.maxResults;
        if (startAt < minStart) startAt = Math.min(n - size, minStart);
      }
      windows.push({ startAt, maxResults: size });
    }
    for (let i = windows.length - 2; i >= 0; i--) {
      const next = windows[i + 1], w = windows[i];
      if (w.startAt + w.maxResults > next.startAt) w.startAt = Math.max(0, next.startAt - w.maxResults);
    }
    return windows;
  };
  const transitionContextCandidates = async (client, baseJql, issueCount, take, fields) => {
    const n = Math.max(0, Number(issueCount) || 0), k = Math.min(n, Math.max(0, Number(take) || 0));
    if (!k) return [];
    if (k >= n) return (await client.search(`${baseJql} ORDER BY updated ASC`, { maxIssues: n, fields })).map(normalizeIssue);
    const rows = [];
    for (const window of transitionSampleWindows(n, k)) {
      const page = await client.searchPage(`${baseJql} ORDER BY updated ASC`, { startAt: window.startAt, maxResults: window.maxResults, fields });
      rows.push(...(page.issues || []).map(normalizeIssue));
    }
    const unique = uniqueBy(rows.filter(x => x?.key), x => x.key);
    return unique.length <= k ? unique : selectTransitionProbeIssues(unique, k);
  };
  const buildIssueExtractionCatalog = async (client, site, siteId, matrix, warnings, operationId) => {
    const fields = ['issuetype', 'status', 'project', 'summary', 'assignee', 'reporter', 'creator', 'priority', 'resolution', 'labels', 'components', 'created', 'updated'],
      catalog = [],
      contexts = uniqueBy(matrix || [], row => `${row.projectKey}:${row.issueTypeId}:${row.statusId}`),
      groups = new Map();
    for (const row of contexts) {
      const groupKey = `${row.projectKey}:${row.issueTypeId}`,
        id = `${groupKey}:${row.statusId}`,
        baseJql = `project = "${String(row.projectKey).replace(/"/g, '\\"')}" AND issuetype = ${row.issueTypeId} AND status = ${row.statusId}`,
        entry = { ...row, id, groupKey, baseJql, issueCount: 0 };
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(entry);
    }
    let groupIndex = 0;
    for (const [groupKey, rows] of groups) {
      root.Operations?.throwIfCancelled(operationId);
      groupIndex++;
      for (const row of rows) {
        root.Operations?.throwIfCancelled(operationId);
        try {
          row.issueCount = await client.searchCount(row.baseJql);
        } catch (e) {
          if (e.code === 'OPERATION_CANCELLED') throw e;
          await warn(warnings, siteId, `transition-count:${row.id}`, e);
          row.issueCount = 0;
        }
      }
      const totalIssues = rows.reduce((n, x) => n + Number(x.issueCount || 0), 0),
        probeBudget = transitionProbeBudget(totalIssues),
        allocations = allocateTransitionProbeBudget(rows, probeBudget),
        issueTypeName = rows[0]?.issueTypeName || rows[0]?.issueTypeId || 'Issue type';
      publishProgress(siteId, operationId, 'transitions', groupIndex, groups.size, `${rows[0]?.projectKey || ''} · ${issueTypeName} · Issue extraction · ${probeBudget} probes`);
      for (const row of rows) {
        root.Operations?.throwIfCancelled(operationId);
        const allocated = allocations.get(row.id) || 0,
          rec = {
            id: row.id,
            projectId: String(row.projectId || ''),
            projectKey: row.projectKey,
            projectName: row.projectName,
            issueTypeId: row.issueTypeId,
            issueTypeName: row.issueTypeName,
            statusId: row.statusId,
            statusName: row.statusName,
            statusCategory: row.statusCategory || '',
            workflowName: '',
            workflowSource: 'issue-extraction',
            stale: false,
            syncError: '',
            issueTypeIssueCount: totalIssues,
            statusIssueCount: Number(row.issueCount) || 0,
            candidateIssueCount: Number(row.issueCount) || 0,
            sampleIssueKeys: [],
            issuesScanned: 0,
            probeLimit: allocated,
            probeBudget,
            probeMode: totalIssues < 30 ? 'all-issues' : 'stratified-slices',
            transitions: [],
            error: ''
          },
          seen = new Map();
        if (!row.issueCount) {
          rec.error = 'No visible issue currently exists in this project / issue type / status context.';
          catalog.push(rec);
          continue;
        }
        let candidates = [];
        try {
          candidates = await transitionContextCandidates(client, row.baseJql, row.issueCount, allocated, fields);
        } catch (e) {
          if (e.code === 'OPERATION_CANCELLED') throw e;
          await warn(warnings, siteId, `transition-sample:${row.id}`, e);
          rec.error = e.message || 'Could not sample issues for this context.';
          rec.syncError = rec.error;
          rec.stale = true;
          catalog.push(rec);
          continue;
        }
        for (const issue of candidates) {
          root.Operations?.throwIfCancelled(operationId);
          if (!issue?.key) continue;
          rec.sampleIssueKeys.push(issue.key);
          rec.issuesScanned++;
          try {
            const d = await client.transitions(issue.key);
            for (const t of d?.transitions || []) {
              const tk = `${t.id || ''}:${t.to?.id || ''}:${t.name || ''}`, existing = seen.get(tk);
              if (existing) {
                existing.observedOn = [...new Set([...(existing.observedOn || []), issue.key])];
                existing.isAvailable = existing.isAvailable || t.isAvailable !== false;
                continue;
              }
              seen.set(tk, {
                id: String(t.id || ''),
                name: t.name || '',
                toStatusId: String(t.to?.id || ''),
                toStatusName: t.to?.name || '',
                toStatusCategory: t.to?.statusCategory?.name || '',
                isAvailable: t.isAvailable !== false,
                isConditional: Boolean(t.isConditional),
                requiredFields: Object.entries(t.fields || {}).filter(([, v]) => v?.required).map(([id, v]) => ({ id, name: v.name || id, type: v.schema?.type || '', required: true })),
                observedOn: [issue.key],
                workflowDefined: false
              });
            }
          } catch (e) {
            if (e.code === 'OPERATION_CANCELLED') throw e;
            await warn(warnings, siteId, `transitions:${issue.key}`, e);
          }
        }
        rec.transitions = [...seen.values()];
        catalog.push(rec);
      }
    }
    return catalog;
  };
  const buildWorkflowDesignerCatalog = async (client, site, siteId, matrix, warnings, operationId) => {
    // Jira's read-only Workflow Designer exposes the complete live workflow graph to users who have View Workflow.
    // Discovery resolves one accessible issue per project + issue type only to obtain the workflow name from Jira's
    // server-rendered View Workflow link. The graph itself is then fetched once per unique workflow name with the PAT.
    const rows = uniqueBy(matrix || [], x => `${x.projectKey}:${x.issueTypeId}:${x.statusId}`),
      groups = new Map(),
      previous = new Map();
    for (const row of rows) {
      const key = `${row.projectKey}:${row.issueTypeId}`;
      if (!groups.has(key)) groups.set(key, {
        key,
        projectId: String(row.projectId || ''),
        projectKey: row.projectKey,
        projectName: row.projectName || row.projectKey,
        issueTypeId: String(row.issueTypeId || ''),
        issueTypeName: row.issueTypeName || '',
        rows: []
      });
      groups.get(key).rows.push(row);
    }
    for (const ctx of site.transitionCatalog || []) {
      const key = `${ctx.projectKey}:${ctx.issueTypeId}`;
      if (!previous.has(key)) previous.set(key, []);
      previous.get(key).push(ctx);
    }
    const workflowCache = new Map(), catalog = [];
    const keepPrevious = (group, error) => {
      const old = previous.get(group.key) || [];
      if (old.length) {
        for (const ctx of old) catalog.push({ ...structuredClone(ctx), stale: true, syncError: error?.message || String(error || 'Workflow discovery failed.'), workflowSource: ctx.workflowSource || 'cached-previous' });
        return;
      }
      for (const row of group.rows) catalog.push({
        id: `${group.projectKey}:${group.issueTypeId}:${row.statusId}`,
        projectId: String(row.projectId || group.projectId || ''),
        projectKey: group.projectKey,
        projectName: row.projectName || group.projectName,
        issueTypeId: group.issueTypeId,
        issueTypeName: group.issueTypeName || row.issueTypeName || '',
        statusId: String(row.statusId || ''),
        statusName: row.statusName || '',
        statusCategory: row.statusCategory || '',
        workflowName: '',
        workflowSource: 'unavailable',
        representativeIssueKey: '',
        stale: true,
        syncError: error?.message || String(error || 'Workflow discovery failed.'),
        transitions: []
      });
    };
    let index = 0;
    for (const group of groups.values()) {
      root.Operations?.throwIfCancelled(operationId);
      index++;
      publishProgress(siteId, operationId, 'transitions', index, groups.size, `${group.projectKey} · ${group.issueTypeName || group.issueTypeId} · Workflow Designer`);
      const project = String(group.projectKey || '').replace(/"/g, '\\"'),
        jql = `project = "${project}" AND issuetype = ${group.issueTypeId} ORDER BY updated DESC`;
      let issues = [];
      try {
        const page = await client.searchPage(jql, { startAt: 0, maxResults: 3, fields: ['issuetype', 'status', 'project', 'updated'] });
        issues = page?.issues || [];
      } catch (e) {
        if (e.code === 'OPERATION_CANCELLED') throw e;
        await warn(warnings, siteId, `workflow-representative:${group.key}`, e);
        keepPrevious(group, e);
        continue;
      }
      if (!issues.length) {
        const e = Object.assign(new Error(`No accessible issue exists for ${group.projectKey} / ${group.issueTypeName || group.issueTypeId}, so Jira cannot expose its read-only workflow name.`), { code: 'WORKFLOW_REPRESENTATIVE_MISSING' });
        await warn(warnings, siteId, `workflow-representative:${group.key}`, e);
        keepPrevious(group, e);
        continue;
      }
      let ref = null, lastRefError = null;
      for (const issue of issues) {
        root.Operations?.throwIfCancelled(operationId);
        try {
          ref = await client.workflowNameFromIssuePage(issue.key);
          if (ref?.workflowName) break;
        } catch (e) {
          if (e.code === 'OPERATION_CANCELLED') throw e;
          lastRefError = e;
        }
      }
      if (!ref?.workflowName) {
        const e = lastRefError || Object.assign(new Error(`Jira did not expose a workflow name for ${group.projectKey} / ${group.issueTypeName || group.issueTypeId}.`), { code: 'WORKFLOW_NAME_UNAVAILABLE' });
        await warn(warnings, siteId, `workflow-name:${group.key}`, e);
        keepPrevious(group, e);
        continue;
      }
      let workflow;
      try {
        if (!workflowCache.has(ref.workflowName)) workflowCache.set(ref.workflowName, client.workflowDesigner(ref.workflowName));
        workflow = await workflowCache.get(ref.workflowName);
      } catch (e) {
        if (e.code === 'OPERATION_CANCELLED') throw e;
        await warn(warnings, siteId, `workflow-designer:${ref.workflowName}`, e);
        keepPrevious(group, e);
        continue;
      }
      try {
        const contexts = workflowTransitionContexts(workflow, group, ref);
        if (!contexts.length) throw Object.assign(new Error(`Workflow '${ref.workflowName}' did not contain any normal Jira statuses.`), { code: 'WORKFLOW_GRAPH_EMPTY' });
        catalog.push(...contexts);
      } catch (e) {
        await warn(warnings, siteId, `workflow-map:${group.key}`, e);
        keepPrevious(group, e);
      }
    }
    return catalog;
  };
  const buildTransitionCatalog = async (client, site, siteId, matrix, warnings, operationId) => {
    if (!site.inventorySettings.buildTransitionCatalog) return [];
    const method = site.inventorySettings?.transitionMethod || root.Constants.TRANSITION_METHOD.WORKFLOW_DESIGNER;
    if (method === root.Constants.TRANSITION_METHOD.ISSUE_EXTRACTION) return buildIssueExtractionCatalog(client, site, siteId, matrix, warnings, operationId);
    if (method === root.Constants.TRANSITION_METHOD.TARGET_STATUS_RANDOM || method === root.Constants.TRANSITION_METHOD.MANUAL_NAME) return structuredClone(site.transitionCatalog || []);
    return buildWorkflowDesignerCatalog(client, site, siteId, matrix, warnings, operationId);
  };
  const contextualTransitionCount = catalog => (catalog || []).reduce((n, ctx) => n + (Array.isArray(ctx?.transitions) ? ctx.transitions.length : 0), 0);
  const refreshBrowserStatus = async (siteId = null) => {
    const snapshot = await root.Storage.ensureState(),
      targets = siteId ? snapshot.jiraSites.filter(s => s.id === siteId) : snapshot.jiraSites,
      statuses = [];
    for (const site of targets) statuses.push({ id: site.id, status: await root.JiraTabs.browserStatus(site) });
    const state = await root.Storage.updateState(latest => {
      for (const x of statuses) {
        const s = latest.jiraSites.find(v => v.id === x.id);
        if (s) Object.assign(s.runtime, x.status);
      }
    });
    return siteId ? state.jiraSites.filter(s => s.id === siteId) : state.jiraSites;
  };
  const syncSite = async (siteId, { operationId = '' } = {}) => {
    const { site, client, me } = await connectClient(siteId, operationId),
      warnings = [],
      settings = structuredClone(site.inventorySettings || root.Defaults.inventorySettings()),
      scopeRevision = Number(settings.scopeRevision) || 0,
      scope = scopeHash(settings),
      selectedAtStart = selectedFromDatasets(settings);
    if (!selectedAtStart.length) throw Object.assign(new Error('Choose at least one dataset for at least one project before deep synchronization.'), { code: 'NO_PROJECT_DATA_SELECTED' });
    const fetchStage = async (name, fn, fallback = []) => {
      publishProgress(siteId, operationId, 'metadata', 0, 1, name);
      try {
        return await fn();
      } catch (e) {
        if (e.code === 'OPERATION_CANCELLED') throw e;
        await warn(warnings, siteId, name, e);
        return fallback;
      }
    };
    const allProjects = (await fetchStage('Projects', () => client.projects())).map(normalizeProject),
      filters = (await fetchStage('Filters', () => client.filters(me))).map(normalizeFilter),
      allowed = new Set(allProjects.map(p => p.key)),
      selectedKeys = selectedAtStart.filter(k => allowed.has(k)),
      selectedProjects = allProjects.filter(p => selectedKeys.includes(p.key));
    if (!selectedProjects.length) throw Object.assign(new Error('None of the configured project datasets are currently accessible.'), { code: 'PROJECT_SCOPE_EMPTY' });
    const projectMeta = await syncProjectMetadata(client, site, siteId, selectedProjects, warnings, operationId),
      users = mergeUsers(projectMeta.users),
      fieldsRequested = selectedProjects.some(p => projectCfg(settings, p.key).fields),
      canonicalFields = fieldsRequested ? uniqueBy((await fetchStage('Fields', () => client.fields())).map(normalizeField).filter(x => x.id), x => x.id) : [],
      fields = fieldsRequested ? canonicalFields : [],
      transitionCatalog = await buildTransitionCatalog(client, site, siteId, projectMeta.transitionMatrix, warnings, operationId),
      transitionCount = contextualTransitionCount(transitionCatalog),
      priorities = settings.globalDatasets?.priorities === false ? [] : await fetchStage('Priorities', () => client.priorities()),
      resolutions = settings.globalDatasets?.resolutions === false ? [] : await fetchStage('Resolutions', () => client.resolutions()),
      inventory = {
        projects: allProjects,
        issueTypes: uniqueBy(projectMeta.issueTypes, x => `${x.projectKey}:${x.id}`),
        statuses: uniqueBy(projectMeta.statuses, x => `${x.projectKey}:${x.issueTypeId}:${x.id}`),
        fields,
        priorities,
        resolutions,
        filters,
        users,
        projectStatusMatrix: projectMeta.matrix,
        transitionCatalog
      },
      excluded = settings.excludedData || {},
      keyFor = (item, type, context = null) => {
        if (type === 'projects') return String(item?.key || item?.id || item?.name || '');
        if (type === 'users') return String(root.Utils.userKey(item) || item?.id || item?.displayName || '');
        if (type === 'transitions') return `${String(context?.id || '')}:${String(item?.id || item?.name || '')}`;
        return String(item?.id || item?.key || item?.name || item?.statusName || '');
      },
      omitExcluded = (items, type) => {
        const blocked = new Set((excluded[type] || []).map(String));
        return blocked.size ? (items || []).filter(item => !blocked.has(keyFor(item, type))) : items;
      };
    inventory.projects = omitExcluded(inventory.projects, 'projects');
    inventory.filters = omitExcluded(inventory.filters, 'filters');
    inventory.users = omitExcluded(inventory.users, 'users');
    inventory.issueTypes = omitExcluded(inventory.issueTypes, 'issueTypes');
    inventory.statuses = omitExcluded(inventory.statuses, 'statuses');
    inventory.fields = omitExcluded(inventory.fields, 'fields');
    inventory.priorities = omitExcluded(inventory.priorities, 'priorities');
    inventory.resolutions = omitExcluded(inventory.resolutions, 'resolutions');
    const blockedTransitions = new Set((excluded.transitions || []).map(String));
    if (blockedTransitions.size) inventory.transitionCatalog = inventory.transitionCatalog.map(context => ({
      ...context, transitions: (context.transitions || []).filter(item => !blockedTransitions.has(keyFor(item, 'transitions', context)))
    })).filter(context => (context.transitions || []).length);
    const visibleTransitionCount = contextualTransitionCount(inventory.transitionCatalog),
      counts = {
        projects: inventory.projects.length,
        selectedProjects: selectedProjects.length,
        issueTypes: inventory.issueTypes.length,
        statuses: inventory.statuses.length,
        filters: inventory.filters.length,
        users: inventory.users.length,
        fields: inventory.fields.length,
        priorities: priorities.length,
        resolutions: resolutions.length,
        transitions: visibleTransitionCount,
        transitionContexts: inventory.transitionCatalog.length
      },
      permissions = await fetchStage('Permissions', () => client.myPermissions(), {}),
      browser = await root.JiraTabs.browserStatus(site),
      syncedAt = nowIso();
    root.Operations?.throwIfCancelled(operationId);
    const fresh = {
      projects: freshness(syncedAt, inventory.projects.length, 'global'),
      filters: freshness(syncedAt, inventory.filters.length, 'global'),
      users: freshness(syncedAt, inventory.users.length, scope),
      issueTypes: freshness(syncedAt, inventory.issueTypes.length, scope),
      statuses: freshness(syncedAt, inventory.statuses.length, scope),
      transitions: freshness(syncedAt, visibleTransitionCount, scope),
      fields: freshness(syncedAt, inventory.fields.length, 'global-visible'),
      priorities: freshness(syncedAt, inventory.priorities.length, 'global'),
      resolutions: freshness(syncedAt, inventory.resolutions.length, 'global')
    },
      coverage = client.filterCoverage || site.inventory?.filterCoverage || 'unknown';
    const state = await root.Storage.updateState(latest => {
      const current = latest.jiraSites.find(s => s.id === siteId);
      if (!current) throw new Error('Jira server was removed during synchronization.');
      if (Number(current.inventorySettings?.scopeRevision || 0) !== scopeRevision || scopeHash(current.inventorySettings) !== scope) throw Object.assign(new Error('Discovery selections changed during sync. The previous inventory was kept; start sync again.'), { code: 'SYNC_SCOPE_CHANGED' });
      Object.assign(current, inventory, { components: [], versions: [], projectRoles: [], issues: [] });
      current.auth = { ...current.auth, user: site.auth.user, configured: true, lastValidatedAt: site.auth.lastValidatedAt };
      current.permissions = permissions?.permissions || permissions || {};
      current.capabilities = { ...current.capabilities, ...client.capabilities };
      current.inventory = {
        ...current.inventory,
        lastFullSyncAt: syncedAt,
        lastProjectSyncAt: syncedAt,
        warnings,
        snapshotId: crypto.randomUUID(),
        scopeHash: scope,
        filterCoverage: coverage,
        filterCoverageNote: filterCoverageNote(coverage),
        filterCoverageDetails: client.filterCoverageDetails || {},
        freshness: fresh,
        counts
      };
      current.runtime = {
        ...current.runtime,
        ...browser,
        connectionStatus: 'connected',
        healthState: 'healthy',
        lastSyncAt: syncedAt,
        lastError: '',
        lastErrorCode: '',
        apiHealthy: true,
        lastTransport: client.lastTransport,
        apiStats: mergeStats(current.runtime?.apiStats, client),
        consecutiveHealthFailures: 0,
        connectionLossStartedAt: null,
        connectionLossFailures: 0,
        connectionLossAlarmFiredAt: null
      };
    });
    await root.Storage.appendAudit({
      event: 'inventory-snapshot-committed',
      siteId,
      details: { snapshotId: state.jiraSites.find(x => x.id === siteId)?.inventory?.snapshotId, scope: selectedKeys, datasets: settings.projectDatasets, counts, warnings: warnings.length }
    });
    try {
      chrome.runtime.sendMessage({ type: 'SD_SYNC_DONE', siteId, operationId, counts, warnings: warnings.length }).catch(() => {});
    } catch {}
    return state.jiraSites.find(s => s.id === siteId);
  };
  root.Discovery = Object.freeze({
    normalizeUser,
    normalizeFilter,
    normalizeProject,
    normalizeIssue,
    scopeHash,
    projectCfg,
    upsertSite,
    discoverProjects,
    syncSite,
    refreshBrowserStatus,
    buildTransitionCatalog,
    buildWorkflowDesignerCatalog,
    buildIssueExtractionCatalog,
    workflowTransitionContexts,
    workflowActionId,
    selectTransitionProbeIssues,
    transitionProbeBudget,
    allocateTransitionProbeBudget,
    transitionSampleWindows
  });
})();
