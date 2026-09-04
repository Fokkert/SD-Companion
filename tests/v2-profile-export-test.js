const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
globalThis.chrome = { storage: { session: { get: () => {} }, local: { get: () => {} } }, runtime: {} };
const root = path.join(__dirname, '..'),
  load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
load('src/shared/defaults.js');
SDCompanion.Storage = { getCredential: async () => 'super-secret' };
load('src/ui/app/app-core.js');
const A = SDApp,
  site = SDCompanion.Defaults.site({ id: 'site', baseUrl: 'https://jira.example.test', name: 'Jira' }),
  profile = SDCompanion.Defaults.profile('Ops', site);
site.auth.configured = true;
site.auth.token = 'must-never-export';
site.fields = [{ id: 'customfield_1', name: 'X', schema: { type: 'number' } }];
site.transitionCatalog = [{ projectKey: 'IT', issueTypeId: '1', statusId: '2', transitions: [{ id: '31', name: 'Go' }] }];
profile.monitoring.enabled = true;
profile.rules = [SDCompanion.Defaults.rule('R')];
profile.schedules = [SDCompanion.Defaults.schedule('Day')];
profile.runtime.currentDetections = [{ issueKey: 'IT-1' }];
A.state = {
  jiraSites: [site],
  profiles: [profile],
  activeSiteId: 'site',
  activeProfileId: profile.id,
  appearance: { theme: 'obsidian-glass', openTarget: 'popup', glassStrength: .82 },
  system: { logLevel: 'info', safety: SDCompanion.Defaults.safety(), activityRefreshSeconds: 3, completionToneEnabled: true }
};
(async () => {
  const normal = await A.profileBundle(false);
  assert.equal(normal.version, 4);
  assert.deepEqual(normal.profile, profile);
  assert.deepEqual(normal.server.fields, site.fields);
  assert.deepEqual(normal.server.transitionCatalog, site.transitionCatalog);
  assert.equal(normal.server.auth.token, undefined);
  assert(!Object.prototype.hasOwnProperty.call(normal, 'pat'));
  assert.deepEqual(normal.appearance, A.state.appearance);
  assert.deepEqual(normal.system, A.state.system);
  const secure = await A.profileBundle(true);
  assert.equal(secure.pat, 'super-secret');
  assert.equal(secure.server.auth.token, undefined);
  const encrypted = await A.encrypt(secure, 'correct horse battery staple'),
    decrypted = await A.decrypt(encrypted, 'correct horse battery staple');
  assert.deepEqual(decrypted, secure);
  const malicious = JSON.parse('{"format":"sd-companion-profile","server":{"baseUrl":"https://jira.example.test"},"profile":{},"__proto__":{"polluted":true}}');
  // prepareImport sanitizes before retaining the pending bundle; avoid rendering by replacing setPage.
  A.state = { jiraSites: [], profiles: [], appearance: {}, system: {} };
  A.setPage = () => {};
  await A.prepareImport(malicious);
  assert.equal({}.polluted, undefined);
  assert(!Object.prototype.hasOwnProperty.call(A.pendingImport.bundle, '__proto__'));
  console.log('v2-profile-export-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
