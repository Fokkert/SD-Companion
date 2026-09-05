
'use strict';

const fs = require('fs');
const assert = require('assert');
const { textIncludes } = require('./source-assertions');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
const home = fs.readFileSync('src/ui/app/pages/home.js', 'utf8');
const rules = fs.readFileSync('src/ui/app/pages/rules.js', 'utf8');
const bulk = fs.readFileSync('src/ui/app/pages/bulk-operations.js', 'utf8');
const actions = fs.readFileSync('src/ui/app/pages/rule-actions.js', 'utf8');
const servers = fs.readFileSync('src/ui/app/pages/servers.js', 'utf8');
const settings = fs.readFileSync('src/ui/app/pages/logs-more.js', 'utf8');
const help = fs.readFileSync('src/ui/app/pages/help.js', 'utf8');
const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');
const css = fs.readFileSync('src/ui/app/app.css', 'utf8');

assert.equal(manifest.version, '2.6.0');
assert(textIncludes(constants, 'BUILD_VERSION:"2.6.0"'));

// Action choosers share one readable alphabetically sorted option source.
assert(actions.includes('const actionOptions = () => Object.values(ACTION)'));
assert(actions.includes('.sort((a, b) => a.label.localeCompare(b.label))'));
assert(textIncludes(rules, '${actionOptions()}'));
assert(textIncludes(bulk, '${actionOptions()}'));

// Monitoring status is inline, statistics are separated, and toggles use cubic geometry.
assert(home.includes('class="monitor-status-line">Monitoring <span data-home-monitor-state>'));
assert(home.includes('class="monitor-section-divider"'));
assert(css.includes('.radar-monitor-controls .master-switch > span::after'));
assert(textIncludes(css, 'border-radius:4px!important'));

// Action Completion Tone is the user-facing terminology.
assert(settings.includes('<span>Action Completion Tone</span>'));
assert(help.includes('Action Completion Tone'));
assert(!settings.includes('<span>Action Bell</span>'));

// Server settings are deliberately grouped and no longer show the low-value failure counter copy.
for (const label of ['Connection & behavior', 'Discovery & synchronized data', 'API pacing & health', 'Credentials & deletion'])
  assert(servers.includes(label));
assert(!servers.includes('consecutive failed check(s)'));
assert(servers.indexOf('Connection & behavior') < servers.indexOf('Discovery & synchronized data'));
assert(servers.indexOf('Discovery & synchronized data') < servers.indexOf('API pacing & health'));

// Rule action setting helper text moved to Help.
assert(!rules.includes('Limits Alarm and Notification actions from this rule within a rolling time window.'));
assert(!rules.includes('Choose whether an After previous action continues when the preceding action does not succeed.'));
assert(help.includes('Local alert rate limiting caps Alarm/Notification actions'));
assert(help.includes('Chained action dependency decides separately'));

// Extension action indicator uses compact semantic badge states.
assert(textIncludes(worker, "text='ON'"));
assert(textIncludes(worker, "text='ERR'"));
assert(textIncludes(worker, "text='!'"));
assert(textIncludes(worker, 'setBadgeText({text})'));
assert(textIncludes(worker, 'setBadgeBackgroundColor({color:background})'));

console.log('v230-ui-packaging-regression-test: PASS');
