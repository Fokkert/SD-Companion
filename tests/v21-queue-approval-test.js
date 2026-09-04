const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');

globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};

const root = path.join(__dirname, '..');
const load = file => vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
load('src/shared/constants.js');
load('src/shared/utils.js');

const SD = SDCompanion;
const { ACTION, JOB } = SD.Constants;
let jobs = [], ledger = {}, audits = [], logs = [], createdAlarms = [], clearedAlarms = [];

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (fn, ms) => ({ fn, ms });
globalThis.clearTimeout = () => {};

globalThis.chrome = {
  alarms: {
    create: async (name, options) => createdAlarms.push({ name, options }),
    clear: async name => {
      clearedAlarms.push(name);
      return true;
    }
  },
  runtime: { getURL: value => value },
  notifications: { create: async () => {} }
};

SD.Storage = {
  getJobs: async () => structuredClone(jobs),
  saveJobs: async value => { jobs = structuredClone(value); },
  getLedger: async () => structuredClone(ledger),
  saveLedger: async value => { ledger = structuredClone(value); },
  appendAudit: async value => audits.push(structuredClone(value)),
  appendLog: async value => logs.push(structuredClone(value))
};
SD.RuleEngine = {};
SD.Audio = { play: async () => true, completion: async () => true };
SD.JiraApi = { JiraClient: function() {} };
load('src/background/job-queue.js');

const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const baseJob = (id, action = ACTION.ALARM) => ({
  id,
  siteId: 's',
  profileId: 'p',
  ruleId: 'r',
  ruleName: 'Rule',
  actionId: `${id}-action`,
  action,
  issueKey: `IT-${id}`,
  status: JOB.AWAITING_APPROVAL,
  approvalRequired: true,
  approvedAt: null,
  scheduledAt: future(),
  createdAt: new Date().toISOString(),
  payload: action === ACTION.ALARM ? { alarm: {} } : { notification: { title: 'T', message: 'M' } }
});

(async () => {
  // A single approved future action becomes Pending and retains its scheduled time.
  const single = baseJob('1');
  jobs = [single];
  const originalDue = single.scheduledAt;
  createdAlarms = [];
  const approved = await SD.JobQueue.approve(single.id);
  assert.equal(approved.status, JOB.PENDING);
  assert.equal(approved.scheduledAt, originalDue);
  assert(approved.approvedAt);
  assert.equal(jobs[0].status, JOB.PENDING);
  assert.equal(createdAlarms.length, 1, 'an independent approved job should be armed');

  // Approve-all must arm the chain root but leave its dependent child waiting
  // until dependency resolution wakes it.
  const parent = baseJob('2');
  const child = { ...baseJob('3'), dependsOnJobId: parent.id, dependencyScheduled: false };
  jobs = [parent, child];
  createdAlarms = [];
  const bulk = await SD.JobQueue.approvePending({ siteId: 's', profileId: 'p' });
  assert.equal(bulk.approved, 2);
  assert(jobs.every(job => job.status === JOB.PENDING));
  assert.equal(createdAlarms.length, 1, 'only the independent chain root should be armed by bulk approval');
  assert(createdAlarms[0].name.endsWith(parent.id));

  // Global alarm stop cancels all queued alarm jobs, including approval-gated
  // ones, without cancelling browser-notification jobs.
  const pendingAlarm = { ...baseJob('4'), status: JOB.PENDING, approvalRequired: false, approvedAt: new Date().toISOString() };
  const approvalAlarm = baseJob('5');
  const notification = { ...baseJob('6', ACTION.NOTIFICATION), status: JOB.PENDING, approvalRequired: false, approvedAt: new Date().toISOString() };
  jobs = [pendingAlarm, approvalAlarm, notification];
  const stopped = await SD.JobQueue.cancelLocalAlerts({ actionTypes: [ACTION.ALARM] });
  assert.equal(stopped.cancelled, 2);
  assert.equal(jobs.find(job => job.id === '4').status, JOB.CANCELLED);
  assert.equal(jobs.find(job => job.id === '5').status, JOB.CANCELLED);
  assert.equal(jobs.find(job => job.id === '6').status, JOB.PENDING);

  assert(audits.some(entry => entry.event === 'job-approved'));
  assert(audits.some(entry => entry.event === 'jobs-bulk-approved'));
  assert(audits.some(entry => entry.event === 'local-alerts-cancelled'));

  console.log('v21-queue-approval-test: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
});
