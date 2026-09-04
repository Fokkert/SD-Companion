const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
const calls = [];
globalThis.fetch = async (url, opt = {}) => {
  calls.push({ url: String(url), opt });
  const p = new URL(url).pathname;
  let data = {};
  if (p.endsWith('/myself')) data = { name: 'agent', displayName: 'Agent', avatarUrls: { '48x48': 'https://jira/avatar/me' } };
  else if (p.endsWith('/serverInfo')) data = { deploymentType: 'Server', version: '9.12.1', serverTitle: 'Test Jira' };
  else if (p.endsWith('/mypermissions')) data = { permissions: { BROWSE_PROJECTS: { havePermission: true } } };
  else if (p.endsWith('/filter/my')) data = [{ id: '10', name: 'Mine' }];
  else if (p.endsWith('/filter/favourite')) data = [{ id: '11', name: 'Fav' }];
  else if (p.endsWith('/filter/search')) data = { startAt: 0, isLast: true, values: [{ id: '12', name: 'Visible' }] };
  else if (/\/filter\/(10|11|12)$/.test(p)) {
    const id = p.split('/').pop();
    data = { id, name: { '10': 'Mine', '11': 'Fav', '12': 'Visible' }[id], jql: id === '10' ? 'project = IT AND issuetype = Incident' : 'project = IT' };
  }
  else if (p.endsWith('/user/assignable/multiProjectSearch')) data = [{ name: 'agent2', displayName: 'Agent 2' }];
  else if (p.endsWith('/search')) data = { startAt: 0, total: 1, issues: [{ id: '1', key: 'IT-1', fields: { summary: 'Test' } }] };
  else if (p.endsWith('/issue/IT-1/transitions')) data = { transitions: [{ id: '21', name: 'Start Progress', to: { id: '3', name: 'In Progress' }, fields: {} }] };
  else data = [];
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
load('src/api/jira-client.js');
(async () => {
  const c = new SDCompanion.JiraApi.JiraClient({
    id: 's',
    baseUrl: 'https://jira.example.test',
    server: { deploymentType: 'Server' },
    network: { requestPolicy: { spacingMs: 100, retries: 0, timeoutMs: 5000, maxRequestsPerMinute: 600, maxConcurrent: 1 } }
  }, 'secret-pat');
  const d = await c.diagnose();
  assert.equal(d.myself.displayName, 'Agent');
  assert.equal(d.serverInfo.serverTitle, 'Test Jira');
  assert.equal(c.capabilities.serverInfo, true);
  assert.equal(c.capabilities.permissions, true);
  const filters = await c.filters(d.myself);
  assert.deepEqual(filters.map(x => x.id).sort(), ['10', '11', '12']);
  assert(filters.every(x => x.jql), 'filter discovery should hydrate JQL used by contextual transition selection');
  assert(calls.some(x => x.url.includes('/filter/search') && new URL(x.url).searchParams.get('owner') === 'agent'));
  assert.equal((await c.assignableUsers(['IT'], { maxUsers: 100 }))[0].displayName, 'Agent 2');
  assert.equal((await c.search('project = IT', { maxIssues: 10 }))[0].key, 'IT-1');
  assert.equal((await c.transitions('IT-1')).transitions[0].id, '21');
  const myself = calls.find(x => x.url.endsWith('/rest/api/2/myself'));
  assert.equal(myself.opt.headers.Authorization, 'Bearer secret-pat');
  assert(calls.every(x => x.opt.credentials === 'omit'));
  console.log('api-client-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
