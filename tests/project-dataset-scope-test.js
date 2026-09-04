const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js']) load(f);
const SD = SDCompanion;
let state = SD.Defaults.state(), site = SD.Defaults.site({ id: 's', baseUrl: 'https://jira.test' });
site.inventorySettings.projectDatasets = { IT: { users: true, fields: false, issueTypes: false, statuses: false, transitions: false }, HR: { users: false, fields: true, issueTypes: false, statuses: false, transitions: false } };
site.inventorySettings.selectedProjectKeys = [];/* deliberately stale: projectDatasets is the source of truth */site.inventorySettings.buildTransitionCatalog = false;
state.jiraSites = [site];
const p = SD.Defaults.profile('P', site);
state.profiles = [p];
state.activeSiteId = site.id;
state.activeProfileId = p.id;
SD.Storage = {
  ensureState: async () => structuredClone(state),
  getCredential: async () => 'pat',
  updateState: async fn => {
    const d = structuredClone(state);
    await fn(d);
    state = d;
    return structuredClone(state);
  },
  appendLog: async () => {},
  appendAudit: async () => {}
};
SD.JiraTabs = { browserStatus: async () => ({}) };
SD.Operations = { throwIfCancelled: () => {} };
const calls = [];
class Mock {
  constructor() {
    this.capabilities = {};
    this.filterCoverage = 'owned-and-favourites';
    this.filterCoverageDetails = {};
    this.lastTransport = 'mock';
  } markCap() {} statsSnapshot() {
    return {};
  } async myself() {
    return { name: 'me' };
  } async projects() {
    return [{ id: '1', key: 'IT', name: 'IT' }, { id: '2', key: 'HR', name: 'HR' }];
  } async filters() {
    return [];
  } async myPermissions() {
    return { permissions: {} };
  } async project(k) {
    calls.push(['project', k]);
    return { id: k, key: k, name: k };
  } async projectStatuses(k) {
    calls.push(['statuses', k]);
    return [];
  } async assignableUsers(k) {
    calls.push(['users', ...k]);
    return [{ name: 'u', displayName: 'U' }];
  } async fields() {
    calls.push(['fields']);
    return [{ id: 'summary', name: 'Summary', custom: false }, { id: 'customfield_10000', name: 'Location', custom: true }];
  } async projectCreateIssueTypes(k) {
    calls.push(['createTypes', k]);
    return [{ id: '10', name: 'Task' }];
  } async projectIssueTypeFields(k, it) {
    calls.push(['contextFields', k, it]);
    return [{ fieldId: 'summary', name: 'Summary' }];
  } async priorities() {
    return [];
  } async resolutions() {
    return [];
  }
}
SD.JiraApi = { JiraClient: Mock };
globalThis.chrome = { runtime: { sendMessage: () => Promise.resolve() } };
load('src/background/discovery.js');
(async () => {
  await SD.Discovery.syncSite('s');
  assert(calls.some(x => x[0] === 'users' && x[1] === 'IT'));
  assert(!calls.some(x => x[0] === 'users' && x[1] === 'HR'));
  assert.equal(calls.filter(x => x[0] === 'fields').length, 1, 'visible Jira field directory should be fetched once');
  assert(!calls.some(x => x[0] === 'createTypes' || x[0] === 'contextFields'), 'field synchronization must not crawl create metadata per issue type');
  assert(!calls.some(x => x[0] === 'statuses'), 'states/types/transitions disabled should not call project statuses');
  const st = state.jiraSites[0];
  assert(st.users.every(u => u.projectKeys?.includes('IT')));
  assert.deepEqual(st.fields.map(f => f.id), ['summary', 'customfield_10000']);
  console.log('project-dataset-scope-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
