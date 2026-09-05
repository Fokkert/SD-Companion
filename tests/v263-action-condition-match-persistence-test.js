const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const load = rel => vm.runInThisContext(read(rel), { filename: rel });

load('src/shared/constants.js');
load('src/shared/utils.js');
load('src/shared/condition-registry.js');
load('src/shared/defaults.js');
load('src/shared/migrations.js');

const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.6.3');
assert.equal(JSON.parse(read('manifest.json')).version, '2.6.3');

// A v2.6.2-style Action Condition that persisted Match any only on the sole
// condition group must remain Match any after the normal state migration pass.
const state = SD.Defaults.state();
const rule = SD.Defaults.rule('Action condition persistence');
const action = SD.Defaults.action(SD.Constants.ACTION.COMMENT);
action.when.enabled = true;
action.when.logic.operator = 'AND';
action.when.logic.groups[0].operator = 'OR';
action.when.logic.groups[0].conditions.push(SD.Defaults.condition('status'));
rule.actions = [action];
state.profiles[0].rules = [rule];

const migrated = SD.Migrations.migrateState(state).state;
const savedLogic = migrated.profiles[0].rules[0].actions[0].when.logic;
assert.equal(savedLogic.operator, 'OR');
assert.equal(savedLogic.groups[0].operator, 'OR');

// If an imported state has a stale top-level OR but its sole group is AND,
// preserve the group's actual execution semantics and repair the top level to AND.
const staleState = SD.Defaults.state();
const staleRule = SD.Defaults.rule('Stale root operator');
const staleAction = SD.Defaults.action(SD.Constants.ACTION.COMMENT);
staleAction.when.enabled = true;
staleAction.when.logic.operator = 'OR';
staleAction.when.logic.groups[0].operator = 'AND';
staleRule.actions = [staleAction];
staleState.profiles[0].rules = [staleRule];
const staleMigrated = SD.Migrations.migrateState(staleState).state.profiles[0].rules[0].actions[0].when.logic;
assert.equal(staleMigrated.operator, 'AND');
assert.equal(staleMigrated.groups[0].operator, 'AND');

const events = read('src/ui/app/app-events.js');
const conditions = read('src/ui/app/pages/rule-conditions.js');

// The live editor writes both representations before the draft is saved.
assert(events.includes("const op = el.value === 'OR' ? 'OR' : 'AND';"));
assert(events.includes('g.operator = op;\n          logic.operator = op;'));
// Save normalization also repairs any legacy divergence.
assert(events.includes("const op = groups[0].operator === 'OR' ? 'OR' : 'AND';"));
// Reopening the editor renders from the same canonical Match all/any value.
assert(conditions.includes("matchOperator = g.operator === 'OR' ? 'OR' : 'AND'"));
assert(conditions.includes("${matchOperator === 'OR' ? 'selected' : ''}>Match any"));

console.log('v2.6.3 action-condition Match any persistence regression: OK');
