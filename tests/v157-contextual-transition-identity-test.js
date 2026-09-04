const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/condition-registry.js', 'src/shared/rule-query.js', 'src/shared/defaults.js'])
  load(f);
load('src/ui/app/app-core.js');
load('src/ui/app/pages/rule-actions.js');
const SD = SDCompanion, A = SDApp, site = SD.Defaults.site({ baseUrl: 'https://jira.test' });
site.transitionCatalog = [
  {
    id: 'IT:100:1',
    projectKey: 'IT',
    projectName: 'IT',
    issueTypeId: '100',
    issueTypeName: 'Incident',
    statusId: '1',
    statusName: 'Open',
    transitions: [{ id: '31', name: 'Cancel', toStatusId: '9', toStatusName: 'Cancelled' }]
  },
  {
    id: 'IT:200:1',
    projectKey: 'IT',
    projectName: 'IT',
    issueTypeId: '200',
    issueTypeName: 'Request',
    statusId: '1',
    statusName: 'Open',
    transitions: [{ id: '31', name: 'Cancel', toStatusId: '9', toStatusName: 'Cancelled' }]
  },
  {
    id: 'HR:200:1',
    projectKey: 'HR',
    projectName: 'HR',
    issueTypeId: '200',
    issueTypeName: 'Request',
    statusId: '1',
    statusName: 'Open',
    transitions: [{ id: '31', name: 'Cancel', toStatusId: '9', toStatusName: 'Cancelled' }]
  }
];
const choices = A.RuleViews.transitionChoices(site, null);
assert.equal(choices.length, 3, 'same name/id must remain separate across project/issue-type contexts');
assert.deepEqual(new Set(choices.map(x => x.issueTypeId)), new Set(['100', '200']));
const src = fs.readFileSync('src/ui/app/pages/data.js', 'utf8');
assert(!textIncludes(src, 'seen=new Set'), 'Data view must not apply a second global transition dedupe pass');
assert(textIncludes(src, 'issueTypeId:String(ctx.issueTypeId'), 'Data rows must retain issue-type context');
const actions = fs.readFileSync('src/ui/app/app-events.js', 'utf8'),
  engine = fs.readFileSync('src/background/rule-engine.js', 'utf8'),
  queue = fs.readFileSync('src/background/job-queue.js', 'utf8');
assert(textIncludes(actions, 'transitionContext'));
assert(textIncludes(engine, 'transitionContext:action.transitionContext'));
assert(textIncludes(queue, 'Issue type changed.'));
assert(textIncludes(queue, 'ACTION_PRECONDITION_CHANGED'));
const discovery = fs.readFileSync('src/background/discovery.js', 'utf8'),
  client = fs.readFileSync('src/api/jira-client.js', 'utf8');
assert(textIncludes(discovery, 'workflowNameFromIssuePage'));
assert(textIncludes(discovery, 'workflowDesigner'));
assert(textIncludes(discovery, 'workflowTransitionContexts'));
assert(textIncludes(discovery, 'buildIssueExtractionCatalog'));
assert(textIncludes(discovery, 'TRANSITION_METHOD.ISSUE_EXTRACTION'));
assert(textIncludes(client, '/rest/workflowDesigner/latest/workflows'));
assert(textIncludes(client, 'credentials:"include"'));
assert(!textIncludes(discovery, 'includeUnavailableTransitions'));
assert(!textIncludes(client, 'includeUnavailableTransitions'));
console.log('v157-contextual-transition-identity-test: OK');
