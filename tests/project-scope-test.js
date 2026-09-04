const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js']) load(f);
const SD = globalThis.SDCompanion;
let state = SD.Defaults.state();
const site = SD.Defaults.site({ id: 'site1', name: 'Jira', baseUrl: 'https://jira.example.test' });
site.inventorySettings.selectedProjectKeys = ['IT'];
site.inventorySettings.buildTransitionCatalog = false;
state.jiraSites = [site];
const profile = SD.Defaults.profile('P', site);
state.profiles = [profile];
state.activeSiteId = site.id;
state.activeProfileId = profile.id;
SD.Storage = {
  ensureState: async () => structuredClone(state),
  getCredential: async () => 'pat',
  updateState: async fn => {
    const d = structuredClone(state);
    const out = await fn(d);
    state = structuredClone(out && out.schemaVersion ? out : d);
    return structuredClone(state);
  },
  appendLog: async () => {},
  appendAudit: async () => {}
};
SD.JiraTabs = { browserStatus: async () => ({ tabOpen: false, tabCount: 0, tabUrls: [] }) };
SD.Operations = { throwIfCancelled: () => {} };
const calls = [];
class MockClient {
  constructor() {
    this.lastTransport = 'mock';
    this.capabilities = {};
  } markCap(k, v = true) {
    this.capabilities[k] = v;
  } statsSnapshot() {
    return { requests: 0, failures: 0, retries: 0, rateLimited: 0, avgLatencyMs: 0, maxLatencyMs: 0 };
  } async myself() {
    return { name: 'me', displayName: 'Me' };
  } async projects() {
    return [{ id: '1', key: 'IT', name: 'IT', avatarUrls: { '48x48': 'it.png' } }, { id: '2', key: 'HR', name: 'HR' }];
  } async filters() {
    return [{ id: '10', name: 'Mine' }];
  } async myPermissions() {
    return { permissions: {} };
  } async fields() {
    return [];
  } async priorities() {
    return [];
  } async resolutions() {
    return [];
  } async project(k) {
    calls.push(['project', k]);
    return { id: k === 'IT' ? '1' : '2', key: k, name: k };
  } async projectStatuses(k) {
    calls.push(['statuses', k]);
    return [{ id: '100', name: 'Task', statuses: [{ id: '1', name: 'Open' }] }];
  } async assignableUsers(keys) {
    calls.push(['assignable', ...keys]);
    return [{ name: 'agent', displayName: 'Agent' }];
  }
}
SD.JiraApi = { JiraClient: MockClient };
globalThis.chrome = { runtime: { sendMessage: () => Promise.resolve() } };
load('src/background/discovery.js');
(async () => {
  await SD.Discovery.discoverProjects(site.id);
  assert.deepEqual(state.jiraSites[0].inventorySettings.selectedProjectKeys, ['IT']);
  await SD.Discovery.syncSite(site.id);
  assert(calls.some(x => x[0] === 'statuses' && x[1] === 'IT'));
  assert(!calls.some(x => x.includes('HR')));
  assert.deepEqual(state.jiraSites[0].inventorySettings.selectedProjectKeys, ['IT']);
  assert.equal(state.jiraSites[0].projects.find(x => x.key === 'IT').avatarUrl, 'it.png');
  console.log('project-scope-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
