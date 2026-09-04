const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.performance = { now: () => Date.now() };
globalThis.SDCompanion = {};
globalThis.chrome = { runtime: { sendMessage: () => Promise.resolve() } };
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/condition-registry.js', 'src/shared/rule-query.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion;
SD.Storage = { appendLog: async () => {} };
SD.Operations = { throwIfCancelled: () => {} };
load('src/background/discovery.js');
assert.equal(SD.Constants.BUILD_VERSION, '2.2.1');
assert.equal(SD.Constants.SCHEMA_VERSION, 33);
const graph = {
  isDraft: false,
  layout: {
    statuses: [{ id: 'S<1>', name: 'Open', statusId: '1', initial: false }, { id: 'S<2>', name: 'Done', statusId: '2', initial: false }],
    transitions: [{ id: 'A<31:S<1>:S<2>>', actionId: 31, name: 'Cancel', sourceId: 'S<1>', targetId: 'S<2>', initial: false }]
  },
  workflowPermissions: { administrator: false }
};
const calls = { search: 0, names: [], designer: [] };
const fake = {
  searchPage: async (jql, opt) => {
    calls.search++;
    const type = (jql.match(/issuetype = (\d+)/) || [])[1];
    return { issues: [{ key: `IT-${type}` }], total: 1 };
  },
  workflowNameFromIssuePage: async key => {
    calls.names.push(key);
    return { workflowName: 'Shared Workflow', issueKey: key, browserUser: 'agent' };
  },
  workflowDesigner: async name => {
    calls.designer.push(name);
    return graph;
  }
};
const site = SD.Defaults.site({ id: 's', baseUrl: 'https://jira.test' }),
  matrix = [
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '1', statusName: 'Open' },
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '2', statusName: 'Done' },
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '200', issueTypeName: 'Request', statusId: '1', statusName: 'Open' },
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '200', issueTypeName: 'Request', statusId: '2', statusName: 'Done' }
  ];
(async () => {
  const catalog = await SD.Discovery.buildTransitionCatalog(fake, site, 's', matrix, [], '');
  assert.equal(calls.search, 2, 'one lightweight issue lookup per project/issue type');
  assert.equal(calls.names.length, 2);
  assert.equal(calls.designer.length, 1, 'same workflow graph must be fetched only once per sync');
  const cancels = catalog.filter(c => c.statusId === '1').flatMap(c => c.transitions.filter(t => t.name === 'Cancel'));
  assert.equal(cancels.length, 2, 'same transition must remain separate across issue types');
  assert.deepEqual(new Set(catalog.filter(c => c.statusId === '1').map(c => c.issueTypeId)), new Set(['100', '200']));
  assert(catalog.every(c => c.workflowName === 'Shared Workflow'));
  const source = fs.readFileSync('src/ui/app/pages/data.js', 'utf8');
  assert(source.includes('transition-card'));
  assert(source.includes('Jira read-only workflow'));
  assert(source.includes('Before status'));
  assert(source.includes('After status'));
  console.log('v156-transition-discovery-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
