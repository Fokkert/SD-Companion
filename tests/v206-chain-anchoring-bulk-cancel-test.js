const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const root = path.join(__dirname, '..'),
  load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
load('src/shared/defaults.js');
const SD = SDCompanion, { ACTION, JOB } = SD.Constants;
(async () => {
  // Planner: an action skipped by its own condition must not break the chain.
  SD.Schedule = { matchesAny: () => true };
  SD.Storage = { getLedger: async () => ({}) };
  load('src/background/rule-engine.js');
  const site = { id: 's', users: [], priorities: [] },
    profile = SD.Defaults.profile('P', site),
    rule = SD.Defaults.rule('R');
  rule.enabled = true;
  rule.logic = { operator: 'AND', groups: [] };
  rule.randomDelay = { minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  const first = SD.Defaults.action(ACTION.NOTIFICATION);
  first.delay = { mode: 'inherit', minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  const skipped = SD.Defaults.action(ACTION.NOTIFICATION);
  skipped.delay = { mode: 'inherit', minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  skipped.when = {
    enabled: true,
    logic: { operator: 'AND', groups: [{ id: 'g', operator: 'AND', negate: false, conditions: [{ id: 'c', field: 'status', operator: 'is-any-of', values: ['Closed'], value: '', negate: false }] }] }
  };
  const chained = SD.Defaults.action(ACTION.NOTIFICATION);
  chained.delay = { mode: 'after-previous', minSeconds: 120, maxSeconds: 120, unit: 'seconds' };
  rule.actions = [first, skipped, chained];
  profile.rules = [rule];
  profile.siteId = 's';
  const planned = await SD.RuleEngine.planCycle(site, profile, [{ key: 'IT-1', status: 'Open', statusId: '1', summary: 'Test', fields: {} }], new Date('2026-08-12T15:00:00Z'));
  assert.equal(planned.plans.length, 2, 'conditional miss must not prevent the later chained action from being planned');
  const [p1, p3] = planned.plans;
  assert.equal(p3.dependsOnJobId, p1.id, 'the chain should transparently bypass the condition-skipped action and retain the nearest real predecessor');
  assert.equal(p3.dependencySkipped?.[0]?.reason, 'condition-not-matched');
  assert.equal(new Date(p3.scheduledAt) - new Date(p1.scheduledAt), 120000, 'the initial chained estimate must be stable and relative to the predecessor estimate');
  assert.deepEqual(p3.dependencyPolicy, { cancelled: 'continue', skipped: 'continue', failed: 'continue' });

  // Queue: waiting for a predecessor may re-arm internally, but must never rewrite the visible scheduledAt.
  let jobs = [], ledger = {}, audits = [], logs = [], notifications = 0, lastValidateOptions = null;
  const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms) => ({ fn, ms });
  globalThis.clearTimeout = () => {};
  globalThis.chrome = {
    alarms: { create: async () => {}, clear: async () => true }, runtime: { getURL: x => x }, notifications: {
      create: async () => {
        notifications++;
      }
    }
  };
  const qRule = { id: 'r', name: 'R', enabled: true, schedule: { mode: 'always', scheduleIds: [] } },
    qProfile = { id: 'p', siteId: 's', rules: [qRule], schedules: [] },
    qSite = { id: 's', priorities: [] };
  SD.Storage = {
    getJobs: async () => structuredClone(jobs),
    saveJobs: async v => {
      jobs = structuredClone(v);
    },
    getLedger: async () => structuredClone(ledger),
    saveLedger: async v => {
      ledger = structuredClone(v);
    },
    appendAudit: async x => audits.push(structuredClone(x)),
    appendLog: async x => logs.push(structuredClone(x)),
    ensureState: async () => ({ jiraSites: [qSite], profiles: [qProfile], system: { completionToneEnabled: false } }),
    getCredential: async () => 'token'
  };
  SD.RuleEngine = {
    ruleScheduleActive: () => true, validateAction: async (_client, _job, _profile, opts) => {
      lastValidateOptions = opts;
      return { key: 'IT-1', summary: 'x' };
    }
  };
  SD.Audio = { play: async () => {}, completion: async () => {} };
  SD.JiraApi = { JiraClient: function() {} };
  load('src/background/job-queue.js');
  const base = {
    siteId: 's',
    profileId: 'p',
    ruleId: 'r',
    ruleName: 'R',
    issueKey: 'IT-1',
    issueSnapshot: { summary: 'x', status: 'Open' },
    action: ACTION.NOTIFICATION,
    payload: { notification: { title: 'T', message: 'M' } },
    status: JOB.PENDING,
    attempts: 0,
    expectedStatusId: '1',
    expectedStatusName: 'Open'
  };
  const fixed = '2026-08-12T16:07:00.000Z';
  jobs = [
    { ...base, id: 'dep', actionId: 'dep-a', status: JOB.PENDING, scheduledAt: '2026-08-12T16:05:00.000Z' },
    {
      ...base,
      id: 'child',
      actionId: 'child-a',
      scheduledAt: fixed,
      dependsOnJobId: 'dep',
      dependencyDelaySeconds: 120,
      dependencyScheduled: false,
      dependencyPolicy: { cancelled: 'continue', skipped: 'continue', failed: 'continue' }
    }
  ];
  await SD.JobQueue.process('child');
  assert.equal(jobs.find(x => x.id === 'child').scheduledAt, fixed, 'dependency polling must not move scheduledAt');

  // A failed predecessor continues when configured, anchors once to completion, and revalidates current state instead of enforcing the stale planned status.
  const failedAt = new Date(Date.now() - 5000).toISOString();
  jobs.find(x => x.id === 'dep').status = JOB.FAILED;
  jobs.find(x => x.id === 'dep').completedAt = failedAt;
  jobs.find(x => x.id === 'child').dependencyDelaySeconds = 0;
  let result = await SD.JobQueue.process('child');
  assert.equal(result.status, JOB.SUCCEEDED);
  assert.equal(notifications, 1);
  assert.equal(lastValidateOptions?.skipSchedule, false);
  assert.deepEqual(lastValidateOptions?.expectedPrecondition || {}, {});
  assert.equal(jobs.find(x => x.id === 'child').dependencyResolvedAt, failedAt);
  const anchored = jobs.find(x => x.id === 'child').scheduledAt;
  assert.equal(anchored, failedAt, 'zero-delay continuation must anchor exactly to predecessor completion');

  // A cancelled predecessor (including a stale/precondition cancellation) may also continue independently when configured.
  jobs = [
    {
      ...base,
      id: 'dep-cancel',
      actionId: 'dep-cancel-a',
      status: JOB.CANCELLED,
      completedAt: new Date(Date.now() - 3000).toISOString(),
      scheduledAt: new Date().toISOString(),
      error: { code: 'ACTION_PRECONDITION_CHANGED', message: 'Status changed.' }
    },
    {
      ...base,
      id: 'child-after-cancel',
      actionId: 'child-after-cancel-a',
      scheduledAt: new Date().toISOString(),
      dependsOnJobId: 'dep-cancel',
      dependencyDelaySeconds: 0,
      dependencyScheduled: false,
      dependencyPolicy: { failed: 'continue', cancelled: 'continue', skipped: 'continue' }
    }
  ];
  lastValidateOptions = null;
  result = await SD.JobQueue.process('child-after-cancel');
  assert.equal(result.status, JOB.SUCCEEDED);
  assert.equal(lastValidateOptions?.skipSchedule, false);

  // Strict policy remains available per outcome.
  jobs = [
    { ...base, id: 'dep-stop', actionId: 'dep-stop-a', status: JOB.FAILED, completedAt: new Date().toISOString(), scheduledAt: new Date().toISOString() },
    {
      ...base,
      id: 'child-stop',
      actionId: 'child-stop-a',
      scheduledAt: new Date().toISOString(),
      dependsOnJobId: 'dep-stop',
      dependencyDelaySeconds: 0,
      dependencyScheduled: false,
      dependencyPolicy: { failed: 'stop', cancelled: 'continue', skipped: 'continue' },
      ledgerKey: 'child-stop-ledger'
    }
  ];
  result = await SD.JobQueue.process('child-stop');
  assert.equal(result.status, JOB.CANCELLED);
  assert.equal(result.error?.code, 'DEPENDENCY_BLOCKED');
  assert.equal(ledger['child-stop-ledger']?.status, 'cancelled');

  // A condition-skipped predecessor can either continue or stop the next action.
  jobs = [
    {
      ...base,
      id: 'virtual-continue',
      actionId: 'vc',
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
      dependencyDelaySeconds: 0,
      dependencyScheduled: true,
      dependencyResolvedAt: new Date(Date.now() - 1000).toISOString(),
      dependencyResolvedStatus: JOB.SKIPPED,
      dependencySkipped: [{ actionId: 'skipped', reason: 'condition-not-matched', at: new Date(Date.now() - 1000).toISOString() }],
      dependencyPolicy: { skipped: 'continue', cancelled: 'continue', failed: 'continue' }
    }
  ];
  result = await SD.JobQueue.process('virtual-continue');
  assert.equal(result.status, JOB.SUCCEEDED);
  jobs = [
    {
      ...base,
      id: 'virtual-stop',
      actionId: 'vs',
      scheduledAt: new Date().toISOString(),
      dependencyDelaySeconds: 0,
      dependencyScheduled: true,
      dependencyResolvedAt: new Date().toISOString(),
      dependencyResolvedStatus: JOB.SKIPPED,
      dependencySkipped: [{ actionId: 'skipped', reason: 'condition-not-matched', at: new Date().toISOString() }],
      dependencyPolicy: { skipped: 'stop', cancelled: 'continue', failed: 'continue' },
      ledgerKey: 'virtual-stop-ledger'
    }
  ];
  result = await SD.JobQueue.process('virtual-stop');
  assert.equal(result.status, JOB.CANCELLED);
  assert.equal(result.error?.code, 'DEPENDENCY_BLOCKED');

  // Bulk cancellation is pending-only and supports issue scope, then whole-profile scope.
  const mk = (id, key) => ({ ...base, id, issueKey: key, actionId: `a-${id}`, ledgerKey: `l-${id}`, scheduledAt: new Date(Date.now() + 3600000).toISOString() });
  jobs = [mk('i1-a', 'IT-1'), mk('i1-b', 'IT-1'), mk('i2-a', 'IT-2'), { ...mk('done', 'IT-1'), status: JOB.SUCCEEDED, completedAt: new Date().toISOString() }];
  await assert.rejects(() => SD.JobQueue.cancelPending({}), e => e?.code === 'BULK_CANCEL_SCOPE_REQUIRED');
  let bulk = await SD.JobQueue.cancelPending({ siteId: 's', profileId: 'p', issueKey: 'IT-1' });
  assert.equal(bulk.cancelled, 2);
  assert.equal(jobs.filter(x => x.issueKey === 'IT-1' && x.status === JOB.CANCELLED).length, 2);
  assert.equal(jobs.find(x => x.id === 'i2-a').status, JOB.PENDING);
  bulk = await SD.JobQueue.cancelPending({ siteId: 's', profileId: 'p' });
  assert.equal(bulk.cancelled, 1);
  assert.equal(jobs.find(x => x.id === 'i2-a').status, JOB.CANCELLED);
  assert(audits.some(x => x.event === 'jobs-bulk-cancelled'));
  const home = fs.readFileSync(path.join(root, 'src/ui/app/pages/home.js'), 'utf8'),
    events = fs.readFileSync(path.join(root, 'src/ui/app/app-events.js'), 'utf8'),
    worker = fs.readFileSync(path.join(root, 'src/background/service-worker.js'), 'utf8'),
    rules = fs.readFileSync(path.join(root, 'src/ui/app/pages/rules.js'), 'utf8');
  assert(home.includes('data-action="cancel-issue-jobs"') && home.includes('data-action="cancel-all-jobs"'));
  assert(events.includes('MESSAGE.CANCEL_JOBS'));
  assert(worker.includes('MESSAGE.CANCEL_JOBS'));
  assert(rules.includes('chainDependency.cancelled') && rules.includes('chainDependency.skipped') && rules.includes('chainDependency.failed'));
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
  console.log('v206-chain-anchoring-bulk-cancel-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
