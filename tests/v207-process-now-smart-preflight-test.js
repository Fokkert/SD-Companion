const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const root = path.join(__dirname, '..'),
  load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
load('src/shared/defaults.js');
const SD = SDCompanion, { ACTION, JOB } = SD.Constants;
assert.equal(SD.Constants.BUILD_VERSION, '2.6.3');
assert.equal(SD.Constants.SCHEMA_VERSION, 34);
assert.equal(SD.Defaults.rule('R').manualProcess.relativeSchedule, 'update');
(async () => {
  let jobs = [], ledger = {}, audits = [], validateOptions = [], notifications = 0;
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
  const qRule = { id: 'r', name: 'R', enabled: true, schedule: { mode: 'scheduled', scheduleIds: ['shift'] }, actions: [] },
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
    appendLog: async () => {},
    ensureState: async () => ({ jiraSites: [qSite], profiles: [qProfile], system: { completionToneEnabled: false } }),
    getCredential: async () => 'token'
  };
  SD.RuleEngine = {
    ruleScheduleActive: () => false, validateAction: async (_client, _job, _profile, opts) => {
      validateOptions.push(structuredClone(opts));
      return { key: 'IT-1', summary: 'x', labels: [] };
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
    issueSnapshot: { summary: 'x', status: 'Open', statusId: '1' },
    action: ACTION.NOTIFICATION,
    payload: { notification: { title: 'T', message: 'M' } },
    status: JOB.PENDING,
    attempts: 0,
    precondition: {},
    expectedStatusId: '1',
    expectedStatusName: 'Open'
  };

  // Individual Process runs a future action immediately and deliberately bypasses only the rule schedule window.
  const future = new Date(Date.now() + 3600000).toISOString();
  jobs = [{ ...base, id: 'manual', actionId: 'a', ledgerKey: 'l-manual', scheduledAt: future }];
  let out = await SD.JobQueue.processNow('manual');
  assert.equal(out.status, JOB.SUCCEEDED);
  assert(out.manualProcessedAt);
  assert.equal(notifications, 1);
  assert.equal(validateOptions.at(-1).skipSchedule, true);
  assert.equal(jobs[0].scheduledAt, future, 'manual processing must not mutate the selected job original schedule timestamp');

  // Relative update: a dependent action re-anchors to manual completion + its configured delay.
  const parentFuture = new Date(Date.now() + 7200000).toISOString(),
    childOriginal = new Date(Date.now() + 7210000).toISOString();
  jobs = [
    { ...base, id: 'parent-update', actionId: 'p1', ledgerKey: 'lp1', scheduledAt: parentFuture },
    {
      ...base,
      id: 'child-update',
      actionId: 'c1',
      ledgerKey: 'lc1',
      scheduledAt: childOriginal,
      dependsOnJobId: 'parent-update',
      dependencyDelaySeconds: 10,
      dependencyScheduled: false,
      dependencyPolicy: { cancelled: 'continue', skipped: 'continue', failed: 'continue' },
      manualRelativeSchedule: 'update'
    }
  ];
  await SD.JobQueue.processNow('parent-update');
  const parentDone = jobs.find(x => x.id === 'parent-update');
  await SD.JobQueue.process('child-update');
  const childUpdated = jobs.find(x => x.id === 'child-update');
  assert.equal(new Date(childUpdated.scheduledAt).getTime(), new Date(parentDone.completedAt).getTime() + 10000, 'Relative update must anchor to manual completion time');

  // Preserve schedule: resolving the same dependency must leave the child timestamp untouched.
  jobs = [
    { ...base, id: 'parent-preserve', actionId: 'p2', ledgerKey: 'lp2', scheduledAt: parentFuture },
    {
      ...base,
      id: 'child-preserve',
      actionId: 'c2',
      ledgerKey: 'lc2',
      scheduledAt: childOriginal,
      dependsOnJobId: 'parent-preserve',
      dependencyDelaySeconds: 10,
      dependencyScheduled: false,
      dependencyPolicy: { cancelled: 'continue', skipped: 'continue', failed: 'continue' },
      manualRelativeSchedule: 'preserve'
    }
  ];
  await SD.JobQueue.processNow('parent-preserve');
  await SD.JobQueue.process('child-preserve');
  assert.equal(jobs.find(x => x.id === 'child-preserve').scheduledAt, childOriginal, 'Preserve schedule must keep the pre-existing child schedule');

  // Bulk processing is explicitly scoped and processes pending work only.
  const mk = (id, key) => ({ ...base, id, issueKey: key, actionId: `a-${id}`, ledgerKey: `l-${id}`, scheduledAt: new Date(Date.now() + 3600000).toISOString() });
  jobs = [mk('b1', 'IT-1'), mk('b2', 'IT-1'), mk('b3', 'IT-2')];
  await assert.rejects(() => SD.JobQueue.processPendingNow({}), e => e?.code === 'BULK_PROCESS_SCOPE_REQUIRED');
  let bulk = await SD.JobQueue.processPendingNow({ siteId: 's', profileId: 'p', issueKey: 'IT-1' });
  assert.equal(bulk.requested, 2);
  assert.equal(jobs.filter(x => x.issueKey === 'IT-1' && x.status === JOB.SUCCEEDED).length, 2);
  assert.equal(jobs.find(x => x.id === 'b3').status, JOB.PENDING);
  assert(audits.some(x => x.event === 'jobs-bulk-processed-now'));
  const home = fs.readFileSync(path.join(root, 'src/ui/app/pages/home.js'), 'utf8'),
    events = fs.readFileSync(path.join(root, 'src/ui/app/app-events.js'), 'utf8'),
    worker = fs.readFileSync(path.join(root, 'src/background/service-worker.js'), 'utf8'),
    rules = fs.readFileSync(path.join(root, 'src/ui/app/pages/rules.js'), 'utf8');
  assert(home.includes('data-action="process-job"') && home.includes('data-action="process-issue-jobs"') && home.includes('data-action="process-all-jobs"'));
  assert(events.includes('MESSAGE.PROCESS_JOB') && events.includes('MESSAGE.PROCESS_JOBS'));
  assert(worker.includes('MESSAGE.PROCESS_JOB') && worker.includes('MESSAGE.PROCESS_JOBS'));
  assert(rules.includes('manualProcess.relativeSchedule') && rules.includes('Relative update') && rules.includes('Preserve schedule'));
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
  console.log('v207-process-now-smart-preflight-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
