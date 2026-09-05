const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/migrations.js'
]) load(f);
const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.6.1');
assert.equal(SD.Constants.SCHEMA_VERSION, 34);
const legacy = SD.Defaults.state();
legacy.schemaVersion = 24;
legacy.jiraSites = [
  {
    ...SD.Defaults.site({ id: 's', baseUrl: 'https://jira.internal' }),
    network: { transportMode: 'jira-tab', addressSpace: 'local', certificateMode: 'browser-exception', requestPolicy: { ...SD.Defaults.requestPolicy(), spacingMs: 777 } }
  }
];
const migrated = SD.Migrations.migrateState(legacy).state, network = migrated.jiraSites[0].network;
assert.deepEqual(Object.keys(network), ['requestPolicy']);
assert.equal(network.requestPolicy.spacingMs, 777);
const client = fs.readFileSync('src/api/jira-client.js', 'utf8'),
  servers = fs.readFileSync('src/ui/app/pages/servers.js', 'utf8'),
  sw = fs.readFileSync('src/background/service-worker.js', 'utf8'),
  tabs = fs.readFileSync('src/background/jira-tabs.js', 'utf8');
for (const bad of ['fetchViaJiraTab', 'JIRA_TAB_REQUIRED', 'transportMode', 'certificateMode', 'addressSpace']) assert(!client.includes(bad), bad);
for (const bad of ['REST transport', 'Network destination', 'Certificate handling', 'transportMode', 'certificateMode', 'addressSpace']) assert(!servers.includes(bad), bad);
assert(!fs.existsSync('src/background/transport.js'));
assert(sw.includes("'jira-tabs.js'"));
assert(!tabs.includes('fetch('));
assert(!tabs.includes('executeScript'));
assert(client.includes('NETWORK_REQUEST_FAILED'));
assert(!client.includes('targetAddressSpace'));
assert(client.includes('Local Network Access/CORS policy'));
console.log('v158-worker-network-test: OK');
