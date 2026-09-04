const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.performance = { now: () => Date.now() };
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
SDCompanion.RequestScheduler = { before: async () => {}, after: () => {}, release: () => {} };
SDCompanion.Operations = { throwIfCancelled: () => {}, signal: () => null };
const calls = [];
globalThis.fetch = async (url, opt) => {
  calls.push({ url: String(url), opt });
  if (String(url).includes('/browse/')) return new Response('<html><meta name="ajs-remote-user" content="agent"><aui-item-link href="/browse/IT-1?workflowName=ITSM%3A+Default+Workflow&amp;stepId=8" id="view-workflow-button">View workflow</aui-item-link></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  return new Response(JSON.stringify({ isDraft: false, layout: { statuses: [{ id: 'S<8>', name: 'Open', statusId: '1', initial: false }], transitions: [] }, workflowPermissions: { administrator: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
load('src/api/jira-client.js');
const c = new SDCompanion.JiraApi.JiraClient({ baseUrl: 'https://jira.example.test', network: {} }, 'PAT');
(async () => {
  const ref = await c.workflowNameFromIssuePage('IT-1');
  assert.equal(ref.workflowName, 'ITSM: Default Workflow');
  assert.equal(ref.browserUser, 'agent');
  const wf = await c.workflowDesigner(ref.workflowName);
  assert.equal(wf.workflowPermissions.administrator, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].opt.credentials, 'include');
  assert(!('Authorization' in calls[0].opt.headers), 'browse workflow-name lookup must use browser session, never the PAT');
  assert.equal(calls[1].opt.credentials, 'omit');
  assert.equal(calls[1].opt.headers.Authorization, 'Bearer PAT');
  assert(calls[1].url.includes('/rest/workflowDesigner/latest/workflows'));
  assert(calls[1].url.includes('draft=false'));
  console.log('v1512-workflow-designer-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
