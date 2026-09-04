const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/defaults.js']) load(f);
SDCompanion.RequestScheduler = { before: async () => {}, after: () => {}, release: () => {} };
SDCompanion.Operations = { throwIfCancelled: () => {}, signal: () => null };
load('src/api/jira-client.js');
(async () => {
  assert.equal(SDCompanion.Constants.BUILD_VERSION, '2.1.1');
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return { ok: true, status: 200, url: String(url), headers: { get: () => null }, text: async () => '{"name":"agent"}' };
  };
  const site = { baseUrl: 'https://jira.internal', network: { requestPolicy: { spacingMs: 0, retries: 0, timeoutMs: 5000, maxRequestsPerMinute: 600, maxConcurrent: 1 } } };
  await new SDCompanion.JiraApi.JiraClient(site, 'token').myself();
  assert.equal(seen.length, 1);
  assert(!Object.prototype.hasOwnProperty.call(seen[0].init, 'targetAddressSpace'), 'HTTPS Jira requests must not assert a target address space');
  assert.equal(seen[0].init.redirect, 'follow');
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  let err;
  try {
    await new SDCompanion.JiraApi.JiraClient(site, 'token').myself();
  } catch (e) {
    err = e;
  }
  assert(err);
  assert.equal(err.code, 'NETWORK_REQUEST_FAILED');
  assert.match(err.message, /Local Network Access\/CORS policy/);
  assert.match(err.message, /TLS certificate validation/);
  assert.doesNotMatch(err.message, /Ensure the Jira certificate is trusted/);
  console.log('v1520-network-address-space-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
