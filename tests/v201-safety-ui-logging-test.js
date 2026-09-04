const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'),
  read = f => fs.readFileSync(path.join(root, f), 'utf8'),
  load = f => vm.runInThisContext(read(f), { filename: f });
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
load('src/shared/constants.js');
load('src/shared/utils.js');
const SD = SDCompanion, { ACTION, JOB } = SD.Constants;
assert.equal(SD.Constants.BUILD_VERSION, '2.2.1');
assert.equal(SD.Constants.SCHEMA_VERSION, 33);
const appHtml = read('src/ui/app/app.html'),
  sideHtml = read('src/ui/app/sidepanel.html'),
  home = read('src/ui/app/pages/home.js'),
  data = read('src/ui/app/pages/data.js'),
  settings = read('src/ui/app/pages/logs-more.js'),
  appearance = read('src/ui/app/pages/appearance.js'),
  core = read('src/ui/app/app-core.js'),
  sw = read('src/background/service-worker.js');
for (const html of [appHtml, sideHtml]) {
  assert(textIncludes(html, 'SD Companion V2'));
  assert(!textIncludes(html, 'V1 · API Automation'));
  assert(!textIncludes(html, 'API Automation'));
}
assert(!textIncludes(home, 'radar-world'));
assert(!textIncludes(home, 'radar-land'));
assert(textIncludes(home, 'radar radar-pro'));
assert(textIncludes(home, 'radar-sweep'));
assert(!textIncludes(home, 'classic-radar'));
assert(textIncludes(home, 'homeScheduleCard'));
assert(textIncludes(data, 'data-summary-table'));
assert(textIncludes(data, '<th>Project scope</th>'));
assert(!textIncludes(data, 'inventory-summary compact-summary'));
assert.equal((settings.match(/nav\('/g) || []).length, 4, 'Settings tabs should expose General, Automation, Security and System & Support');
assert(textIncludes(settings, 'System & Support'));
assert(textIncludes(settings, "link('logs','Logs')"));
assert(textIncludes(settings, "link('audit','Audit Journal')"));
for (const theme of ['emerald-glass', 'midnight-glass', 'graphite-glass', 'violet-glass', 'amber-glass', 'crimson-glass', 'ocean-glass', 'copper-glass'])
  assert(textIncludes(appearance, theme));
for (const retired of ['teal-glass', 'rose-glass', 'ice-glass', 'obsidian-glass', 'crimson-night'])
  assert(!textIncludes(appearance, `'${retired}'`));
assert(textIncludes(core, 'MESSAGE.LOG_UI_EVENT'));
assert(textIncludes(sw, 'case MESSAGE.LOG_UI_EVENT'));
assert(textIncludes(sw, "'ui-warning'"));
assert(textIncludes(sw, "'ui-error'"));
// Assignee "is empty" is the existing unassigned predicate.
load('src/shared/condition-registry.js');
load('src/shared/rule-query.js');
const rule = { source: { filterIds: [], jql: '' }, logic: { operator: 'AND', groups: [{ operator: 'AND', conditions: [{ field: 'assignee', operator: 'not-exists', values: [] }] }] } };
assert(/assignee\s+is\s+EMPTY/i.test(SD.RuleQuery.baseJql(rule)));
// Stale precondition errors must be represented as Cancelled, not Failed.
let jobs = [], ledger = {}, audits = [], logs = [], writes = 0, capturedExpected = null;
globalThis.chrome = {
  alarms: { create: async () => {}, clear: async () => true }, runtime: { getURL: x => x }, notifications: {
    create: async () => {
      writes++;
    }
  }
};
const r = { id: 'r', name: 'R', enabled: true, schedule: { mode: 'always', scheduleIds: [] } },
  profile = { id: 'p', siteId: 's', rules: [r], schedules: [] },
  site = { id: 's', priorities: [] };
SD.Storage = {
  getJobs: async () => jobs,
  saveJobs: async (v) => {
    jobs = v;
  },
  getLedger: async () => ledger,
  saveLedger: async (v) => {
    ledger = v;
  },
  appendAudit: async (x) => audits.push(x),
  appendLog: async (x) => logs.push(x),
  ensureState: async () => ({ jiraSites: [site], profiles: [profile], system: { completionToneEnabled: false } }),
  getCredential: async () => 'token'
};
SD.Audio = { play: async () => {}, completion: async () => {} };
SD.JiraApi = { JiraClient: function() {} };
SD.RuleEngine = {
  ruleScheduleActive: () => true,
  validateAction: async (_c, _j, _p, opt) => {
    capturedExpected = opt;
    throw Object.assign(new Error('Status changed: Open → In Progress.'), { code: 'ACTION_PRECONDITION_CHANGED' });
  }
};
load('src/background/job-queue.js');
(async () => {
  const base = {
    id: 'stale',
    siteId: 's',
    profileId: 'p',
    ruleId: 'r',
    ruleName: 'R',
    issueKey: 'IT-1',
    issueSnapshot: { summary: 'x', status: 'Open', statusId: '1' },
    expectedStatusId: '1',
    expectedStatusName: 'Open',
    action: ACTION.NOTIFICATION,
    actionId: 'a',
    payload: { notification: { title: 'T', message: 'M' } },
    ledgerKey: 'stale-k',
    scheduledAt: new Date().toISOString(),
    status: JOB.PENDING,
    attempts: 0
  };
  jobs = [base];
  const out = await SD.JobQueue.process(base.id);
  assert.equal(out.status, JOB.CANCELLED);
  assert.equal(out.error.code, 'ACTION_PRECONDITION_CHANGED');
  assert.equal(out.error.message, 'Status changed: Open → In Progress.');
  assert.equal(writes, 0);
  assert.equal(ledger['stale-k'].status, 'cancelled');
  assert(audits.some(x => x.event === 'action-cancelled-stale'));
  assert(logs.some(x => x.level === 'warn' && /cancelled/i.test(x.message)));
  // A chained action should validate against the successful predecessor transition's resulting status.
  SD.RuleEngine.validateAction = async (_c, _j, _p, opt) => {
    capturedExpected = opt;
    return { key: 'IT-1', status: 'In Progress', statusId: '2' };
  };
  const dep = {
    ...base,
    id: 'dep',
    action: ACTION.TRANSITION,
    status: JOB.SUCCEEDED,
    completedAt: new Date(Date.now() - 10000).toISOString(),
    result: { toStatusId: '2', toStatus: 'In Progress' },
    ledgerKey: 'dep-k'
  };
  const child = { ...base, id: 'child', actionId: 'child-a', ledgerKey: 'child-k', dependsOnJobId: 'dep', dependencyDelaySeconds: 0, status: JOB.PENDING };
  jobs = [dep, child];
  writes = 0;
  const childOut = await SD.JobQueue.process('child');
  assert.equal(childOut.status, JOB.SUCCEEDED);
  assert.equal(capturedExpected.expectedStatusId, '2');
  assert.equal(capturedExpected.expectedStatusName, 'In Progress');
  assert.equal(writes, 1);
  console.log('v201-safety-ui-logging-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
