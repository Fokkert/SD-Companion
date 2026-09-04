const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of ['src/shared/constants.js', 'src/shared/utils.js'])
  vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
const SD = SDCompanion, { ACTION, JOB } = SD.Constants;
const homeUi = fs.readFileSync('src/ui/app/pages/home.js', 'utf8'),
  eventsUi = fs.readFileSync('src/ui/app/app-events.js', 'utf8'),
  workerUi = fs.readFileSync('src/background/service-worker.js', 'utf8');
assert(textIncludes(homeUi, 'data-action=\"cancel-job\"'), 'Home queue must render a per-action Cancel control.');
assert(textIncludes(eventsUi, 'MESSAGE.CANCEL_JOB'), 'UI must send CANCEL_JOB to the worker.');
assert(textIncludes(workerUi, 'MESSAGE.GET_JOBS:return{ok:true,jobs:await SD.JobQueue.list()}'), 'GET_JOBS must expose in-memory running cancellation intent without racing persistent job state.');
let jobs = [], ledger = {}, audits = [], comments = 0, cleared = [];
const clone = v => structuredClone(v);
globalThis.chrome = {
  alarms: {
    create: async () => {}, clear: async (n) => {
      cleared.push(n);
      return true;
    }
  }, runtime: { getURL: x => x }, notifications: { create: async () => {} }
};
const rule = { id: 'r', name: 'R', enabled: true, schedule: { mode: 'always', scheduleIds: [] } },
  profile = { id: 'p', siteId: 's', rules: [rule], schedules: [] },
  site = { id: 's', priorities: [] };
SD.Storage = {
  getJobs: async () => clone(jobs),
  saveJobs: async (v) => {
    jobs = clone(v);
  },
  getLedger: async () => clone(ledger),
  saveLedger: async (v) => {
    ledger = clone(v);
  },
  appendAudit: async (e) => {
    audits.push(clone(e));
  },
  ensureState: async () => ({ jiraSites: [site], profiles: [profile], system: { safety: {}, completionToneEnabled: false } }),
  getCredential: async () => 'token'
};
SD.RuleEngine = { ruleScheduleActive: () => true, validateAction: async () => ({ key: 'IT-1' }) };
SD.Audio = { play: async () => {}, completion: async () => {} };
SD.JiraApi = {
  JiraClient: function() {
    this.comment = async () => {
      comments++;
    };
  }
};
vm.runInThisContext(fs.readFileSync('src/background/job-queue.js', 'utf8'), { filename: 'job-queue' });
const mk = (id, key = 'IT-1') => ({
  id,
  siteId: 's',
  profileId: 'p',
  ruleId: 'r',
  ruleName: 'R',
  issueKey: key,
  issueSnapshot: { summary: 'x' },
  action: ACTION.COMMENT,
  actionId: `a-${id}`,
  payload: { comment: 'hello' },
  ledgerKey: `k-${id}`,
  createdAt: new Date().toISOString(),
  scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  status: JOB.PENDING,
  attempts: 0
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
(async () => {
  // A queued action is cancelled immediately, unscheduled, and remains suppressed by the execution ledger.
  const pending = mk('pending');
  await SD.JobQueue.enqueue([pending]);
  const cancelled = await SD.JobQueue.cancel('pending');
  assert.equal(cancelled.status, JOB.CANCELLED);
  assert.equal(jobs.find(x => x.id === 'pending').status, JOB.CANCELLED);
  assert.equal(ledger['k-pending'].status, 'cancelled');
  await SD.JobQueue.process('pending');
  assert.equal(comments, 0);
  assert(audits.some(x => x.event === 'job-cancelled' && x.details?.jobId === 'pending'));
  // A running action can be cancelled while it is still doing read-only preflight work.
  const preflight = mk('preflight', 'IT-2');
  jobs.push(preflight);
  ledger['k-preflight'] = { status: 'queued', jobId: 'preflight', at: new Date().toISOString() };
  const entered = deferred(), gate = deferred();
  SD.RuleEngine.validateAction = async () => {
    entered.resolve();
    return gate.promise;
  };
  const runPreflight = SD.JobQueue.process('preflight');
  await entered.promise;
  const requested = await SD.JobQueue.cancel('preflight');
  assert.equal(requested.status, JOB.RUNNING);
  assert(requested.cancelRequestedAt);
  gate.resolve({ key: 'IT-2' });
  const preflightResult = await runPreflight;
  assert.equal(preflightResult.status, JOB.CANCELLED);
  assert.equal(jobs.find(x => x.id === 'preflight').status, JOB.CANCELLED);
  assert.equal(ledger['k-preflight'].status, 'cancelled');
  assert.equal(comments, 0);
  // Once a Jira write is actually dispatched, cancellation is refused rather than falsely reporting success.
  const dispatched = mk('dispatched', 'IT-3');
  jobs.push(dispatched);
  ledger['k-dispatched'] = { status: 'queued', jobId: 'dispatched', at: new Date().toISOString() };
  const writeEntered = deferred(), writeGate = deferred();
  SD.RuleEngine.validateAction = async () => ({ key: 'IT-3' });
  SD.JiraApi.JiraClient = function() {
    this.comment = async () => {
      comments++;
      writeEntered.resolve();
      await writeGate.promise;
    };
  };
  const runDispatched = SD.JobQueue.process('dispatched');
  await writeEntered.promise;
  await assert.rejects(() => SD.JobQueue.cancel('dispatched'), e => e?.code === 'ACTION_ALREADY_DISPATCHED');
  writeGate.resolve();
  const dispatchedResult = await runDispatched;
  assert.equal(dispatchedResult.status, JOB.SUCCEEDED);
  assert.equal(ledger['k-dispatched'].status, 'executed');
  assert.equal(comments, 1);
  assert(audits.some(x => x.event === 'job-cancel-rejected' && x.details?.jobId === 'dispatched'));
  console.log('v1521-job-cancellation-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
