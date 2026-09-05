const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
globalThis.chrome = { runtime: { sendMessage: () => Promise.resolve() } };
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion;
SD.Storage = { appendLog: async () => {} };
SD.Operations = { throwIfCancelled: () => {} };
load('src/background/discovery.js');
assert.equal(SD.Constants.BUILD_VERSION, '2.6.0');
const workflow = {
  isDraft: false,
  layout: {
    statuses: [
      { id: 'I<1>', name: 'Create Issue', initial: true, stepId: 1 },
      { id: 'S<8>', name: 'Open', initial: false, stepId: 8, statusId: '1', statusCategory: { colourName: 'default' } },
      { id: 'S<10>', name: 'In Progress', initial: false, stepId: 10, statusId: '3', statusCategory: { colourName: 'inprogress' } },
      { id: 'S<13>', name: 'Resolved', initial: false, stepId: 13, statusId: '5', statusCategory: { colourName: 'success' } }
    ],
    transitions: [
      { id: 'IA<1:I<1>:S<8>>', name: 'Create Issue', sourceId: 'I<1>', targetId: 'S<8>', actionId: 1, initial: true },
      { id: 'A<4:S<8>:S<10>>', name: 'Start', sourceId: 'S<8>', targetId: 'S<10>', actionId: 4, initial: false },
      { id: 'A<5:S<10>:S<13>>', name: 'Resolve', sourceId: 'S<10>', targetId: 'S<13>', actionId: 5, initial: false, screenName: 'Resolve Issue Screen' },
      { id: 'A<9:S<13>:S<13>>', name: 'Confirm', sourceId: 'S<13>', targetId: 'S<13>', actionId: 9, initial: false, loopedTransition: true },
      { id: 'A<20:G:S<8>>', name: 'Reset', sourceId: 'G', targetId: 'S<8>', actionId: 20, initial: false, globalTransition: true }
    ],
    updatedDate: 1
  },
  workflowPermissions: { administrator: false, editWorkflow: false }
};
const group = {
  projectId: '10',
  projectKey: 'IT',
  projectName: 'IT',
  issueTypeId: '100',
  issueTypeName: 'Incident',
  rows: [
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '1', statusName: 'Open' },
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '3', statusName: 'In Progress' },
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '5', statusName: 'Resolved' }
  ]
};
const mapped = SD.Discovery.workflowTransitionContexts(workflow, group, { workflowName: 'IT workflow', issueKey: 'IT-1', browserUser: 'agent' });
assert.equal(mapped.length, 3);
assert(!mapped.some(c => c.transitions.some(t => t.id === '1')), 'create transition must not be offered for existing issues');
assert(mapped.find(c => c.statusId === '1').transitions.some(t => t.id === '4' && t.toStatusId === '3'));
assert(mapped.find(c => c.statusId === '3').transitions.some(t => t.id === '5' && t.toStatusId === '5'));
assert(mapped.find(c => c.statusId === '5').transitions.some(t => t.id === '9' && t.loopedTransition));
for (const ctx of mapped) assert(ctx.transitions.some(t => t.id === '20' && t.globalTransition), 'global transitions must be contextualized to every normal source status');
console.log('v1511-transition-sampling-test: OK (superseded by Workflow Designer mapping)');
