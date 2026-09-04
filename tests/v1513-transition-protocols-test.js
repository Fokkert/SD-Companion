const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.chrome = { alarms: { clear: async () => true, create: async () => {} }, notifications: { create: async () => {} }, runtime: { getURL: x => x } };
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.4.0');
assert.equal(SD.Constants.SCHEMA_VERSION, 34);
assert.equal(SD.Defaults.site().inventorySettings.transitionMethod, SD.Constants.TRANSITION_METHOD.WORKFLOW_DESIGNER, 'Workflow Designer must be the default protocol');
const ta = SD.Defaults.action(SD.Constants.ACTION.TRANSITION);
assert('transitionId' in ta && 'toStatusId' in ta && 'manualTransitionName' in ta, 'transition actions must retain fields for every protocol');
load('src/background/job-queue.js');
const transitions = [
  { id: '10', name: 'Resolve', to: { id: '5', name: 'Done' } },
  { id: '11', name: 'Resolve alternate', to: { id: '5', name: 'Done' } },
  { id: '12', name: 'Close', to: { id: '6', name: 'Closed' } },
  { id: '13', name: 'DUPLICATE', to: { id: '7', name: 'Review' } },
  { id: '14', name: 'duplicate', to: { id: '8', name: 'Other' } }
];
const client = { transitions: async () => ({ transitions }) },
  issue = { projectKey: 'IT', issueTypeId: '100', statusId: '1' },
  baseJob = { issueKey: 'IT-1', payload: { rule: {} } };
const site = method => ({ inventorySettings: { transitionMethod: method } });
(async () => {
  let job = structuredClone(baseJob);
  job.payload.rule = { transitionId: '12', transitionContext: { projectKey: 'IT', issueTypeId: '100', fromStatusId: '1', toStatusId: '6' } };
  let t = await SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.WORKFLOW_DESIGNER), job, issue);
  assert.equal(t.id, '12', 'Workflow Designer mode must execute the exact configured transition');
  t = await SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.ISSUE_EXTRACTION), job, issue);
  assert.equal(t.id, '12', 'Issue extraction mode must keep exact transition-ID execution');
  job = structuredClone(baseJob);
  job.payload.rule = { toStatusId: '6' };
  t = await SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.TARGET_STATUS_RANDOM), job, issue);
  assert.equal(t.id, '12', 'single target-status candidate must be deterministic');
  job.payload.rule.toStatusId = '5';
  const oldRandom = Math.random;
  Math.random = () => 0.99;
  try {
    t = await SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.TARGET_STATUS_RANDOM), job, issue);
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(t.id, '11', 'multiple target-status candidates must use the configured random resolver');
  job = structuredClone(baseJob);
  job.payload.rule = { manualTransitionName: ' close ' };
  t = await SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.MANUAL_NAME), job, issue);
  assert.equal(t.id, '12', 'manual transition names must be exact after trimming and case-insensitive');
  job.payload.rule.manualTransitionName = 'duplicate';
  await assert.rejects(() => SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.MANUAL_NAME), job, issue), /ambiguous/i, 'manual-name mode must fail instead of guessing');
  job.payload.rule.manualTransitionName = 'missing';
  await assert.rejects(() => SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.MANUAL_NAME), job, issue), /Transition no longer available/i);
  job = structuredClone(baseJob);
  job.payload.rule = { toStatusId: '404' };
  await assert.rejects(() => SD.JobQueue.resolveTransition(client, site(SD.Constants.TRANSITION_METHOD.TARGET_STATUS_RANDOM), job, issue), /Transition no longer available/i);
  console.log('v1513-transition-protocols-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
