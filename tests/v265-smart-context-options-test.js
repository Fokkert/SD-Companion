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
  'src/shared/defaults.js'
]) load(f);
load('src/ui/app/app-core.js');
load('src/ui/app/rule-context.js');
load('src/ui/app/pages/rule-conditions.js');
load('src/ui/app/pages/rule-actions.js');

const SD = SDCompanion,
  A = SDApp,
  site = SD.Defaults.site({ baseUrl: 'https://jira.example.test' });

assert.equal(SD.Constants.BUILD_VERSION, '2.6.5');
assert.equal(JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version, '2.6.5');

site.projects = [
  { id: '10', key: 'IT', name: 'IT' },
  { id: '20', key: 'HR', name: 'HR' }
];
site.issueTypes = [
  { id: '100', name: 'Incident', projectKey: 'IT' },
  { id: '200', name: 'Request', projectKey: 'IT' },
  { id: '200', name: 'Request', projectKey: 'HR' }
];
site.statuses = [
  { id: '1', name: 'Incident Open', projectKey: 'IT', issueTypeId: '100', issueTypeName: 'Incident' },
  { id: '2', name: 'Incident Closed', projectKey: 'IT', issueTypeId: '100', issueTypeName: 'Incident' },
  { id: '3', name: 'Request New', projectKey: 'IT', issueTypeId: '200', issueTypeName: 'Request' },
  { id: '4', name: 'Request Done', projectKey: 'IT', issueTypeId: '200', issueTypeName: 'Request' },
  { id: '5', name: 'HR Pending', projectKey: 'HR', issueTypeId: '200', issueTypeName: 'Request' }
];
site.projectStatusMatrix = site.statuses.map(x => ({
  projectId: x.projectKey === 'IT' ? '10' : '20',
  projectKey: x.projectKey,
  projectName: x.projectKey,
  issueTypeId: x.issueTypeId,
  issueTypeName: x.issueTypeName,
  statusId: x.id,
  statusName: x.name
}));
site.filters = [];
site.users = [];
site.priorities = [];
site.transitionCatalog = [
  {
    projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '1', statusName: 'Incident Open',
    transitions: [{ id: '31', name: 'Start Progress', toStatusId: '2', toStatusName: 'Incident Closed' }]
  },
  {
    projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '200', issueTypeName: 'Request', statusId: '3', statusName: 'Request New',
    transitions: [
      { id: '31', name: 'Start Progress', toStatusId: '4', toStatusName: 'Request Done' },
      { id: '42', name: 'Approve Request', toStatusId: '4', toStatusName: 'Request Done' }
    ]
  },
  {
    projectId: '20', projectKey: 'HR', projectName: 'HR', issueTypeId: '200', issueTypeName: 'Request', statusId: '5', statusName: 'HR Pending',
    transitions: [{ id: '51', name: 'HR Review', toStatusId: '6', toStatusName: 'HR Reviewed' }]
  }
];

const group1 = {
  id: 'g1', operator: 'AND', negate: false,
  conditions: [
    { id: 'g1-type', field: 'issueType', operator: 'equals', value: '100', values: [] },
    { id: 'g1-status', field: 'status', operator: 'equals', value: '', values: [] }
  ]
};
const group2 = {
  id: 'g2', operator: 'AND', negate: false,
  conditions: [
    { id: 'g2-project', field: 'project', operator: 'equals', value: 'IT', values: [] },
    { id: 'g2-type', field: 'issueType', operator: 'equals', value: '200', values: [] },
    { id: 'g2-status', field: 'status', operator: 'equals', value: '', values: [] }
  ]
};

const group1Statuses = A.RuleViews.sourceItems('status', site, SD.ConditionRegistry.get('status', site), group1, group1.conditions[1]);
assert.deepEqual(group1Statuses.map(x => x.v).sort(), ['1', '2']);
assert(group1Statuses.every(x => !x.l.includes('Request')));

const group2Statuses = A.RuleViews.sourceItems('status', site, SD.ConditionRegistry.get('status', site), group2, group2.conditions[2]);
assert.deepEqual(group2Statuses.map(x => x.v).sort(), ['3', '4']);
assert(group2Statuses.every(x => !x.l.includes('Incident') && !x.l.includes('HR')));

const rule = SD.Defaults.rule('Multi-group contexts');
rule.source.mode = 'conditions';
rule.logic.operator = 'OR';
rule.logic.groups = [group1, group2];

const transitions = A.RuleViews.transitionChoices(site, rule);
assert.equal(transitions.length, 3, 'all transitions from both matching rule groups should be visible');
assert.deepEqual(new Set(transitions.map(x => x.issueTypeId)), new Set(['100', '200']));
assert.equal(transitions.filter(x => x.id === '31').length, 2, 'same transition id/name must remain distinct across issue-type contexts');
assert(transitions.some(x => x.name === 'Approve Request' && x.issueTypeId === '200'));
assert(!transitions.some(x => x.name === 'HR Review'), 'project constraint in Group 2 must exclude HR context');

const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8');
assert(events.includes("['project', 'issueType', 'status'].includes(c.field)"), 'context-driving multi-select changes must rerender dependent options immediately');

console.log('v2.6.5 smart condition/action context regression: OK');
