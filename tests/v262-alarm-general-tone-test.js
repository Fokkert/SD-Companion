const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const constants = read('src/shared/constants.js');
const events = read('src/ui/app/app-events.js');
const alarms = read('src/ui/app/pages/alarms.js');
const settings = read('src/ui/app/pages/logs-more.js');
const help = read('src/ui/app/pages/help.js');
const css = read('src/ui/app/app.css');

assert.equal(manifest.version, '2.6.2');
assert(constants.includes('BUILD_VERSION: "2.6.2"'));

// Alarm stop-method changes are live UI changes, not save/reopen changes.
const stopHandler = events.indexOf("if (el.id === 'alarmStopMethod') {");
const genericAlarmHandler = events.indexOf("if (['alarmPreset', 'alarmDurationUnit', 'alarmLoop', 'alarmUseCustom'].includes(el.id)) {");
assert(stopHandler >= 0 && genericAlarmHandler > stopHandler);
assert(events.includes("const previousMethod = A.ensureAlarmDraft?.()?.stopMethod || 'duration'"));
assert(events.includes("if (cfg.stopMethod !== previousMethod) cfg.keyboardShortcut = '';"));
assert(events.includes('storeAlarmDraft(cfg);\n          syncAlarmStopMethodFields(cfg);\n          return;'));
assert.equal((events.match(/el\.id === 'alarmStopMethod'/g) || []).length, 1);
assert(alarms.includes('id="alarmStopMethodFields"'));
assert(alarms.includes("alarm.stopMethod === 'keyboard' ? `<div class=\"field\"><label>Keyboard shortcut</label>"));
assert(alarms.includes('<label>Duration</label>'));

// Completion cue is a General setting and is absent from Operational Feedback.
assert(settings.includes('general-action-complete-tone'));
assert(settings.includes('<span>Action Complete Tone</span>'));
assert(settings.includes('title="Action Complete Tone"'));
assert(!settings.includes('<span>Action Completion Tone</span>'));
assert(!settings.includes('completion-tone-control setting-line setting-line-card'));
assert(css.includes('.general-action-complete-tone {'));
assert(css.includes('.automation-feedback-refresh {'));
assert(help.includes('Action Complete Tone'));
assert(help.includes('Settings → General'));

console.log('v2.6.2 alarm/settings regression: OK');
