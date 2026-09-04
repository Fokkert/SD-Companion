const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const { textIncludes } = require('./source-assertions');

globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};

const rootDir = path.join(__dirname, '..');
const load = file => vm.runInThisContext(fs.readFileSync(path.join(rootDir, file), 'utf8'), { filename: file });
const source = file => fs.readFileSync(path.join(rootDir, file), 'utf8');

for (const file of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/validators.js'
]) load(file);

const SD = SDCompanion;
const { ACTION, JOB, MESSAGE } = SD.Constants;

assert.equal(SD.Constants.BUILD_VERSION, '2.1.0');
assert.equal(SD.Constants.SCHEMA_VERSION, 33);
assert.equal(JOB.AWAITING_APPROVAL, 'awaiting-approval');
assert.equal(MESSAGE.PREVIEW_BULK_OPERATION, 'PREVIEW_BULK_OPERATION');
assert.equal(MESSAGE.RUN_BULK_OPERATION, 'RUN_BULK_OPERATION');
assert.equal(MESSAGE.APPROVE_JOB, 'APPROVE_JOB');
assert.equal(MESSAGE.APPROVE_JOBS, 'APPROVE_JOBS');

const defaultAction = SD.Defaults.action(ACTION.COMMENT);
assert.equal(defaultAction.needsApproval, false, 'approval must be opt-in per action');
const defaultRule = SD.Defaults.rule('R');
assert.deepEqual(defaultRule.alertThrottle, { enabled: false, maxAlerts: 1, windowMinutes: 5 }, 'alert throttling should be configurable and disabled by default');

let existingJobs = [];
SD.Storage = {
  getLedger: async () => ({}),
  getJobs: async () => structuredClone(existingJobs)
};
SD.Discovery = { normalizeIssue: issue => issue };
load('src/background/rule-engine.js');

const site = SD.Defaults.site({ id: 's', baseUrl: 'https://jira.example.test' });
const profile = SD.Defaults.profile('P', site);
const issue = key => ({
  key,
  projectKey: 'IT',
  projectId: '1',
  projectName: 'IT',
  issueType: 'Task',
  issueTypeId: '2',
  status: 'Open',
  statusId: '1',
  summary: `Issue ${key}`,
  labels: [],
  components: [],
  fields: {},
  updated: '2026-09-04T10:00:00Z'
});

const makeRule = (name = 'R') => {
  const rule = SD.Defaults.rule(name);
  rule.enabled = true;
  rule.schedule = { mode: 'always', scheduleIds: [] };
  rule.logic = { operator: 'AND', groups: [] };
  rule.randomDelay = { minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  return rule;
};

(async () => {
  // Needs approval must be a queue state, not merely a UI decoration.
  const approvalRule = makeRule('Approval rule');
  const approvalAction = SD.Defaults.action(ACTION.NOTIFICATION);
  approvalAction.needsApproval = true;
  approvalAction.delay = { mode: 'override', minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  approvalRule.actions = [approvalAction];
  profile.rules = [approvalRule];
  let result = await SD.RuleEngine.planCycle(site, profile, [issue('IT-1')], new Date('2026-09-04T12:00:00Z'));
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].status, JOB.AWAITING_APPROVAL);
  assert.equal(result.plans[0].approvalRequired, true);
  assert.equal(result.plans[0].approvedAt, null);

  // One rule can cap Alarm + Notification actions across multiple matching issues.
  const alertRule = makeRule('Throttled alerts');
  alertRule.alertThrottle = { enabled: true, maxAlerts: 1, windowMinutes: 5 };
  const alarm = SD.Defaults.action(ACTION.ALARM);
  alarm.delay = { mode: 'override', minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  alertRule.actions = [alarm];
  profile.rules = [alertRule];
  existingJobs = [];
  result = await SD.RuleEngine.planCycle(site, profile, [issue('IT-2'), issue('IT-3')], new Date('2026-09-04T12:00:00Z'));
  assert.equal(result.plans.length, 1, 'per-rule alert throttling must stop an alert flood in the same planning cycle');

  // Existing recent local-alert jobs count against the rolling window as well.
  existingJobs = [{
    id: 'old-alert',
    siteId: site.id,
    profileId: profile.id,
    ruleId: alertRule.id,
    action: ACTION.NOTIFICATION,
    status: JOB.SUCCEEDED,
    createdAt: '2026-09-04T11:58:00.000Z'
  }];
  result = await SD.RuleEngine.planCycle(site, profile, [issue('IT-4')], new Date('2026-09-04T12:00:00Z'));
  assert.equal(result.plans.length, 0, 'recent local-alert history must count toward the rule throttle');

  // Throttling uses the alert's due/play time, not merely the time the job was created.
  existingJobs = [{
    id: 'future-alert',
    siteId: site.id,
    profileId: profile.id,
    ruleId: alertRule.id,
    action: ACTION.ALARM,
    status: JOB.PENDING,
    createdAt: '2026-09-04T11:59:00.000Z',
    scheduledAt: '2026-09-04T13:00:00.000Z'
  }];
  result = await SD.RuleEngine.planCycle(site, profile, [issue('IT-4B')], new Date('2026-09-04T12:00:00Z'));
  assert.equal(result.plans.length, 1, 'a far-future scheduled alert must not consume the current throttle window');

  // Bulk operations use a transient rule snapshot and a unique one-time ledger key.
  const bulkRule = makeRule('Bulk operation');
  bulkRule.id = 'bulk-test';
  const bulkAction = SD.Defaults.action(ACTION.COMMENT);
  bulkAction.templates = ['Bulk {{issue.key}}'];
  bulkAction.selection = 'constant';
  bulkAction.delay = { mode: 'override', minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  bulkRule.actions = [bulkAction];
  existingJobs = [];
  result = await SD.RuleEngine.planOneTime(site, profile, bulkRule, [issue('IT-5')], 'operation-123', new Date('2026-09-04T12:00:00Z'));
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].sourceType, 'bulk-operation');
  assert.equal(result.plans[0].bulkOperationId, 'operation-123');
  assert(result.plans[0].ruleSnapshot, 'bulk jobs must carry their transient definition for later preflight/execution');
  assert(result.plans[0].ledgerKey.startsWith('bulk:'), 'bulk operations must not reuse normal rule dedupe keys');

  // Source contracts for the queue/service/UI integration added in v2.1.0.
  const queue = source('src/background/job-queue.js');
  const worker = source('src/background/service-worker.js');
  const home = source('src/ui/app/pages/home.js');
  const bulkPage = source('src/ui/app/pages/bulk-operations.js');
  const actions = source('src/ui/app/pages/rule-actions.js');
  const rules = source('src/ui/app/pages/rules.js');

  assert(textIncludes(queue, 'const approve=async id=>'));
  assert(textIncludes(queue, 'const approvePending=async'));
  assert(textIncludes(queue, 'const cancelLocalAlerts=async'));
  assert(textIncludes(queue, "const notificationId='sd-companion-action-notification'"));
  assert(textIncludes(worker, 'const stopAllUserAlarms=async()=>'));
  assert(textIncludes(worker, 'await SD.JobQueue.cancelLocalAlerts'));
  assert(textIncludes(worker, 'await SD.Audio.cancelAll()'));
  assert(textIncludes(home, 'Approve all'));
  assert(textIncludes(home, 'Show completed'));
  assert(textIncludes(bulkPage, 'Bulk Operations'));
  assert(textIncludes(bulkPage, 'Preview matches'));
  assert(textIncludes(bulkPage, 'Run now'));
  assert(textIncludes(actions, 'needsApproval'));
  assert(textIncludes(rules, 'alertThrottle.enabled'));
  assert(textIncludes(rules, 'alertThrottle.maxAlerts'));
  assert(textIncludes(rules, 'alertThrottle.windowMinutes'));

  console.log('v21-bulk-approval-alerts-test: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
