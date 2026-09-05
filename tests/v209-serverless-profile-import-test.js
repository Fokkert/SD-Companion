const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
globalThis.chrome = { runtime: {}, storage: { session: { get: () => {} }, local: { get: () => {} } } };
const root = path.join(__dirname, '..'),
  load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/ui/app/app-core.js',
  'src/ui/app/pages/base.js',
  'src/ui/app/pages/profiles.js'
]) load(f);
const SD = SDCompanion, A = SDApp;
(async () => {
  assert.equal(SD.Constants.BUILD_VERSION, '2.5.1');
  A.state = { jiraSites: [], profiles: [], activeSiteId: '', activeProfileId: '', appearance: {}, system: {}, runtime: {} };
  let html = A.pageProfiles();
  assert(html.includes('Import Profile'), 'Profiles must expose Import with zero configured servers');
  assert(!html.includes('Add Jira server'), 'Profile import must not be blocked behind server configuration');
  const exportedSite = SD.Defaults.site({ id: 'old-site', baseUrl: 'https://jira.example.test', name: 'Imported Jira' });
  exportedSite.auth.configured = true;
  exportedSite.runtime.apiHealthy = true;
  exportedSite.runtime.connectionStatus = 'connected';
  exportedSite.runtime.healthState = 'healthy';
  const exportedProfile = SD.Defaults.profile('Imported Profile', exportedSite);
  exportedProfile.rules = [SD.Defaults.rule('Imported Rule')];
  const bundle = { format: 'sd-companion-profile', version: 3, server: exportedSite, profile: exportedProfile, appearance: { theme: 'midnight-glass' }, system: { logLevel: 'info' } };
  A.setPage = () => {};
  await A.prepareImport(bundle);
  assert(A.pendingImport, 'Import preview should be prepared without a configured server');
  html = A.pageProfiles();
  assert(html.includes('Import preview'));
  assert(html.includes('Apply Import'));
  const restoredSite = SD.Defaults.site({ id: 'new-site', baseUrl: 'https://jira.example.test', name: 'Imported Jira' });
  const workerState = {
    jiraSites: [restoredSite],
    profiles: [SD.Defaults.profile('Default Profile', restoredSite)],
    activeSiteId: 'new-site',
    activeProfileId: '',
    appearance: {},
    system: {},
    runtime: {},
    configRevision: 10
  };
  const calls = [];
  A.send = async (type, payload = {}) => {
    calls.push({ type, payload });
    if (type === SD.Constants.MESSAGE.ADD_SERVER) {
      assert.equal(payload.baseUrl, 'https://jira.example.test');
      assert.equal(payload.token, undefined);
      return { siteId: 'new-site', created: true };
    }
    if (type === SD.Constants.MESSAGE.GET_STATE) return { state: structuredClone(workerState) };
    if (type === SD.Constants.MESSAGE.SAVE_STATE) {
      workerState.jiraSites = structuredClone(payload.state.jiraSites);
      workerState.profiles = structuredClone(payload.state.profiles);
      workerState.activeSiteId = payload.state.activeSiteId;
      workerState.activeProfileId = payload.state.activeProfileId;
      workerState.appearance = structuredClone(payload.state.appearance);
      workerState.system = structuredClone(payload.state.system);
      workerState.configRevision = 11;
      return { state: structuredClone(workerState) };
    }
    throw new Error(`Unexpected message ${type}`);
  };
  A.load = async () => {};
  A.toast = () => {};
  await A.applyImport();
  assert(calls.some(x => x.type === SD.Constants.MESSAGE.ADD_SERVER), 'Import should restore the server shell itself');
  const imported = workerState.profiles.find(p => p.name === 'Imported Profile');
  assert(imported, 'Imported profile must be retained');
  assert.equal(imported.siteId, 'new-site');
  assert.equal(imported.rules[0].name, 'Imported Rule');
  assert.equal(workerState.activeSiteId, 'new-site');
  assert.equal(workerState.activeProfileId, imported.id);
  const importedSite = workerState.jiraSites.find(s => s.id === 'new-site');
  assert.equal(importedSite.auth.configured, false);
  assert.equal(importedSite.runtime.apiHealthy, false);
  assert.equal(importedSite.runtime.connectionStatus, 'pat-missing');
  assert.equal(importedSite.runtime.lastErrorCode, 'PAT_MISSING');
  console.log('v209-serverless-profile-import-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
