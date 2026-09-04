const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
global.crypto = require('crypto').webcrypto;
global.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
const calls = [];
global.fetch = async (url, opt) => {
  calls.push(String(url));
  let body = [];
  if (url.includes('/project/IT/statuses')) body = [{ id: '10001', name: 'Incident', statuses: [{ id: '1', name: 'Open' }, { id: '3', name: 'In Progress' }] }];
  else if (url.includes('/user/assignable/multiProjectSearch')) body = [{ name: 'agent2', displayName: 'Agent 2' }];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
load('src/api/jira-client.js');
const c = new SDCompanion.JiraApi.JiraClient({ baseUrl: 'https://jira.example.test', network: {} }, 'token');
(async () => {
  assert.strictEqual((await c.projectStatuses('IT'))[0].statuses.length, 2);
  assert.strictEqual((await c.assignableUsers(['IT'], { maxUsers: 100 })).length, 1);
  assert(!calls.some(x => /\/components(?:\?|$)|\/versions(?:\?|$)|\/role(?:\/|\?|$)/.test(x)));
  console.log('metadata-client-test: PASS');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
