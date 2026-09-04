const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
let mode = 'full';
globalThis.fetch = async (url, opt = {}) => {
  const p = new URL(String(url)).pathname;
  let status = 200, data = [];
  if (p.endsWith('/myself')) data = { name: 'agent', displayName: 'Agent' };
  else if (p.endsWith('/filter/my')) {
    if (mode === 'favs') {
      status = 404;
      data = { errorMessages: ['Not found'] };
    }
    else data = [{ id: '1', name: 'Empty saved filter', favourite: false, jql: 'project = EMPTY' }];
  }
  else if (p.endsWith('/filter/search')) {
    if (mode === 'favs') {
      status = 404;
      data = { errorMessages: ['Not found'] };
    }
    else data = { isLast: true, values: [{ id: '2', name: 'Owned saved filter', favourite: false, jql: 'project = IT' }] };
  }
  else if (p.endsWith('/filter/favourite')) data = [{ id: '3', name: 'Favourite', favourite: true, jql: 'project = IT' }];
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
};
load('src/api/jira-client.js');
const site = { id: 's', baseUrl: 'https://jira.test', server: { deploymentType: 'Server' }, network: { requestPolicy: { spacingMs: 100, retries: 0, timeoutMs: 5000, maxRequestsPerMinute: 600, maxConcurrent: 1 } } };
(async () => {
  let c = new SDCompanion.JiraApi.JiraClient(site, 'pat'), mine = await c.filters({ name: 'agent' });
  assert.deepEqual(mine.map(x => x.id).sort(), ['1', '2', '3']);
  assert.equal(c.filterCoverage, 'owned-and-favourites');
  assert(mine.some(x => x.name === 'Empty saved filter'), 'filter discovery must not depend on matching issues');
  mode = 'favs';
  c = new SDCompanion.JiraApi.JiraClient(site, 'pat');
  const favs = await c.filters({ name: 'agent' });
  assert.deepEqual(favs.map(x => x.id), ['3']);
  assert.equal(c.filterCoverage, 'favourites-only');
  console.log('filter-coverage-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
