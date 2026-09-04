const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/validators.js'
]) load(f);
const SD = SDCompanion;
let ledger = {};
SD.Storage = { getLedger: async () => ledger };
SD.Discovery = { normalizeIssue: x => x };
load('src/background/rule-engine.js');
const site = SD.Defaults.site({ id: 's', baseUrl: 'https://jira.example.test' }),
  p = SD.Defaults.profile('P', site);
site.auth.user = { key: 'me', name: 'me', displayName: 'Me' };
site.users = [site.auth.user];
const r = SD.Defaults.rule('R');
r.enabled = true;
r.schedule = { mode: 'always', scheduleIds: [] };
r.logic = { operator: 'AND', groups: [{ id: 'g', operator: 'AND', negate: false, conditions: [{ id: 'c', field: 'project', operator: 'equals', value: 'IT', values: [] }] }] };
r.actions = [{ ...SD.Defaults.action('comment'), templates: ['Hello {{issue.key}}'], selection: 'constant', delay: { mode: 'override', minSeconds: 0, maxSeconds: 0, unit: 'seconds' } }];
p.rules = [r];
const safety = { maxIssuesPerCycle: 1, maxActionsPerCycle: 1, maxCommentsPerHour: 1, maxAssignmentsPerHour: 10, maxTransitionsPerHour: 10 };
const issue = k => ({
  key: k,
  projectKey: 'IT',
  projectId: '1',
  projectName: 'IT',
  issueType: 'Task',
  issueTypeId: '2',
  status: 'Open',
  statusId: '1',
  summary: 'x',
  labels: [],
  components: [],
  updated: '2026-08-08T10:00:00Z',
  _sourceRuleIds: [r.id]
});
(async () => {
  let out = await SD.RuleEngine.planCycle(site, p, [issue('IT-1'), issue('IT-2')], new Date('2026-08-08T12:00:00Z'), { safety });
  assert.equal(out.plans.length, 1, 'global per-cycle limits');
  const key = out.plans[0].ledgerKey;
  ledger[key] = { at: new Date().toISOString(), profileId: p.id, ruleId: r.id, actionType: 'comment', status: 'executed' };
  out = await SD.RuleEngine.planCycle(site, p, [issue('IT-1')], new Date(), { safety });
  assert.equal(out.plans.length, 0, 'executed ledger must deduplicate');
  ledger = {};
  const twoActions = [
    { ...SD.Defaults.action('comment'), id: 'a1', templates: ['A'], selection: 'constant', delay: { mode: 'override', minSeconds: 0, maxSeconds: 0, unit: 'seconds' } },
    { ...SD.Defaults.action('comment'), id: 'a2', templates: ['B'], selection: 'constant', delay: { mode: 'override', minSeconds: 0, maxSeconds: 0, unit: 'seconds' } }
  ];
  r.actions = twoActions;
  out = await SD.RuleEngine.planCycle(site, p, [issue('IT-9')], new Date(), { safety: { ...safety, maxActionsPerCycle: 10 } });
  assert.equal(out.plans.length, 1, 'hourly cap must include actions planned in the same cycle');
  const sched = SD.Defaults.schedule('night');
  sched.id = 'night';
  sched.days = [6];
  sched.startTime = '22:00:00';
  sched.endTime = '23:00:00';
  sched.timeZone = 'UTC';
  p.schedules = [sched];
  r.schedule = { mode: 'scheduled', scheduleIds: ['night'] };
  assert.equal(SD.RuleEngine.ruleScheduleActive(p, r, new Date('2026-08-08T21:00:00Z')), false);
  assert.equal(SD.RuleEngine.ruleScheduleActive(p, r, new Date('2026-08-08T22:30:00Z')), true);
  r.schedule = { mode: 'scheduled', scheduleIds: [] };
  assert.equal(SD.RuleEngine.ruleScheduleActive(p, r, new Date()), false, 'scheduled rule with no schedules must fail closed');
  r.schedule = { mode: 'always', scheduleIds: [] };
  r.source = { filterIds: [], jql: '' };
  assert.equal(SD.RuleQuery.preview(r).hasConstraint, true);
  const r2 = SD.Defaults.rule('R2');
  r2.enabled = true;
  r2.logic = structuredClone(r.logic);
  r2.actions = [{ ...SD.Defaults.action('notification') }];
  r.conflict = { mode: SD.Constants.CONFLICT_MODE.STOP_LOWER, group: '' };
  r.actions = [twoActions[0]];
  p.rules = [r, r2];
  ledger = {};
  out = await SD.RuleEngine.planCycle(site, p, [issue('IT-3')], new Date(), { safety: { ...safety, maxCommentsPerHour: 10, maxActionsPerCycle: 10 } });
  assert(out.detections.some(d => d.ruleId === r.id));
  assert(!out.detections.some(d => d.ruleId === r2.id));
  console.log('architecture-safety-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
