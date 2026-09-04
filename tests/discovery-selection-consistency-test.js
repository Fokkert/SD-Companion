const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/condition-registry.js', 'src/shared/defaults.js', 'src/shared/migrations.js'])
  load(f);
const SD = SDCompanion;
const settings = SD.Defaults.inventorySettings();
settings.projectDatasets = { IT: { users: true, fields: false, issueTypes: false, statuses: false, transitions: false }, HR: { users: false, fields: false, issueTypes: false, statuses: false, transitions: false } };
settings.selectedProjectKeys = [];
assert.deepEqual(SD.Utils.discoveryProjectKeys(settings), ['IT'], 'enabled datasets must define the project scope even when compatibility cache is stale');
const old = {
  schemaVersion: 18,
  appVersion: 'V1',
  jiraSites: [{ id: 's', name: 'Jira', baseUrl: 'https://jira.test', inventorySettings: settings }],
  profiles: [SD.Defaults.profile('P')],
  appearance: {},
  system: { dryRun: true }
};
const migrated = SD.Migrations.migrateState(old).state;
assert.deepEqual(migrated.jiraSites[0].inventorySettings.selectedProjectKeys, ['IT'], 'migration must repair selectedProjectKeys from projectDatasets');
const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8'),
  data = fs.readFileSync('src/ui/app/pages/data.js', 'utf8');
assert(textIncludes(events, 'SD.Utils.discoveryProjectKeys(s?.inventorySettings)'), 'sync click must use derived project scope');
assert(textIncludes(data, 'selected=SD.Utils.discoveryProjectKeys(s.inventorySettings).length'), 'Data page button must use the same derived project scope');
console.log('discovery-selection-consistency-test: OK');
