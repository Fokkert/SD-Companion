const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const root = path.join(__dirname, '..'),
  load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
const SD = SDCompanion, { ACTION, JOB } = SD.Constants;
let jobs = [], ledger = {}, notifications = 0, audits = [];
globalThis.chrome = {
  alarms: { create: async () => {}, clear: async () => true }, runtime: { getURL: x => x }, notifications: {
    create: async () => {
      notifications++;
    }
  }
};
const rule = { id: 'r', name: 'R', enabled: true, schedule: { mode: 'always', scheduleIds: [] } },
  profile = { id: 'p', siteId: 's', rules: [rule], schedules: [] },
  site = { id: 's', priorities: [] };
SD.Storage = {
  getJobs: async () => jobs,
  saveJobs: async v => {
    jobs = v;
  },
  getLedger: async () => ledger,
  saveLedger: async v => {
    ledger = v;
  },
  appendAudit: async x => {
    audits.push(x);
  },
  ensureState: async () => ({ jiraSites: [site], profiles: [profile], system: { completionToneEnabled: false } }),
  getCredential: async () => 'token'
};
SD.RuleEngine = { ruleScheduleActive: () => true, validateAction: async () => ({ key: 'IT-1' }) };
SD.Audio = { play: async () => {}, completion: async () => {} };
SD.JiraApi = { JiraClient: function() {} };
load('src/background/job-queue.js');
const base = {
  siteId: 's',
  profileId: 'p',
  ruleId: 'r',
  ruleName: 'R',
  issueKey: 'IT-1',
  issueSnapshot: { summary: 'x' },
  action: ACTION.NOTIFICATION,
  actionId: 'a',
  payload: { notification: { title: 'T', message: 'M' } },
  scheduledAt: new Date().toISOString(),
  status: JOB.PENDING,
  attempts: 0
};
(async () => {
  jobs = [
    { ...base, id: 'dep-fail', status: JOB.FAILED, completedAt: new Date().toISOString(), ledgerKey: 'dep-fail' },
    {
      ...base,
      id: 'child-skip',
      actionId: 'child-skip',
      ledgerKey: 'child-skip',
      dependsOnJobId: 'dep-fail',
      dependencyDelaySeconds: 0,
      dependencyPolicy: { failed: 'stop', cancelled: 'continue', skipped: 'continue' }
    }
  ];
  let r = await SD.JobQueue.process('child-skip');
  assert.equal(r.status, JOB.CANCELLED);
  assert.equal(notifications, 0);
  assert.equal(ledger['child-skip'].status, 'cancelled');
  assert(audits.some(x => x.event === 'action-cancelled-dependency'));
  jobs = [
    { ...base, id: 'dep-ok', status: JOB.SUCCEEDED, completedAt: new Date(Date.now() - 5000).toISOString(), ledgerKey: 'dep-ok' },
    { ...base, id: 'child-ok', actionId: 'child-ok', ledgerKey: 'child-ok', dependsOnJobId: 'dep-ok', dependencyDelaySeconds: 1 }
  ];
  r = await SD.JobQueue.process('child-ok');
  assert.equal(r.status, JOB.SUCCEEDED);
  assert.equal(notifications, 1, 'dependent action should execute only after predecessor success and relative delay');
  assert.equal(ledger['child-ok'].status, 'executed');
  console.log('v2-job-dependency-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
