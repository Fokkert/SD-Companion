const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion;
SD.RequestScheduler = { before: async () => {}, after: () => {}, release: () => {} };
SD.Operations = { throwIfCancelled: () => {}, signal: () => null };
load('src/api/jira-client.js');
(async () => {
  let calls = 0, lastInit = null;
  globalThis.fetch = async (url, init) => {
    calls++;
    lastInit = init;
    return { ok: true, status: 200, statusText: 'OK', url, headers: { get: () => null }, text: async () => '{"name":"me"}' };
  };
  const site = SD.Defaults ? SD.Defaults.site({ baseUrl: 'https://jira.example.test' }) : { baseUrl: 'https://jira.example.test', network: { requestPolicy: { spacingMs: 100, retries: 0, timeoutMs: 5000, maxRequestsPerMinute: 600, maxConcurrent: 1 } } };
  const c = new SD.JiraApi.JiraClient(site, 'token');
  await c.myself();
  assert.equal(calls, 1);
  assert.equal(c.lastTransport, 'extension-worker');
  assert.deepEqual(c.transportCounts, { extension: 1 });
  assert(!('targetAddressSpace' in lastInit), 'worker requests must let Chrome determine the destination address space');
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  const failed = new SD.JiraApi.JiraClient({ baseUrl: 'https://jira.internal', network: { requestPolicy: { spacingMs: 100, retries: 5, timeoutMs: 5000, maxRequestsPerMinute: 600, maxConcurrent: 1 } } }, 'token');
  let err;
  try {
    await failed.myself();
  } catch (e) {
    err = e;
  }
  assert(err);
  assert.equal(err.code, 'NETWORK_REQUEST_FAILED');
  assert.match(err.message, /Local Network Access\/CORS policy/i);
  assert.match(err.message, /TLS certificate validation/i);
  assert.equal(failed.stats.retries, 0, 'pre-HTTP network failures must fail closed without retries');
  console.log('worker-only-transport-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
