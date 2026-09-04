const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const css = fs.readFileSync('src/ui/app/app.css', 'utf8');
const alarms = fs.readFileSync('src/ui/app/pages/alarms.js', 'utf8');
const actions = fs.readFileSync('src/ui/app/pages/rule-actions.js', 'utf8');
const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8');
const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');
const engine = fs.readFileSync('src/background/rule-engine.js', 'utf8');
const defaults = fs.readFileSync('src/shared/defaults.js', 'utf8');
const validators = fs.readFileSync('src/shared/validators.js', 'utf8');
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
assert(textIncludes(css, 'top:50%;left:4px;width:24px;height:24px'));
assert(textIncludes(css, 'transform:translateY(-50%)'));
assert(textIncludes(css, 'transform:translate(24px,-50%)'));
for (const [name, text] of Object.entries({ alarms, actions, events, engine, defaults, validators, constants })) {
  assert(!/escalationEnabled|repeatEveryMinutes|repeatEveryUnit|maxRepeats|ALARM_ESCALATE/.test(text), `${name} still contains active escalation configuration`);
}
assert(!alarms.includes('Escalation') && !actions.includes('Escalation'));
assert(worker.includes('sd-active-alarm-escalate'), 'worker should clear a legacy pre-1.5.20 timer');
assert(!worker.includes('SD.Audio.escalate'));
console.log('v1519-alarm-toggle-cleanup-test: OK');
