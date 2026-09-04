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
const state = SD.Defaults.state(),
  site = SD.Defaults.site({ id: 's', baseUrl: 'https://jira.example.test' });
site.inventorySettings.maxTransitionSamples = 2000;
site.inventorySettings.transitionSamplesPerContext = 99;
site.fields = [
  { fieldId: 'summary', name: 'Summary', projectKey: 'IT', issueTypeId: '1', schema: { type: 'string' } },
  { fieldId: 'summary', name: 'Summary', projectKey: 'IT', issueTypeId: '2', schema: { type: 'string' } },
  { fieldId: 'customfield_10000', name: 'Location', projectKey: 'IT', issueTypeId: '1', schema: { custom: 'x', type: 'string' } },
  { fieldId: 'customfield_10000', name: 'Location', projectKey: 'HR', issueTypeId: '3', schema: { custom: 'x', type: 'string' } }
];
site.transitionCatalog = [
  { projectKey: 'IT', issueTypeId: '1', statusId: '10', transitions: [{ id: '21', name: 'Start Progress', toStatusId: '20' }, { id: '31', name: 'Resolve', toStatusId: '30' }] },
  { projectKey: 'IT', issueTypeId: '2', statusId: '10', transitions: [{ id: '21', name: 'Start Progress', toStatusId: '20' }] }
];
site.inventory.counts = { fields: 4, transitions: 3, transitionContexts: 2 };
site.inventory.freshness = { fields: { at: 'x', count: 4, scope: 'old' }, transitions: { at: 'x', count: 3, scope: 'old' } };
state.jiraSites = [site];
state.schemaVersion = 22;
const migrated = SD.Migrations.migrateState(state).state, s = migrated.jiraSites[0];
assert.equal(migrated.schemaVersion, 33);
assert.deepEqual(s.fields.map(f => f.id), ['summary', 'customfield_10000'], 'cached contextual field duplicates must be collapsed by Jira field id');
assert(!('projectKey' in s.fields[0]) && !('issueTypeId' in s.fields[0]), 'cached fields must be canonical global field records');
assert.equal(s.inventory.counts.fields, 2);
assert.equal(s.inventory.counts.transitions, 3, 'transition count must preserve workflow-context transition observations');
assert.equal(s.inventory.counts.transitionContexts, 2);
assert.equal(s.inventory.freshness.fields.count, 2);
assert.equal(s.inventory.freshness.transitions.count, 3);
assert(!('maxTransitionSamples' in s.inventorySettings));
assert(!('transitionSamplesPerContext' in s.inventorySettings));
console.log('v155-metadata-sync-test: OK');
