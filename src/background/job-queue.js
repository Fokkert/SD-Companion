(() => {
  const root = globalThis.SDCompanion = globalThis.SDCompanion || {},
    { ACTION, JOB, LEVEL } = root.Constants,
    { nowIso, safeError, template, templateJson, userKey, normalizeText } = root.Utils;
  let processing = false;
  const issueLocks = new Set(),
    shortTimers = new Map(),
    cancelRequests = new Set(),
    cancelRequestTimes = new Map(),
    runningContexts = new Map(),
    alarmName = id => `sd-job-${id}`;
  const qlog = (level, message, job, details = {}) => Promise.resolve(root.Storage.appendLog?.({ level, message, details, siteId: job?.siteId || '', profileId: job?.profileId || '', ruleId: job?.ruleId || '', issueKey: job?.issueKey || '' })).catch(() => {});
  const stale = message => Object.assign(new Error(message), { code: 'ACTION_PRECONDITION_CHANGED' });
  const expectedStatusFor = (jobs, job) => {
    let id = job.dependsOnJobId, guard = 0;
    while (id && guard++ < 50) {
      const dep = jobs.find(x => x.id === id);
      if (!dep) break;
      if (dep.status === JOB.SUCCEEDED && dep.action === ACTION.TRANSITION && (dep.result?.toStatusId || dep.result?.toStatus)) return { id: String(dep.result.toStatusId || ''), name: String(dep.result.toStatus || '') };
      id = dep.dependsOnJobId;
    }
    return { id: String(job.precondition?.statusId || job.expectedStatusId || ''), name: String(job.precondition?.statusName || job.expectedStatusName || '') };
  };
  const expectedPreconditionFor = (jobs, job) => {
    const expected = structuredClone(job.precondition || {});
    let id = job.dependsOnJobId, guard = 0;
    while (id && guard++ < 50) {
      const dep = jobs.find(x => x.id === id);
      if (!dep) break;
      if (dep.status === JOB.SUCCEEDED) {
        if (job.action === ACTION.ASSIGN && dep.action === ACTION.ASSIGN && dep.result && 'assigneeKey' in dep.result) {
          expected.assigneeKey = String(dep.result.assigneeKey || '');
          expected.assigneeName = String(dep.result.assignee || 'Unassigned');
          break;
        }
        if (job.action === ACTION.PRIORITY && dep.action === ACTION.PRIORITY && dep.result?.priorityId) {
          expected.priorityId = String(dep.result.priorityId);
          break;
        }
        if (job.action === ACTION.LABELS && dep.action === ACTION.LABELS && Array.isArray(dep.result?.labelsAfter)) {
          expected.labels = [...dep.result.labelsAfter];
          break;
        }
        if (job.action === ACTION.EDIT_FIELDS && dep.action === ACTION.EDIT_FIELDS && dep.result?.fieldsAfter && typeof dep.result.fieldsAfter === 'object') {
          expected.fields = { ...(expected.fields || {}), ...structuredClone(dep.result.fieldsAfter) };
          break;
        }
      }
      id = dep.dependsOnJobId;
    }
    return expected;
  };
  const validateNoop = job => issue => {
    if (job.action === ACTION.ASSIGN) {
      if (job.payload.unassign && !issue.assignee) throw stale('Already unassigned.');
      if (!job.payload.unassign && job.payload.user && issue.assignee && userKey(issue.assignee) && userKey(issue.assignee) === userKey(job.payload.user)) throw stale('Assignee already set.');
    }
    else if (job.action === ACTION.PRIORITY && String(issue.priorityId || '') === String(job.payload.priorityId || '')) throw stale('Priority already set.');
    else if (job.action === ACTION.LABELS) {
      const current = new Set((issue.labels || []).map(x => normalizeText(x).toLowerCase())),
        adds = (job.payload.labels?.add || []).map(x => normalizeText(template(x, issue)).toLowerCase()).filter(Boolean),
        removes = (job.payload.labels?.remove || []).map(x => normalizeText(template(x, issue)).toLowerCase()).filter(Boolean);
      if (adds.every(x => current.has(x)) && removes.every(x => !current.has(x))) throw stale('Labels already applied.');
    }
    else if (job.action === ACTION.TRANSITION) {
      const r = job.payload.rule || {},
        target = String(r.toStatusId || r.transitionContext?.toStatusId || '');
      if (target && target === String(issue.statusId || '')) throw stale('Already in target status.');
    }
    return issue;
  };
  const clearShortTimer = id => {
    const t = shortTimers.get(id);
    if (t) {
      clearTimeout(t);
      shortTimers.delete(id);
    }
  };
  const armJob = async (job, when) => {
    clearShortTimer(job.id);
    await chrome.alarms.clear(alarmName(job.id)).catch(() => {});
    const due = Math.max(Date.now() + 50, Number(when) || Date.now() + 50), delay = due - Date.now();
    if (delay < 30000) {
      const timer = setTimeout(() => {
        shortTimers.delete(job.id);
        process(job.id).catch(() => {});
      }, Math.max(0, delay));
      shortTimers.set(job.id, timer);/* Fallback if the MV3 worker is suspended before the short timer fires. */await chrome.alarms.create(alarmName(job.id), { when: Date.now() + 31000 });
    }
    else await chrome.alarms.create(alarmName(job.id), { when: due });
  };
  const scheduleJob = async job => armJob(job, new Date(job.scheduledAt).getTime());
  const scheduleRetry = async (job, delayMs = 1500) => armJob(job, Date.now() + Math.max(50, Number(delayMs) || 1500));
  const wakeDependents = async (jobs, parentId) => {
    for (const child of (jobs || []).filter(x => x.status === JOB.PENDING && x.dependsOnJobId === parentId)) await scheduleRetry(child, 100);
  };
  const writeLedger = async (job, status = 'executed', extra = {}) => {
    if (!job.ledgerKey) return;
    const ledger = await root.Storage.getLedger();
    ledger[job.ledgerKey] = {
      at: extra.at || job.completedAt || nowIso(),
      jobId: job.id,
      siteId: job.siteId,
      profileId: job.profileId,
      ruleId: job.ruleId,
      actionId: job.actionId,
      actionType: job.action,
      issueKey: job.issueKey,
      status,
      ...extra
    };
    await root.Storage.saveLedger(ledger);
  };
  const clearLedgerReservation = async job => {
    if (!job.ledgerKey) return;
    const ledger = await root.Storage.getLedger(), hit = ledger[job.ledgerKey];
    if (hit?.jobId === job.id && ['queued', 'reserved'].includes(hit.status)) {
      delete ledger[job.ledgerKey];
      await root.Storage.saveLedger(ledger);
    }
  };
  const enqueue = async jobs => {
    const all = await root.Storage.getJobs();
    for (const j of jobs) {
      await writeLedger(j, 'queued', { at: nowIso() });
      await qlog(LEVEL.INFO, 'Action queued.', j, { jobId: j.id, action: j.action, scheduledAt: j.scheduledAt });
    }
    all.push(...jobs);
    await root.Storage.saveJobs(all);
    for (const j of jobs) {
      if (j.status !== JOB.PENDING) continue;
      if (j.dependsOnJobId) continue;
      await scheduleJob(j);
    }
    return jobs;
  };
  const list = async () => {
    const jobs = await root.Storage.getJobs();
    for (const j of jobs) {
      if (j.status === JOB.RUNNING && cancelRequests.has(j.id)) j.cancelRequestedAt = j.cancelRequestedAt || cancelRequestTimes.get(j.id) || nowIso();
    }
    return jobs;
  };
  const cancellationError = () => Object.assign(new Error('Action cancelled by user.'), { code: 'JOB_CANCELLED' });
  const cancel = async id => {
    if (!id) throw Object.assign(new Error('Queued action ID is required.'), { code: 'JOB_NOT_FOUND' });
    /* Register intent before the first await so a concurrently starting job sees it. */
    const requestedAt = nowIso();
    cancelRequests.add(id);
    cancelRequestTimes.set(id, requestedAt);
    const jobs = await root.Storage.getJobs(), j = jobs.find(x => x.id === id);
    if (!j) {
      cancelRequests.delete(id);
      cancelRequestTimes.delete(id);
      throw Object.assign(new Error('Queued action was not found.'), { code: 'JOB_NOT_FOUND' });
    }
    if (![JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(j.status)) {
      cancelRequests.delete(id);
      cancelRequestTimes.delete(id);
      throw Object.assign(new Error('This action is no longer cancellable.'), { code: 'JOB_NOT_CANCELLABLE' });
    }
    const ctx = runningContexts.get(id);
    if (j.status === JOB.RUNNING && !ctx) {
      cancelRequests.delete(id);
      cancelRequestTimes.delete(id);
      throw Object.assign(new Error('The running action changed state while cancellation was requested. Refresh the queue and try again if it is still cancellable.'), { code: 'JOB_CANCELLATION_STATE_CHANGED' });
    }
    if (j.status === JOB.RUNNING && ctx.writeStarted) {
      cancelRequests.delete(id);
      cancelRequestTimes.delete(id);
      await root.Storage.appendAudit({ event: 'job-cancel-rejected', siteId: j.siteId, profileId: j.profileId, ruleId: j.ruleId, issueKey: j.issueKey, details: { jobId: j.id, action: j.action, reason: 'jira-write-started' } });
      throw Object.assign(new Error('Jira write has already started; this action can no longer be safely cancelled.'), { code: 'ACTION_ALREADY_DISPATCHED' });
    }
    j.cancelRequestedAt = requestedAt;
    j.cancelRequestedBy = 'user';
    if (ctx) ctx.cancelRequested = true;
    clearShortTimer(id);
    await chrome.alarms.clear(alarmName(id)).catch(() => {});
    if ([JOB.AWAITING_APPROVAL, JOB.PENDING].includes(j.status)) {
      j.status = JOB.CANCELLED;
      j.completedAt = requestedAt;
      j.cancelledAt = requestedAt;
      delete j.error;
      await writeLedger(j, 'cancelled', { at: requestedAt, cancelledAt: requestedAt, reason: 'user' });
      await root.Storage.saveJobs(jobs);
      await root.Storage.appendAudit({ event: 'job-cancelled', siteId: j.siteId, profileId: j.profileId, ruleId: j.ruleId, issueKey: j.issueKey, details: { jobId: j.id, action: j.action, phase: 'queued' } });
      await qlog(LEVEL.INFO, 'Action cancelled by user.', j, { jobId: j.id, action: j.action, phase: 'queued' });
      await wakeDependents(jobs, j.id);
    }
    else {
      await root.Storage.appendAudit({ event: 'job-cancel-requested', siteId: j.siteId, profileId: j.profileId, ruleId: j.ruleId, issueKey: j.issueKey, details: { jobId: j.id, action: j.action, phase: 'running-prewrite' } });
    }
    return j;
  };
  const cancelPending = async ({ siteId = '', profileId = '', issueKey = '' } = {}) => {
    if (!siteId || !profileId) throw Object.assign(new Error('Bulk cancellation requires a server and profile scope.'), { code: 'BULK_CANCEL_SCOPE_REQUIRED' });
    const jobs = await root.Storage.getJobs(),
      targets = jobs.filter(j => [JOB.AWAITING_APPROVAL, JOB.PENDING].includes(j.status) && (!siteId || j.siteId === siteId) && (!profileId || j.profileId === profileId) && (!issueKey || j.issueKey === issueKey));
    if (!targets.length) return { cancelled: 0, jobIds: [] };
    const at = nowIso(), ids = targets.map(j => j.id);
    for (const id of ids) {
      cancelRequests.add(id);
      cancelRequestTimes.set(id, at);
    }
    for (const j of targets) {
      j.status = JOB.CANCELLED;
      j.completedAt = at;
      j.cancelledAt = at;
      j.cancelRequestedAt = at;
      j.cancelRequestedBy = 'user-bulk';
      delete j.error;
      clearShortTimer(j.id);
    }
    await root.Storage.saveJobs(jobs);
    const ledger = await root.Storage.getLedger();
    for (const j of targets) if (j.ledgerKey) ledger[j.ledgerKey] = {
      at,
      jobId: j.id,
      siteId: j.siteId,
      profileId: j.profileId,
      ruleId: j.ruleId,
      actionId: j.actionId,
      actionType: j.action,
      issueKey: j.issueKey,
      status: 'cancelled',
      cancelledAt: at,
      reason: 'user-bulk'
    };
    await root.Storage.saveLedger(ledger);
    for (const j of targets) {
      await chrome.alarms.clear(alarmName(j.id)).catch(() => {});
      await qlog(LEVEL.INFO, 'Upcoming action cancelled by bulk request.', j, { jobId: j.id, action: j.action, scope: issueKey ? 'issue' : 'profile' });
      await wakeDependents(jobs, j.id);
      cancelRequests.delete(j.id);
      cancelRequestTimes.delete(j.id);
    }
    await root.Storage.appendAudit({ event: 'jobs-bulk-cancelled', siteId, profileId, issueKey, details: { count: targets.length, jobIds: ids, scope: issueKey ? 'issue' : 'profile' } });
    return { cancelled: targets.length, jobIds: ids };
  };
  const approve = async id => {
    if (!id) throw Object.assign(new Error('Queued action ID is required.'), { code: 'JOB_NOT_FOUND' });
    const jobs = await root.Storage.getJobs(),
      job = jobs.find(x => x.id === id);
    if (!job) throw Object.assign(new Error('Queued action was not found.'), { code: 'JOB_NOT_FOUND' });
    if (job.status !== JOB.AWAITING_APPROVAL) throw Object.assign(new Error('This action is not awaiting approval.'), { code: 'JOB_NOT_AWAITING_APPROVAL' });
    const at = nowIso();
    job.status = JOB.PENDING;
    job.approvedAt = at;
    job.approvedBy = 'user';
    await root.Storage.saveJobs(jobs);
    await root.Storage.appendAudit({ event: 'job-approved', siteId: job.siteId, profileId: job.profileId, ruleId: job.ruleId, issueKey: job.issueKey, details: { jobId: job.id, action: job.action } });
    await qlog(LEVEL.INFO, 'Action approved by user.', job, { jobId: job.id, action: job.action });
    const dependency = job.dependsOnJobId ? jobs.find(x => x.id === job.dependsOnJobId) : null;
    if (!dependency || ![JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(dependency.status)) await scheduleJob(job);
    return job;
  };
  const approvePending = async ({ siteId = '', profileId = '', issueKey = '' } = {}) => {
    if (!siteId || !profileId) throw Object.assign(new Error('Bulk approval requires a server and profile scope.'), { code: 'BULK_APPROVAL_SCOPE_REQUIRED' });
    const jobs = await root.Storage.getJobs(),
      targets = jobs.filter(j => j.status === JOB.AWAITING_APPROVAL && j.siteId === siteId && j.profileId === profileId && (!issueKey || j.issueKey === issueKey));
    if (!targets.length) return { approved: 0, jobIds: [] };
    const at = nowIso(), ids = targets.map(j => j.id), targetIds = new Set(ids);
    for (const job of targets) {
      job.status = JOB.PENDING;
      job.approvedAt = at;
      job.approvedBy = 'user-bulk';
    }
    await root.Storage.saveJobs(jobs);
    for (const job of targets) {
      const dependency = job.dependsOnJobId ? jobs.find(x => x.id === job.dependsOnJobId) : null;
      if (!dependency || (!targetIds.has(dependency.id) && ![JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(dependency.status))) await scheduleJob(job);
      await qlog(LEVEL.INFO, 'Action approved by bulk request.', job, { jobId: job.id, action: job.action, scope: issueKey ? 'issue' : 'profile' });
    }
    await root.Storage.appendAudit({ event: 'jobs-bulk-approved', siteId, profileId, issueKey, details: { count: targets.length, jobIds: ids, scope: issueKey ? 'issue' : 'profile' } });
    return { approved: targets.length, jobIds: ids };
  };
  const cancelLocalAlerts = async ({ actionTypes = [ACTION.ALARM], siteId = '', profileId = '' } = {}) => {
    const types = new Set(actionTypes), jobs = await root.Storage.getJobs(), at = nowIso();
    const targets = jobs.filter(j => types.has(j.action) && (!siteId || j.siteId === siteId) && (!profileId || j.profileId === profileId) && [JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(j.status));
    const cancelled = [];
    for (const job of targets) {
      if (job.status === JOB.RUNNING) {
        const ctx = runningContexts.get(job.id);
        // Local alert actions have no irreversible Jira write. A global stop
        // request must therefore cancel them even if execution has entered
        // the local-alert branch. Audio.play also checks a generation token
        // to close the small race between cancellation and playback start.
        cancelRequests.add(job.id);
        cancelRequestTimes.set(job.id, at);
        if (ctx) ctx.cancelRequested = true;
        job.cancelRequestedAt = at;
        job.cancelRequestedBy = 'stop-all-alerts';
        continue;
      }
      job.status = JOB.CANCELLED;
      job.completedAt = at;
      job.cancelledAt = at;
      job.cancelRequestedAt = at;
      job.cancelRequestedBy = 'stop-all-alerts';
      delete job.error;
      clearShortTimer(job.id);
      await chrome.alarms.clear(alarmName(job.id)).catch(() => {});
      await writeLedger(job, 'cancelled', { at, cancelledAt: at, reason: 'stop-all-alerts' });
      cancelled.push(job.id);
    }
    if (targets.length) await root.Storage.saveJobs(jobs);
    for (const id of cancelled) {
      const job = jobs.find(x => x.id === id);
      if (job) await wakeDependents(jobs, id);
    }
    if (targets.length) await root.Storage.appendAudit({ event: 'local-alerts-cancelled', siteId, profileId, details: { actionTypes: [...types], count: targets.length, cancelledJobIds: cancelled } });
    return { cancelled: cancelled.length, affected: targets.length, jobIds: cancelled };
  };
  const dependencyPolicyValue = (job, status) => {
    const p = { cancelled: 'continue', skipped: 'continue', failed: 'continue', ...(job.dependencyPolicy || {}) };
    if (status === JOB.CANCELLED) return p.cancelled;
    if (status === JOB.SKIPPED) return p.skipped;
    if (status === JOB.FAILED) return p.failed;
    return 'continue';
  };
  const cancelForDependency = async (jobs, job, status, message, details = {}) => {
    const at = nowIso();
    job.status = JOB.CANCELLED;
    job.completedAt = at;
    job.cancelledAt = at;
    job.error = { code: 'DEPENDENCY_BLOCKED', message };
    await writeLedger(job, 'cancelled', { at, cancelledAt: at, reason: 'dependency', dependencyStatus: status });
    await root.Storage.saveJobs(jobs);
    clearShortTimer(job.id);
    await chrome.alarms.clear(alarmName(job.id)).catch(() => {});
    await root.Storage.appendAudit({
      event: 'action-cancelled-dependency',
      siteId: job.siteId,
      profileId: job.profileId,
      ruleId: job.ruleId,
      issueKey: job.issueKey,
      details: { jobId: job.id, dependencyJobId: job.dependsOnJobId || '', dependencyStatus: status, ...details }
    });
    await qlog(LEVEL.INFO, `Action cancelled by chain policy: ${message}`, job, { jobId: job.id, dependencyStatus: status, ...details });
    await wakeDependents(jobs, job.id);
    return job;
  };
  const dependencyCompletedAt = dep => {
    const ms = new Date(dep?.completedAt || dep?.cancelledAt || dep?.startedAt || dep?.createdAt || Date.now()).getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  };
  const resolveTransition = async (client, site, job, issue) => {
    const r = job.payload.rule || {},
      method = site.inventorySettings?.transitionMethod || root.Constants.TRANSITION_METHOD.WORKFLOW_DESIGNER,
      ts = (await client.transitions(job.issueKey))?.transitions || [];
    if (method === root.Constants.TRANSITION_METHOD.TARGET_STATUS_RANDOM) {
      const target = String(r.toStatusId || '');
      if (!target) throw new Error('Target-status transition mode requires a target status.');
      const matches = ts.filter(x => String(x.to?.id || '') === target);
      if (!matches.length) throw stale('Transition no longer available.');
      return matches.length === 1 ? matches[0] : matches[Math.floor(Math.random() * matches.length)];
    }
    if (method === root.Constants.TRANSITION_METHOD.MANUAL_NAME) {
      const name = String(r.manualTransitionName || '').trim();
      if (!name) throw new Error('Manual transition mode requires a transition name.');
      const matches = ts.filter(x => String(x.name || '').trim().toLowerCase() === name.toLowerCase());
      if (!matches.length) throw stale('Transition no longer available.');
      if (matches.length > 1) throw new Error(`Manual transition name '${name}' is ambiguous: Jira currently exposes ${matches.length} matching transitions.`);
      return matches[0];
    }
    const c = r.transitionContext;
    if (!r.transitionId) throw new Error('Configured transition is missing. Synchronize transitions or select a transition in the rule.');
    if (c) {
      if (c.projectKey && String(c.projectKey) !== String(issue.projectKey || '')) throw stale('Project context changed.');
      if (c.issueTypeId && String(c.issueTypeId) !== String(issue.issueTypeId || '')) throw stale('Issue type changed.');
      if (c.fromStatusId && String(c.fromStatusId) !== String(issue.statusId || '')) throw stale('Source status changed.');
    }
    const t = ts.find(x => String(x.id) === String(r.transitionId) && (c?.toStatusId ? String(x.to?.id || '') === String(c.toStatusId) : true));
    if (!t) throw stale('Transition no longer available.');
    return t;
  };
  const dependencyCheck = (site, job) => {
    if (job.action === ACTION.ASSIGN && !job.payload.user && !job.payload.unassign) throw new Error('Assignment target is missing.');
    if (job.action === ACTION.PRIORITY && !site.priorities?.some(x => String(x.id) === String(job.payload.priorityId))) throw new Error('Configured priority is not present in the current Jira inventory.');
    if (job.action === ACTION.COMMENT && !String(job.payload.comment || '').trim()) throw new Error('Comment text is empty.');
  };
  const process = async (id, { manual = false, force = false } = {}) => {
    if (processing) {
      const queued = await root.Storage.getJobs(), pending = queued.find(x => x.id === id);
      if (pending && pending.status === JOB.PENDING && !cancelRequests.has(id)) await scheduleRetry(pending);
      return null;
    }
    const jobs = await root.Storage.getJobs(), job = jobs.find(x => x.id === id);
    if (!job || ![JOB.PENDING, JOB.RUNNING].includes(job.status) || cancelRequests.has(id) && job.status === JOB.CANCELLED) return null;
    const skippedBefore = Array.isArray(job.dependencySkipped) ? job.dependencySkipped : [];
    if (!force && skippedBefore.length && dependencyPolicyValue(job, JOB.SKIPPED) === 'stop') return cancelForDependency(jobs, job, JOB.SKIPPED, 'Previous action was not scheduled.', { skipped: skippedBefore.map(x => ({ actionId: x.actionId, reason: x.reason })) });
    if (!force && job.dependsOnJobId) {
      const dep = jobs.find(x => x.id === job.dependsOnJobId);
      if (!dep) return cancelForDependency(jobs, job, 'missing', 'Previous action is no longer available.');
      if ([JOB.AWAITING_APPROVAL, JOB.PENDING, JOB.RUNNING].includes(dep.status)) {
        await scheduleRetry(job);
        return null;
      }
      if ([JOB.FAILED, JOB.CANCELLED, JOB.SKIPPED].includes(dep.status) && dependencyPolicyValue(job, dep.status) === 'stop') return cancelForDependency(jobs, job, dep.status, `Previous action ended as ${dep.status}.`);
      const anchor = dependencyCompletedAt(dep),
        anchorIso = new Date(anchor).toISOString(),
        relativeDue = anchor + Math.max(0, Number(job.dependencyDelaySeconds) || 0) * 1000,
        preserve = Boolean(dep.manualProcessedAt) && job.manualRelativeSchedule === 'preserve',
        storedDue = new Date(job.scheduledAt || 0).getTime(),
        due = preserve && Number.isFinite(storedDue) ? storedDue : relativeDue;
      if (!job.dependencyScheduled || job.dependencyResolvedAt !== anchorIso || job.dependencyResolvedStatus !== dep.status) {
        job.dependencyScheduled = true;
        job.dependencyResolvedAt = anchorIso;
        job.dependencyResolvedStatus = dep.status;
        if (!preserve) job.scheduledAt = new Date(due).toISOString();
        await root.Storage.saveJobs(jobs);
      }
      if (Date.now() < due) {
        await scheduleJob(job);
        return null;
      }
    }
    else if (!force && skippedBefore.length) {
      const anchorRaw = job.dependencyResolvedAt || skippedBefore.at(-1)?.at || job.createdAt,
        anchor = dependencyCompletedAt({ completedAt: anchorRaw }),
        anchorIso = new Date(anchor).toISOString(),
        due = anchor + Math.max(0, Number(job.dependencyDelaySeconds) || 0) * 1000;
      if (!job.dependencyScheduled || job.dependencyResolvedAt !== anchorIso) {
        job.dependencyScheduled = true;
        job.dependencyResolvedAt = anchorIso;
        job.dependencyResolvedStatus = JOB.SKIPPED;
        job.scheduledAt = new Date(due).toISOString();
        await root.Storage.saveJobs(jobs);
      }
      if (Date.now() < due) {
        await scheduleJob(job);
        return null;
      }
    }
    if (issueLocks.has(job.issueKey)) {
      if (!cancelRequests.has(id)) await scheduleRetry(job);
      return null;
    }
    processing = true;
    issueLocks.add(job.issueKey);
    job.status = JOB.RUNNING;
    job.startedAt = nowIso();
    if (manual) {
      job.manualProcessRequestedAt = job.manualProcessRequestedAt || job.startedAt;
      job.manualProcessMode = 'manual';
    }
    job.attempts = (job.attempts || 0) + 1;
    await qlog(LEVEL.INFO, 'Action started.', job, { jobId: job.id, action: job.action, attempt: job.attempts });
    let ledgerReserved = false, writeStarted = false;
    const ctx = { cancelRequested: cancelRequests.has(id) || Boolean(job.cancelRequestedAt), writeStarted: false };
    runningContexts.set(id, ctx);
    const throwIfCancelled = () => {
      if (ctx.cancelRequested || cancelRequests.has(id) || job.cancelRequestedAt) throw cancellationError();
    };
    const reserve = async () => {
      throwIfCancelled();
      if (ledgerReserved) return;
      await writeLedger(job, 'reserved', { at: nowIso() });
      ledgerReserved = true;
      throwIfCancelled();
    };
    const markWriteStarted = () => {
      throwIfCancelled();
      writeStarted = true;
      ctx.writeStarted = true;
    };
    try {
      throwIfCancelled();
      await root.Storage.saveJobs(jobs);
      throwIfCancelled();
      const state = await root.Storage.ensureState(),
        site = state.jiraSites.find(s => s.id === job.siteId),
        profile = state.profiles.find(p => p.id === job.profileId);
      throwIfCancelled();
      if (!site || !profile) throw new Error("Job configuration no longer exists.");
      const bulkOperation = job.sourceType === 'bulk-operation',
        rule = bulkOperation ? job.ruleSnapshot : (profile.rules || []).find(r => r.id === job.ruleId);
      if (!rule || (!bulkOperation && !rule.enabled)) throw new Error(bulkOperation ? "Bulk operation definition is unavailable." : "Rule was removed or disabled.");
      if (!bulkOperation && !manual && !root.RuleEngine.ruleScheduleActive(profile, rule, new Date())) throw stale("Schedule is no longer active.");
      dependencyCheck(site, job);
      throwIfCancelled();
      const token = await root.Storage.getCredential(site.id);
      throwIfCancelled();
      if (!token) throw new Error("PAT is missing.");
      const client = new root.JiraApi.JiraClient(site, token),
        expected = expectedStatusFor(jobs, job),
        expectedPrecondition = expectedPreconditionFor(jobs, job),
        issue = validateNoop(job)(await root.RuleEngine.validateAction(client, job, profile, { expectedStatusId: expected.id, expectedStatusName: expected.name, expectedPrecondition, skipSchedule: manual }));
      throwIfCancelled();
      if (job.action === ACTION.ALARM) {
        const alarmGeneration = root.Audio?.generation?.();
        await reserve();
        markWriteStarted();
        throwIfCancelled();
        const played = await root.Audio.play(
          job.payload.alarm,
          {
            siteId: job.siteId,
            profileId: job.profileId,
            issueKey: job.issueKey,
            summary: issue.summary || job.issueSnapshot?.summary || "",
            ruleName: rule.name || "Detection rule",
            source: bulkOperation ? "Bulk operation" : "Rule action"
          },
          alarmGeneration
        );
        throwIfCancelled();
        if (played === false) throw cancellationError();
        job.result = { localAlarm: true };
      }
      else if (job.action === ACTION.NOTIFICATION) {
        await reserve();
        markWriteStarted();
        // Use one stable ID so action notifications replace each other rather
        // than accumulating into an unbounded stack across different rules.
        const notificationId = 'sd-companion-action-notification';
        await chrome.notifications.create(notificationId, { type: "basic", iconUrl: chrome.runtime.getURL("icons/icon128.png"), title: job.payload.notification.title, message: job.payload.notification.message });
        job.result = { notification: true, notificationId };
      }
      else {
        if (job.action === ACTION.ASSIGN) {
          await reserve();
          markWriteStarted();
          await client.assign(job.issueKey, job.payload.unassign ? null : job.payload.user);
          job.result = {
            assignee: job.payload.unassign ? 'Unassigned' : (job.payload.user?.displayName || job.payload.user?.name || job.payload.user?.key || ''),
            assigneeKey: job.payload.unassign ? '' : userKey(job.payload.user)
          };
        }
        else if (job.action === ACTION.COMMENT) {
          const comment = template(job.payload.commentTemplate || job.payload.comment || "", issue);
          if (!String(comment).trim()) throw new Error("Comment text is empty after variable expansion.");
          await reserve();
          markWriteStarted();
          await client.comment(job.issueKey, comment);
          job.result = { commentPosted: true, comment };
        }
        else if (job.action === ACTION.TRANSITION) {
          const t = await resolveTransition(client, site, job, issue);
          throwIfCancelled();
          let fields = {};
          try {
            fields = JSON.parse(templateJson(job.payload.rule.fieldsJson || "{}", issue));
          } catch {
            throw new Error("Transition fields JSON is invalid after variable expansion.");
          }
          await reserve();
          markWriteStarted();
          await client.transition(job.issueKey, t.id, fields);
          job.result = { transitionId: t.id, transitionName: t.name, toStatusId: String(t.to?.id || ''), toStatus: t.to?.name || '' };
        }
        else if (job.action === ACTION.EDIT_FIELDS) {
          let fields = {};
          try {
            fields = JSON.parse(templateJson(job.payload.fieldsJson || "{}", issue));
          } catch {
            throw new Error("Edit-fields JSON is invalid after variable expansion.");
          }
          await reserve();
          markWriteStarted();
          await client.editIssue(job.issueKey, fields);
          job.result = { fieldsEdited: true, fieldsAfter: structuredClone(fields) };
        }
        else if (job.action === ACTION.LABELS) {
          const update = { labels: [...(job.payload.labels.add || []).map(x => ({ add: template(x, issue) })), ...(job.payload.labels.remove || []).map(x => ({ remove: template(x, issue) }))] };
          await reserve();
          markWriteStarted();
          await client.editIssue(job.issueKey, null, update);
          const after = new Set((issue.labels || []).map(x => normalizeText(x).toLowerCase()).filter(Boolean));
          for (const x of job.payload.labels.add || []) after.add(normalizeText(template(x, issue)).toLowerCase());
          for (const x of job.payload.labels.remove || []) after.delete(normalizeText(template(x, issue)).toLowerCase());
          job.result = { labels: job.payload.labels, labelsAfter: [...after].filter(Boolean).sort() };
        }
        else if (job.action === ACTION.PRIORITY) {
          await reserve();
          markWriteStarted();
          await client.editIssue(job.issueKey, { priority: { id: String(job.payload.priorityId) } });
          job.result = { priorityId: String(job.payload.priorityId) };
        }
      }
      job.status = JOB.SUCCEEDED;
      job.completedAt = nowIso();
      await writeLedger(job, 'executed');
      await root.Storage.appendAudit({ event: 'action-executed', siteId: site.id, profileId: profile.id, ruleId: job.ruleId, issueKey: job.issueKey, details: { jobId: job.id, action: job.action, result: job.result || null } });
      await qlog(LEVEL.INFO, 'Action completed.', job, { jobId: job.id, action: job.action, result: job.result || null });
      if (state.system?.completionToneEnabled !== false && job.action !== ACTION.ALARM) await root.Audio?.completion?.().catch(() => {});
    } catch (e) {
      if (e?.code === 'JOB_CANCELLED') {
        job.status = JOB.CANCELLED;
        job.completedAt = nowIso();
        job.cancelledAt = job.completedAt;
        job.cancelRequestedAt = job.cancelRequestedAt || cancelRequestTimes.get(id) || job.completedAt;
        delete job.error;
        if (ledgerReserved) await clearLedgerReservation(job);
        await writeLedger(job, 'cancelled', { at: job.completedAt, cancelledAt: job.completedAt, reason: 'user' });
        await root.Storage.appendAudit({ event: 'job-cancelled', siteId: job.siteId, profileId: job.profileId, ruleId: job.ruleId, issueKey: job.issueKey, details: { jobId: job.id, action: job.action, phase: 'running-prewrite' } });
        await qlog(LEVEL.INFO, 'Action cancelled by user.', job, { jobId: job.id, action: job.action, phase: 'running-prewrite' });
      }
      else if (e?.code === 'ACTION_PRECONDITION_CHANGED' && !writeStarted) {
        job.status = JOB.CANCELLED;
        job.completedAt = nowIso();
        job.cancelledAt = job.completedAt;
        job.error = { code: e.code, message: String(e.message || 'Issue changed before execution.') };
        if (ledgerReserved) await clearLedgerReservation(job);
        await writeLedger(job, 'cancelled', { at: job.completedAt, cancelledAt: job.completedAt, reason: 'precondition-changed', error: job.error });
        await root.Storage.appendAudit({ event: 'action-cancelled-stale', siteId: job.siteId, profileId: job.profileId, ruleId: job.ruleId, issueKey: job.issueKey, details: { jobId: job.id, action: job.action, reason: job.error.message } });
        await qlog(LEVEL.WARN, `Action cancelled: ${job.error.message}`, job, { jobId: job.id, action: job.action, reason: 'precondition-changed' });
      }
      else {
        job.status = JOB.FAILED;
        job.completedAt = nowIso();
        job.error = safeError(e);
        if (ledgerReserved) {
          if (writeStarted) await writeLedger(job, 'uncertain', { at: job.completedAt, error: job.error });
          else await clearLedgerReservation(job);
        }
        await root.Storage.appendAudit({
          event: writeStarted ? 'action-failed-uncertain' : 'action-failed',
          siteId: job.siteId,
          profileId: job.profileId,
          ruleId: job.ruleId,
          issueKey: job.issueKey,
          details: { jobId: job.id, action: job.action, error: job.error, writeMayHaveReachedJira: writeStarted }
        });
        await qlog(LEVEL.ERROR, `Action failed: ${job.error.message || 'Unknown error'}`, job, { jobId: job.id, action: job.action, error: job.error, writeMayHaveReachedJira: writeStarted });
      }
    } finally {
      if (manual && [JOB.SUCCEEDED, JOB.FAILED, JOB.CANCELLED, JOB.SKIPPED].includes(job.status)) job.manualProcessedAt = job.completedAt || nowIso();
      await root.Storage.saveJobs(jobs);
      clearShortTimer(job.id);
      await chrome.alarms.clear(alarmName(job.id)).catch(() => {});
      if ([JOB.SUCCEEDED, JOB.FAILED, JOB.CANCELLED, JOB.SKIPPED].includes(job.status)) await wakeDependents(jobs, job.id);
      issueLocks.delete(job.issueKey);
      runningContexts.delete(id);
      cancelRequests.delete(id);
      cancelRequestTimes.delete(id);
      processing = false;
    }
    return job;
  };
  const waitForIdle = async () => {
    while (processing) await new Promise(resolve => setTimeout(resolve, 50));
  };
  const processNow = async id => {
    if (!id) throw Object.assign(new Error('Queued action ID is required.'), { code: 'JOB_NOT_FOUND' });
    let jobs = await root.Storage.getJobs(), job = jobs.find(x => x.id === id);
    if (!job) throw Object.assign(new Error('Queued action was not found.'), { code: 'JOB_NOT_FOUND' });
    if (job.status !== JOB.PENDING) throw Object.assign(new Error('Only upcoming actions can be processed immediately.'), { code: 'JOB_NOT_PROCESSABLE' });
    clearShortTimer(id);
    await chrome.alarms.clear(alarmName(id)).catch(() => {});
    job.manualProcessRequestedAt = nowIso();
    await root.Storage.saveJobs(jobs);
    await root.Storage.appendAudit({
      event: 'job-process-now-requested',
      siteId: job.siteId,
      profileId: job.profileId,
      ruleId: job.ruleId,
      issueKey: job.issueKey,
      details: { jobId: job.id, action: job.action, scheduledAt: job.scheduledAt }
    });
    await qlog(LEVEL.INFO, 'Immediate action processing requested.', job, { jobId: job.id, action: job.action, scheduledAt: job.scheduledAt });
    await waitForIdle();
    return process(id, { manual: true, force: true });
  };
  const processPendingNow = async ({ siteId = '', profileId = '', issueKey = '' } = {}) => {
    if (!siteId || !profileId) throw Object.assign(new Error('Bulk processing requires a server and profile scope.'), { code: 'BULK_PROCESS_SCOPE_REQUIRED' });
    const snapshot = (await root.Storage.getJobs()).filter(j => j.status === JOB.PENDING && j.siteId === siteId && j.profileId === profileId && (!issueKey || j.issueKey === issueKey)).sort((a, b) => new Date(a.scheduledAt || a.createdAt || 0) - new Date(b.scheduledAt || b.createdAt || 0));
    const jobIds = snapshot.map(j => j.id), results = [];
    for (const id of jobIds) {
      const current = (await root.Storage.getJobs()).find(j => j.id === id);
      if (!current || current.status !== JOB.PENDING) continue;
      try {
        const out = await processNow(id);
        if (out) results.push({ jobId: id, status: out.status, error: out.error || null });
      } catch (e) {
        results.push({ jobId: id, status: 'error', error: safeError(e) });
      }
    }
    await root.Storage.appendAudit({ event: 'jobs-bulk-processed-now', siteId, profileId, issueKey, details: { requested: jobIds.length, processed: results.length, scope: issueKey ? 'issue' : 'profile', results } });
    return { requested: jobIds.length, processed: results.length, results };
  };
  const restore = async () => {
    const jobs = await root.Storage.getJobs();
    let changed = false;
    for (const j of jobs.filter(x => x.status === JOB.RUNNING)) {
      j.status = JOB.FAILED;
      j.completedAt = nowIso();
      j.error = { code: 'INTERRUPTED_EXECUTION', message: 'Execution was interrupted while the extension worker restarted. The idempotency reservation is preserved to prevent an automatic duplicate.' };
      await writeLedger(j, 'uncertain', { at: j.completedAt, error: j.error });
      changed = true;
    }
    if (changed) await root.Storage.saveJobs(jobs);
    for (const j of jobs.filter(x => x.status === JOB.PENDING)) await scheduleJob(j);
  };
  root.JobQueue = Object.freeze({ alarmName, scheduleJob, enqueue, list, cancel, cancelPending, approve, approvePending, cancelLocalAlerts, process, processNow, processPendingNow, restore, resolveTransition });
})();
