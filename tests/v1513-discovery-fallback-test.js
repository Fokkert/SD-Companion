const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.chrome = { runtime: { sendMessage: () => Promise.resolve() } };
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion;
SD.Storage = { appendLog: async () => {} };
SD.Operations = { throwIfCancelled: () => {} };
load('src/background/discovery.js');
const rawIssue = key => ({ id: key.split('-')[1], key, fields: { summary: key, issuetype: { id: '100', name: 'Incident' }, status: { id: '1', name: 'Open' }, project: { id: '10', key: 'IT', name: 'IT' }, labels: [], components: [] } });
const matrix = [{ projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '1', statusName: 'Open' }];
(async () => {
  const workflowCalls = { search: 0, name: 0, designer: 0, transitions: 0 };
  const workflowClient = {
    searchPage: async () => {
      workflowCalls.search++;
      return { issues: [rawIssue('IT-1')], total: 1 };
    },
    workflowNameFromIssuePage: async () => {
      workflowCalls.name++;
      return { workflowName: 'WF', issueKey: 'IT-1' };
    },
    workflowDesigner: async () => {
      workflowCalls.designer++;
      return { layout: { statuses: [{ id: 'S<1>', name: 'Open', statusId: '1' }], transitions: [] } };
    },
    transitions: async () => {
      workflowCalls.transitions++;
      return { transitions: [] };
    }
  };
  const workflowSite = SD.Defaults.site();
  workflowSite.inventorySettings.buildTransitionCatalog = true;
  await SD.Discovery.buildTransitionCatalog(workflowClient, workflowSite, 's', matrix, [], '');
  assert.equal(workflowCalls.designer, 1);
  assert.equal(workflowCalls.transitions, 0, 'default Workflow Designer discovery must not silently sample issue transitions');
  const sampleCalls = { count: 0, search: 0, transitions: 0 };
  const sampleClient = {
    searchCount: async () => {
      sampleCalls.count++;
      return 2;
    },
    search: async () => {
      sampleCalls.search++;
      return [rawIssue('IT-1'), rawIssue('IT-2')];
    },
    transitions: async key => {
      sampleCalls.transitions++;
      return { transitions: [{ id: key === 'IT-1' ? '31' : '32', name: key === 'IT-1' ? 'Start' : 'Escalate', to: { id: '2', name: 'In Progress' }, fields: {} }] };
    }
  };
  const sampleSite = SD.Defaults.site();
  sampleSite.inventorySettings.buildTransitionCatalog = true;
  sampleSite.inventorySettings.transitionMethod = SD.Constants.TRANSITION_METHOD.ISSUE_EXTRACTION;
  const sampled = await SD.Discovery.buildTransitionCatalog(sampleClient, sampleSite, 's', matrix, [], '');
  assert.equal(sampleCalls.count, 1);
  assert.equal(sampleCalls.search, 1);
  assert.equal(sampleCalls.transitions, 2);
  assert.equal(sampled[0].workflowSource, 'issue-extraction');
  assert.deepEqual(sampled[0].transitions.map(x => x.id).sort(), ['31', '32']);
  const cached = [{ id: 'cached', projectKey: 'IT', issueTypeId: '100', statusId: '1', transitions: [{ id: '9', name: 'Cached' }] }];
  for (const method of [SD.Constants.TRANSITION_METHOD.TARGET_STATUS_RANDOM, SD.Constants.TRANSITION_METHOD.MANUAL_NAME]) {
    const runtimeSite = SD.Defaults.site();
    runtimeSite.inventorySettings.buildTransitionCatalog = true;
    runtimeSite.inventorySettings.transitionMethod = method;
    runtimeSite.transitionCatalog = structuredClone(cached);
    const out = await SD.Discovery.buildTransitionCatalog({}, runtimeSite, 's', matrix, [], '');
    assert.deepEqual(out, cached, 'runtime-only protocols must preserve the previous catalog rather than wiping it');
    assert.notStrictEqual(out, cached);
  }
  console.log('v1513-discovery-fallback-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
