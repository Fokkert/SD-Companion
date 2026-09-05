'use strict';

const fs = require('fs');
const assert = require('assert');
const { textIncludes } = require('./source-assertions');
const read = file => fs.readFileSync(file, 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const constants = read('src/shared/constants.js');
const defaults = read('src/shared/defaults.js');
const home = read('src/ui/app/pages/home.js');
const data = read('src/ui/app/pages/data.js');
const servers = read('src/ui/app/pages/servers.js');
const rules = read('src/ui/app/pages/rules.js');
const actions = read('src/ui/app/pages/rule-actions.js');
const settings = read('src/ui/app/pages/logs-more.js');
const alarms = read('src/ui/app/pages/alarms.js');
const events = read('src/ui/app/app-events.js');
const appMain = read('src/ui/app/app-main.js');
const worker = read('src/background/service-worker.js');
const discovery = read('src/background/discovery.js');
const offscreen = read('src/offscreen/alarm.js');
const softSelect = read('src/ui/app/soft-select.js');
const css = read('src/ui/app/app.css');
const readme = read('README.md');
const sample = JSON.parse(read('sample-profile.json'));

assert.equal(manifest.version, '2.5.3');
assert.equal(manifest.commands, undefined, 'alarm stop shortcut is now profile-configured, not a static extension command');
assert(textIncludes(constants, 'BUILD_VERSION:"2.5.3"'));
assert(textIncludes(constants, 'SCHEMA_VERSION:34'));
for (const id of ['keyboard', 'duration', 'click-anywhere', 'popup']) assert(constants.includes(`id: "${id}"`));
assert(!constants.includes('duration-or-controls'));

assert(readme.startsWith('# SD Companion (Service Desk Companion)'));
assert(!readme.includes('SD-Companion-v2.3.0'));

// Show completed text is no longer the checkbox label; only its switch label is interactive.
assert(home.includes('<div class="row control-label show-completed-control"'));
assert(!home.includes('<label class="show-completed-control">'));

// API Data is expandable/removable for every synchronized inventory type.
assert(data.includes('metadata-detail-card'));
assert(data.includes('data-action="exclude-inventory-item"'));
assert(data.includes('data-action="restore-inventory-type"'));
assert(servers.includes('Restore removed data on refresh'));
assert(servers.includes('discovery-project-card'));
assert(servers.includes("['transitions', 'Transitions']"));
assert(worker.includes('applyInventoryExclusions'));
assert(discovery.includes('omitExcluded'));

// Alarm Profiles belong to a real profile and Alarm actions select one.
assert(defaults.includes('alarmProfiles: [alarmProfile]'));
assert(defaults.includes('defaultAlarmProfileId: alarmProfile.id'));
assert(actions.includes('Alarm profile'));
assert(actions.includes('data-aprop="alarmProfileId"'));
assert(settings.includes("link('alarms', 'Alarm Profiles')"));
assert(!alarms.includes('Browser notification'));
assert(alarms.includes('Keyboard shortcut'));
assert(alarms.includes('Click anywhere') || constants.includes('Click anywhere'));
assert(events.includes('new-alarm-profile'));
assert(events.includes('delete-alarm-profile'));
assert(events.includes('MESSAGE.UPDATE_ALARM_VOLUME'));
assert(offscreen.includes('SD_OFFSCREEN_VOLUME'));
assert(appMain.includes("alarm.stopMethod === 'click-anywhere'"));
assert(alarms.includes('data-action="choose-alarm-file"'));
assert(settings.includes('<span>Action Completion Tone</span>'));

// Standard switches are circular; only Home Monitoring keeps cubic geometry.
assert(textIncludes(css, '.master-switch>span{border-radius:999px!important}'));
assert(textIncludes(css, '.master-switch>span::after{border-radius:50%!important}'));
assert(textIncludes(css, '.radar-monitor-controls .master-switch>span{border-radius:7px!important}'));
assert(softSelect.includes('below < desiredHeight && above >= desiredHeight'));

// Rules: per-card enable toggle + Duplicate, square enabled icon, no redundant editor chips.
assert(rules.includes('data-rule-enabled-id='));
assert(rules.includes('data-action="duplicate-rule"'));
assert(!rules.includes('duplicate-selected-rule'));
assert(rules.includes('data-rule-card-id='));
assert(css.includes('.rule-card.enabled .rule-entry-icon'));
assert(!rules.includes('rule-editor-stats'));
assert(rules.includes('Condition groups'));
assert(rules.includes('Match all groups'));
assert(rules.includes('data-rule-source-mode="true"'));
assert(rules.includes('<option value="conditions"'));
assert(rules.includes('>Manual</option>'));
assert(rules.includes('>JQL</option>'));
assert(actions.includes('<details class="action-card'));

// Export template carries the new model and server exclusion policy.
assert.equal(sample.version, 4);
assert(Array.isArray(sample.profile.alarmProfiles) && sample.profile.alarmProfiles.length === 1);
assert(sample.profile.defaultAlarmProfileId);
assert(sample.server.inventorySettings.excludedData);
assert.equal(sample.server.inventorySettings.restoreExcludedOnRefresh, false);

console.log('v240-feature-regression-test: PASS');
