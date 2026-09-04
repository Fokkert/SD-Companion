const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const root = path.join(__dirname, '..'),
  load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
load('src/shared/defaults.js');
load('src/shared/condition-registry.js');
load('src/shared/rule-query.js');
const SD = SDCompanion, C = SD.Constants;
assert.equal(C.DISPLAY_VERSION, 'V2');
assert.equal(C.BUILD_VERSION, '2.2.1');
assert.equal(C.SCHEMA_VERSION, 33);
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version, '2.2.1');
for (const t of ['emerald-glass', 'midnight-glass', 'graphite-glass', 'violet-glass', 'amber-glass', 'crimson-glass', 'ocean-glass', 'copper-glass']) assert(Object.values(C.THEME).includes(t));
assert.equal(Object.values(C.THEME).length, 8);
const site = {
  fields: [
    { id: 'customfield_10001', name: 'Story points', searchable: true, schema: { type: 'number', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float' } },
    { id: 'customfield_10002', name: 'Due review', searchable: true, schema: { type: 'date', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:datepicker' } },
    { id: 'customfield_10003', name: 'Approval note', searchable: true, schema: { type: 'string' } },
    { id: 'customfield_10004', name: 'Approved', searchable: true, schema: { type: 'boolean' } },
    { id: 'customfield_10005', name: 'Owner', searchable: true, schema: { type: 'user', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:userpicker' } },
    { id: 'customfield_10006', name: 'Tags', searchable: true, schema: { type: 'array', items: 'option', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:multiselect' } }
  ]
};
assert.equal(SD.ConditionRegistry.get('customfield_10001', site).kind, 'number');
assert(SD.ConditionRegistry.get('customfield_10001', site).operators.includes('gt'));
assert.equal(SD.ConditionRegistry.get('customfield_10002', site).kind, 'date');
assert(SD.ConditionRegistry.get('customfield_10002', site).operators.includes('before'));
assert.equal(SD.ConditionRegistry.get('customfield_10003', site).kind, 'text');
assert(SD.ConditionRegistry.get('customfield_10003', site).operators.includes('contains'));
assert.equal(SD.ConditionRegistry.get('customfield_10004', site).kind, 'boolean');
assert.equal(SD.ConditionRegistry.get('customfield_10005', site).kind, 'choices');
assert.equal(SD.ConditionRegistry.get('customfield_10006', site).array, true);
const stored = { field: 'customfield_10001', operator: 'gt', value: '4', values: [], fieldKind: 'number', jqlField: 'cf[10001]', fieldSchema: { type: 'number' } };
SD.ConditionRegistry.normalizeCondition(stored);
assert.equal(stored.operator, 'gt', 'dynamic typed operator must survive migration without live site metadata');
assert.equal(SD.RuleQuery.clause(stored), 'cf[10001] > 4');
SD.Schedule = { matchesAny: () => true };
SD.Storage = { getLedger: async () => ({}) };
load('src/background/rule-engine.js');
const numeric = {
  key: 'IT-1',
  projectKey: 'IT',
  projectId: '1',
  projectName: 'IT',
  issueType: 'Incident',
  issueTypeId: '10',
  status: 'Open',
  statusId: '1',
  fields: {
    customfield_10001: 8,
    customfield_10002: '2026-08-10',
    customfield_10003: 'Alpha Beta',
    customfield_10004: true,
    customfield_10005: { name: 'agent', displayName: 'Agent' },
    customfield_10006: [{ id: '1', value: 'Blue' }, { id: '2', value: 'Green' }]
  }
};
assert(SD.RuleEngine.matchesLogic(numeric, {
  operator: 'AND',
  groups: [
    {
      operator: 'AND',
      conditions: [
        { field: 'customfield_10001', operator: 'gt', value: '7' },
        { field: 'customfield_10002', operator: 'before', value: '2026-08-11' },
        { field: 'customfield_10003', operator: 'contains', value: 'beta' },
        { field: 'customfield_10004', operator: 'equals', value: 'true' },
        { field: 'customfield_10005', operator: 'equals', value: 'agent' },
        { field: 'customfield_10006', operator: 'contains-all', values: ['Blue', 'Green'] }
      ]
    }
  ]
}));
const rf = { logic: { groups: [{ conditions: [{ field: 'customfield_10001' }] }] }, actions: [{ when: { enabled: true, logic: { groups: [{ conditions: [{ field: 'customfield_10002' }] }] } } }] };
assert(SD.RuleEngine.requiredIssueFields(rf).includes('customfield_10001'));
assert(SD.RuleEngine.requiredIssueFields(rf).includes('customfield_10002'));
(async () => {
  const profile = SD.Defaults.profile('P');
  profile.id = 'p';
  profile.siteId = 's';
  profile.schedules = [];
  const rule = SD.Defaults.rule('R');
  rule.id = 'r';
  rule.enabled = true;
  rule.logic = { operator: 'AND', groups: [] };
  rule.randomDelay = { minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  const a1 = SD.Defaults.action(C.ACTION.NOTIFICATION);
  a1.id = 'a1';
  a1.delay = { mode: 'override', minSeconds: 10, maxSeconds: 10, unit: 'seconds' };
  const a2 = SD.Defaults.action(C.ACTION.NOTIFICATION);
  a2.id = 'a2';
  a2.delay = { mode: 'override', minSeconds: 20, maxSeconds: 20, unit: 'seconds' };
  const a3 = SD.Defaults.action(C.ACTION.NOTIFICATION);
  a3.id = 'a3';
  a3.delay = { mode: 'after-previous', minSeconds: 7, maxSeconds: 7, unit: 'seconds' };
  const a4 = SD.Defaults.action(C.ACTION.ASSIGN);
  a4.id = 'a4';
  a4.mode = C.ASSIGN_MODE.UNASSIGN;
  a4.delay = { mode: 'inherit', minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
  const a5 = SD.Defaults.action(C.ACTION.NOTIFICATION);
  a5.id = 'a5';
  a5.when = { enabled: true, logic: { operator: 'AND', groups: [{ operator: 'AND', conditions: [{ field: 'status', operator: 'equals', value: 'Closed', values: [] }] }] } };
  rule.actions = [a1, a2, a3, a4, a5];
  profile.rules = [rule];
  const at = new Date('2026-08-12T10:00:00.000Z'), site2 = { id: 's', users: [], priorities: [] };
  let out = await SD.RuleEngine.planCycle(site2, profile, [numeric], at, { safety: SD.Defaults.safety() });
  assert.equal(out.plans.length, 4, 'action-level condition should exclude the Closed-only action');
  const byId = Object.fromEntries(out.plans.map(j => [j.actionId, j]));
  assert.equal(new Date(byId.a1.scheduledAt).getTime(), at.getTime() + 10000, 'ordinary delay must be relative to detection time');
  assert.equal(new Date(byId.a2.scheduledAt).getTime(), at.getTime() + 20000, 'ordinary actions must not be cumulatively delayed');
  assert.equal(byId.a3.dependsOnJobId, byId.a2.id, 'after-previous must depend on the immediately preceding planned action');
  assert.equal(byId.a3.dependencyDelaySeconds, 7);
  assert.equal(byId.a4.payload.unassign, true, 'unassign must be an explicit action payload');
  const rr = SD.Defaults.rule('Random');
  rr.id = 'rr';
  rr.enabled = true;
  rr.logic = { operator: 'AND', groups: [] };
  rr.actionRandomness = { enabled: true, pools: [{ id: 'pool', name: 'Pool', pickCount: 2 }] };
  rr.actions = [1, 2, 3, 4].map(n => {
    const a = SD.Defaults.action(C.ACTION.NOTIFICATION);
    a.id = 'p' + n;
    a.randomPoolId = 'pool';
    a.delay = { mode: 'inherit', minSeconds: 0, maxSeconds: 0, unit: 'seconds' };
    return a;
  });
  profile.rules = [rr];
  out = await SD.RuleEngine.planCycle(site2, profile, [numeric], at, { safety: SD.Defaults.safety() });
  assert.equal(out.plans.length, 2, 'random pool must select configured number of matching actions');
  assert(out.plans.every(j => /^p[1-4]$/.test(j.actionId)));
  console.log('v2-feature-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
