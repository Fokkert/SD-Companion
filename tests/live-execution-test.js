const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of ['src/shared/constants.js', 'src/shared/utils.js']) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
const SD = SDCompanion, { ACTION, JOB } = SD.Constants;
let jobs = [], ledger = {}, comments = 0, credentialReads = 0;
globalThis.chrome = { alarms: { create: async () => {}, clear: async () => true }, runtime: { getURL: x => x }, notifications: { create: async () => {} } };
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
  appendAudit: async () => {},
  ensureState: async () => ({ jiraSites: [site], profiles: [profile], system: { safety: {} } }),
  getCredential: async () => {
    credentialReads++;
    return 'token';
  }
};
SD.RuleEngine = { ruleScheduleActive: () => true, validateAction: async () => ({ key: 'IT-1' }) };
SD.Audio = { play: async () => {} };
SD.JiraApi = {
  JiraClient: function() {
    this.comment = async () => {
      comments++;
    };
  }
};
vm.runInThisContext(fs.readFileSync('src/background/job-queue.js', 'utf8'), { filename: 'job-queue' });
const job = {
  id: 'live',
  siteId: 's',
  profileId: 'p',
  ruleId: 'r',
  ruleName: 'R',
  issueKey: 'IT-1',
  issueSnapshot: { summary: 'x' },
  action: ACTION.COMMENT,
  actionId: 'a',
  payload: { comment: 'hello' },
  ledgerKey: 'k',
  scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  status: JOB.PENDING,
  attempts: 0
};
(async () => {
  await SD.JobQueue.enqueue([job]);
  assert.equal(jobs[0].status, JOB.PENDING);
  await SD.JobQueue.process('live');
  assert.equal(comments, 1);
  assert.equal(credentialReads, 1);
  assert.equal(jobs[0].status, JOB.SUCCEEDED);
  assert.equal(ledger.k.status, 'executed');
  console.log('live-execution-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
