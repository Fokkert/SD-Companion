const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/condition-registry.js', 'src/shared/rule-query.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion;
SD.Storage = { getLedger: async () => ({}) };
const normUser = u => u ? { key: u.key || u.name || '', name: u.name || u.key || '', displayName: u.displayName || u.name || u.key || '' } : null;
SD.Discovery = {
  normalizeIssue: i => ({
    key: i.key,
    status: i.fields.status.name,
    statusId: String(i.fields.status.id),
    projectKey: i.fields.project.key,
    projectId: String(i.fields.project.id),
    projectName: i.fields.project.name,
    issueType: i.fields.issuetype.name,
    issueTypeId: String(i.fields.issuetype.id),
    summary: i.fields.summary || '',
    description: '',
    assignee: normUser(i.fields.assignee),
    reporter: null,
    priority: i.fields.priority?.name || '',
    priorityId: String(i.fields.priority?.id || ''),
    resolution: '',
    resolutionId: '',
    labels: i.fields.labels || [],
    components: [],
    fields: i.fields,
    updated: i.fields.updated || ''
  })
};
load('src/background/rule-engine.js');
const makeRaw = ({ status = 'Open', statusId = '1', assignee = null, priorityId = '3', priority = 'Medium', labels = [] } = {}) => ({
  key: 'IT-1',
  fields: {
    status: { id: statusId, name: status },
    project: { id: '10', key: 'IT', name: 'IT' },
    issuetype: { id: '100', name: 'Incident' },
    summary: 'x',
    updated: '2026-08-12T12:00:00.000+0000',
    assignee,
    priority: { id: priorityId, name: priority },
    labels
  }
});
const baseRule = action => ({ id: 'r', name: 'R', enabled: true, schedule: { mode: 'always', scheduleIds: [] }, source: { filterIds: ['7'], jql: 'project = IT' }, logic: { operator: 'AND', groups: [] }, actions: [action] });
const profile = { id: 'p', rules: [], schedules: [] };
(async () => {
  // Comments are not status-bound: a manual transition must not cancel an unrelated comment.
  let action = { id: 'a', type: SD.Constants.ACTION.COMMENT, enabled: true, when: { enabled: false } };
  let rule = baseRule(action);
  profile.rules = [rule];
  let client = { issue: async () => makeRaw({ status: 'In Progress', statusId: '2' }) };
  let out = await SD.RuleEngine.validateAction(client, { issueKey: 'IT-1', ruleId: 'r', actionId: 'a', expectedStatusId: '1', expectedStatusName: 'Open', precondition: {}, issueSnapshot: {} }, profile);
  assert.equal(out.status, 'In Progress');

  // Transitions are status-bound and must fail closed if status changed.
  action = { id: 't', type: SD.Constants.ACTION.TRANSITION, enabled: true, when: { enabled: false } };
  rule = baseRule(action);
  profile.rules = [rule];
  await assert.rejects(() => SD.RuleEngine.validateAction(client, { issueKey: 'IT-1', ruleId: 'r', actionId: 't', precondition: { statusId: '1', statusName: 'Open' }, issueSnapshot: {} }, profile), e => e.code === 'ACTION_PRECONDITION_CHANGED' && /Status changed: Open → In Progress/.test(e.message));

  // Assignment watches assignee, not status.
  action = { id: 'as', type: SD.Constants.ACTION.ASSIGN, enabled: true, when: { enabled: false } };
  rule = baseRule(action);
  profile.rules = [rule];
  client = { issue: async () => makeRaw({ status: 'In Progress', statusId: '2', assignee: { key: 'bob', name: 'bob', displayName: 'Bob' } }) };
  await assert.rejects(() => SD.RuleEngine.validateAction(client, { issueKey: 'IT-1', ruleId: 'r', actionId: 'as', precondition: { assigneeKey: 'alice', assigneeName: 'Alice' }, issueSnapshot: {} }, profile), e => e.code === 'ACTION_PRECONDITION_CHANGED' && /Assignee changed: Alice → Bob/.test(e.message));

  // Explicit action conditions remain real execution-time preconditions.
  action = {
    id: 'c',
    type: SD.Constants.ACTION.COMMENT,
    enabled: true,
    when: { enabled: true, logic: { operator: 'AND', groups: [{ operator: 'AND', conditions: [{ field: 'status', operator: 'is-any-of', values: ['Open'] }] }] } }
  };
  rule = baseRule(action);
  profile.rules = [rule];
  await assert.rejects(() => SD.RuleEngine.validateAction(client, { issueKey: 'IT-1', ruleId: 'r', actionId: 'c', precondition: {}, issueSnapshot: {} }, profile), e => e.code === 'ACTION_PRECONDITION_CHANGED' && /Action conditions no longer match/.test(e.message));

  // Planner stores action-specific guard state rather than imposing status on every action.
  const site = { id: 's', users: [], priorities: [] },
    issue = SD.Discovery.normalizeIssue(makeRaw()),
    planningRule = {
      ...baseRule({ id: 'pc', type: SD.Constants.ACTION.COMMENT, enabled: true, when: { enabled: false }, delay: { mode: 'override', minSeconds: 0, maxSeconds: 0 }, templates: ['x'], selection: 'constant' }),
      source: { filterIds: [], jql: 'project = IT' }
    };
  profile.rules = [planningRule];
  let planned = await SD.RuleEngine.planCycle(site, profile, [{ ...issue, _sourceRuleIds: ['r'] }], new Date('2026-08-12T12:00:00Z'), { safety: { maxIssuesPerCycle: 25, maxActionsPerCycle: 50, maxCommentsPerHour: 100, maxAssignmentsPerHour: 100, maxTransitionsPerHour: 100 } });
  assert.deepEqual(planned.plans[0].precondition, {});
  planningRule.actions = [
    {
      id: 'pt',
      type: SD.Constants.ACTION.TRANSITION,
      enabled: true,
      when: { enabled: false },
      delay: { mode: 'override', minSeconds: 0, maxSeconds: 0 },
      transitionId: '5',
      transitionContext: { fromStatusId: '1', toStatusId: '2' }
    }
  ];
  planned = await SD.RuleEngine.planCycle(site, profile, [{ ...issue, _sourceRuleIds: ['r'] }], new Date('2026-08-12T12:00:00Z'), { safety: { maxIssuesPerCycle: 25, maxActionsPerCycle: 50, maxCommentsPerHour: 100, maxAssignmentsPerHour: 100, maxTransitionsPerHour: 100 } });
  assert.equal(planned.plans[0].precondition.statusId, '1');
  assert.equal(planned.plans[0].precondition.statusName, 'Open');
  console.log('v201-rule-preflight-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
