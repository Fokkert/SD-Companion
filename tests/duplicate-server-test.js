const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/condition-registry.js', 'src/shared/defaults.js']) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
const SD = SDCompanion;
let state = SD.Defaults.state();
state.jiraSites = [];
state.profiles = [SD.Defaults.profile()];
SD.Storage = {
  updateState: async fn => {
    await fn(state);
    return structuredClone(state);
  }
};
vm.runInThisContext(fs.readFileSync('src/background/discovery.js', 'utf8'), { filename: 'discovery' });
(async () => {
  const first = await SD.Discovery.upsertSite({ baseUrl: 'https://jira.example.test/', name: 'Production' });
  assert(first.created);
  assert.equal(state.profiles.find(p => p.siteId === first.site.id)?.name, 'Default Profile');
  let err = null;
  try {
    await SD.Discovery.upsertSite({ baseUrl: 'https://jira.example.test', name: 'Duplicate' });
  } catch (e) {
    err = e;
  }
  assert(err);
  assert.equal(err.code, 'DUPLICATE_SERVER_URL');
  assert(/already configured/i.test(err.message));
  assert.equal(state.jiraSites.length, 1);
  assert.equal(state.jiraSites[0].name, 'Production');
  console.log('duplicate-server-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
