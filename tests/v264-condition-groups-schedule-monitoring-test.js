const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};

const rootPath = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(rootPath, rel), 'utf8');
const load = rel => vm.runInThisContext(read(rel), { filename: rel });

for (const file of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/defaults.js',
  'src/shared/migrations.js',
  'src/background/rule-engine.js'
]) load(file);

const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.6.4');
assert.equal(JSON.parse(read('manifest.json')).version, '2.6.4');

// Rule Condition groups are first-class persisted structure. A normal state
// migration/load must never flatten multiple groups into Group 1 or replace
// the root Match-any operator with Match-all.
const state = SD.Defaults.state();
state.schemaVersion = SD.Constants.SCHEMA_VERSION;
const rule = SD.Defaults.rule('Multi-group persistence');
rule.source.mode = 'conditions';
rule.logic.operator = 'OR';

const first = SD.Defaults.group();
first.id = 'group-one';
first.operator = 'AND';
first.conditions = [
  { ...SD.Defaults.condition('project'), id: 'condition-project', operator: 'is-any-of', values: ['IT'], value: '' }
];

const second = SD.Defaults.group();
second.id = 'group-two';
second.operator = 'OR';
second.conditions = [
  { ...SD.Defaults.condition('status'), id: 'condition-status', operator: 'is-any-of', values: ['Open'], value: '' },
  { ...SD.Defaults.condition('priority'), id: 'condition-priority', operator: 'is-any-of', values: ['High'], value: '' }
];
rule.logic.groups = [first, second];
state.profiles[0].rules = [rule];

const once = SD.Migrations.migrateState(state).state;
const saved = once.profiles[0].rules[0].logic;
assert.equal(saved.operator, 'OR', 'root Match any must survive migration/load');
assert.equal(saved.groups.length, 2, 'migration/load must preserve both condition groups');
assert.equal(saved.groups[0].id, 'group-one');
assert.equal(saved.groups[1].id, 'group-two');
assert.equal(saved.groups[0].operator, 'AND');
assert.equal(saved.groups[1].operator, 'OR');
assert.deepEqual(saved.groups[0].conditions.map(c => c.id), ['condition-project']);
assert.deepEqual(saved.groups[1].conditions.map(c => c.id), ['condition-status', 'condition-priority']);

// Re-running migration simulates another GET_STATE / extension reload cycle.
const twice = SD.Migrations.migrateState(once).state.profiles[0].rules[0].logic;
assert.equal(twice.operator, 'OR');
assert.equal(twice.groups.length, 2);
assert.deepEqual(twice.groups.map(g => g.id), ['group-one', 'group-two']);
assert.deepEqual(twice.groups[1].conditions.map(c => c.id), ['condition-status', 'condition-priority']);

const migrations = read('src/shared/migrations.js');
assert(!migrations.includes('simplifyLogic('), 'legacy flattening must not run during normal state migration');
assert(migrations.includes('logic: preserveRuleLogic(old.logic || d.logic)'));

// Schedule-aware monitoring must regard an enabled rule as runnable only while
// one of its configured schedules is active. Always-on rules remain runnable.
const profile = SD.Defaults.profile('Schedule aware');
const schedule = SD.Defaults.schedule('Business hours');
schedule.id = 'business-hours';
schedule.timeZone = 'UTC';
schedule.days = [1]; // Monday
schedule.startTime = '09:00:00';
schedule.endTime = '17:00:00';
profile.schedules = [schedule];

const scheduledRule = SD.Defaults.rule('Scheduled');
scheduledRule.enabled = true;
scheduledRule.schedule = { mode: 'scheduled', scheduleIds: ['business-hours'] };
profile.rules = [scheduledRule];

assert.equal(SD.RuleEngine.profileHasActiveEnabledRules(profile, new Date('2026-09-06T12:00:00Z')), false, 'Sunday must not activate the Monday schedule');
assert.equal(SD.RuleEngine.profileHasActiveEnabledRules(profile, new Date('2026-09-07T12:00:00Z')), true, 'Monday noon must activate the schedule');

scheduledRule.schedule = { mode: 'always', scheduleIds: [] };
assert.equal(SD.RuleEngine.profileHasActiveEnabledRules(profile, new Date('2026-09-06T12:00:00Z')), true, 'Always-on enabled rules remain runnable');

const worker = read('src/background/service-worker.js');
assert(worker.includes('const monitoringActiveForSite ='));
assert(worker.includes('profileHasActiveEnabledRules(profile, new Date())'));
assert(worker.includes("reason: 'no-active-scheduled-rules'"));
assert(worker.includes('state.jiraSites.filter(s => s.auth.configured && monitoringActiveForSite(state, s.id))'), 'health checks must be gated by current schedule activity');
assert(worker.indexOf("if (!profileHasActiveEnabledRules(profile, new Date()))") < worker.indexOf('const q = await queryRuleIssues'), 'schedule gate must happen before Jira rule queries');

console.log('v2.6.4 condition-group and schedule-aware monitoring regression: OK');
