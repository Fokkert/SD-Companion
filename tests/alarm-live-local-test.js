const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of ['src/shared/constants.js', 'src/shared/utils.js']) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
const SD = SDCompanion, { ACTION, JOB } = SD.Constants;
let jobs = [], ledger = {}, audioPlays = 0, credentialReads = 0;
globalThis.chrome = { alarms: { create: async () => {}, clear: async () => true }, runtime: { getURL: x => x }, notifications: { create: async () => {} } };
const rule = { id: 'r1', name: 'Alarm rule', enabled: true, schedule: { mode: 'always', scheduleIds: [] } },
  profile = { id: 'p1', siteId: 's1', rules: [rule], schedules: [] },
  site = { id: 's1', priorities: [] };
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
  ensureState: async () => ({ jiraSites: [site], profiles: [profile] }),
  getCredential: async () => {
    credentialReads++;
    return 'token';
  }
};
SD.RuleEngine = { ruleScheduleActive: () => true, validateAction: async () => ({ key: 'IT-1', summary: 'x', status: 'Open', statusId: '1' }) };
SD.Audio = {
  play: async () => {
    audioPlays++;
  }
};
SD.JiraApi = { JiraClient: function() {} };
vm.runInThisContext(fs.readFileSync('src/background/job-queue.js', 'utf8'), { filename: 'job-queue.js' });
const alarm = {
  id: 'a1',
  siteId: 's1',
  profileId: 'p1',
  ruleId: 'r1',
  ruleName: 'Alarm rule',
  issueKey: 'IT-1',
  action: ACTION.ALARM,
  actionId: 'aa',
  payload: { alarm: { preset: 'radar', durationSeconds: 1 } },
  ledgerKey: 'ka',
  scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  status: JOB.PENDING,
  attempts: 0
};
(async () => {
  await SD.JobQueue.enqueue([alarm]);
  await SD.JobQueue.process('a1');
  assert.equal(audioPlays, 1);
  assert.equal(credentialReads, 1, 'alarm actions must revalidate Jira state before firing');
  assert.equal(jobs[0].status, JOB.SUCCEEDED);
  assert.equal(ledger.ka.status, 'executed');
  console.log('alarm-live-local-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
