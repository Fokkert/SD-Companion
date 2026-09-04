const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
globalThis.chrome = { runtime: { sendMessage: () => Promise.resolve() } };
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion, logs = [];
SD.Storage = { appendLog: async x => logs.push(x) };
SD.Operations = { throwIfCancelled: () => {} };
load('src/background/discovery.js');
const site = SD.Defaults.site({ id: 's', baseUrl: 'https://jira.test' });
site.transitionCatalog = [
  {
    id: 'IT:100:1',
    projectId: '10',
    projectKey: 'IT',
    projectName: 'IT',
    issueTypeId: '100',
    issueTypeName: 'Incident',
    statusId: '1',
    statusName: 'Open',
    workflowName: 'Old Workflow',
    workflowSource: 'workflow-designer',
    transitions: [{ id: '31', name: 'Cancel', toStatusId: '2', toStatusName: 'Done' }]
  }
];
const warnings = [],
  client = {
    searchPage: async () => ({ issues: [{ key: 'IT-1' }], total: 1 }),
    workflowNameFromIssuePage: async () => {
      const e = new Error('Browser Jira session missing');
      e.code = 'WORKFLOW_NAME_UNAVAILABLE';
      throw e;
    },
    workflowDesigner: async () => {
      throw new Error('must not be called');
    }
  };
(async () => {
  const matrix = [{ projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '1', statusName: 'Open' }],
    cat = await SD.Discovery.buildTransitionCatalog(client, site, 's', matrix, warnings, '');
  assert.equal(cat.length, 1);
  assert.equal(cat[0].transitions[0].id, '31', 'failed refresh must retain last known transition data');
  assert.equal(cat[0].stale, true);
  assert(cat[0].syncError.includes('Browser Jira session missing'));
  assert.equal(warnings.length, 1);
  console.log('v1512-workflow-failure-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
