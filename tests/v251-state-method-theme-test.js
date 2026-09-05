const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const load = f => vm.runInThisContext(read(f), { filename: f });

load('src/shared/constants.js');
load('src/shared/utils.js');
load('src/shared/defaults.js');
load('src/shared/migrations.js');

const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.6.2');

// A filter-only legacy/JQL rule must retain its selected filter after migration/load.
const state = SD.Defaults.state();
const profile = state.profiles[0];
const rule = SD.Defaults.rule('Filter rule');
rule.source = { filterIds: ['42'], jql: '' }; // pre-mode/legacy shape
profile.rules = [rule];
const migrated = SD.Migrations.migrateState(state).state;
assert.equal(migrated.profiles[0].rules[0].source.mode, 'jql');
assert.deepEqual(migrated.profiles[0].rules[0].source.filterIds, ['42']);

const rules = read('src/ui/app/pages/rules.js');
const bulk = read('src/ui/app/pages/bulk-operations.js');
const events = read('src/ui/app/app-events.js');
const core = read('src/ui/app/app-core.js');
const alarms = read('src/ui/app/pages/alarms.js');
const appearance = read('src/ui/app/pages/appearance.js');
const theme = read('src/ui/common/theme.css');
const css = read('src/ui/app/app.css');
const schedules = read('src/ui/app/pages/schedules.js');

assert(rules.includes('data-rule-source-mode="true"'));
assert(bulk.includes('data-rule-source-mode="true"'));
assert(!rules.includes('data-action="rule-source-mode"'));
assert(events.includes("r.source.filterIds = [];"));
assert(events.includes("r.logic = { operator: 'AND', groups: [] }"));
assert(events.includes("r.logic = structuredClone(SD.Defaults.rule().logic)"));
assert(core.includes('navigationBlockReason'));
assert(core.includes('cleanupPageUiState'));
assert(core.includes('navigateToPage'));
assert(core.includes('Save or cancel the rule before leaving Rules.'));
assert(alarms.includes('id="alarmDefaultProfile"'));
assert(!alarms.includes('Make Default'));
assert(appearance.includes("'black-glass', 'Black'"));
assert(appearance.includes("'aurora-glass', 'Aurora Night'"));
assert(appearance.includes("'cyber-glass', 'Cyber Night'"));
assert(appearance.includes("'slate-gold-glass', 'Slate & Gold'"));
assert(!appearance.includes('Violet Dusk'));
assert(!appearance.includes('Amber Smoke'));
assert(theme.includes('html[data-theme="black-glass"]'));
assert(css.includes('.transition-card > summary::after'));
assert(css.includes('display: none !important'));
const meta = schedules.indexOf('schedule-entry-meta');
const dot = schedules.indexOf('schedule-state', meta);
const text = schedules.indexOf('list-meta', meta);
assert(dot >= 0 && text >= 0 && dot < text, 'schedule activity dot must precede description text');

console.log('v2.6.2 state/method/theme regression: OK');
