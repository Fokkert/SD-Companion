const { textIncludes } = require('./source-assertions');
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const ROOT = process.cwd();
const read = f => fs.readFileSync(`${ROOT}/${f}`, 'utf8');
const constants = read('src/shared/constants.js'),
  defaults = read('src/shared/defaults.js'),
  core = read('src/ui/app/app-core.js'),
  events = read('src/ui/app/app-events.js'),
  schedules = read('src/ui/app/pages/schedules.js'),
  rules = read('src/ui/app/pages/rules.js'),
  alarms = read('src/ui/app/pages/alarms.js'),
  servers = read('src/ui/app/pages/servers.js'),
  worker = read('src/background/service-worker.js'),
  main = read('src/ui/app/app-main.js');
assert(textIncludes(constants, 'BUILD_VERSION:"2.5.0"'));
assert(textIncludes(constants, 'SCHEMA_VERSION:34'));
// Schedule editor must be staged, not autosave on field/day click.
assert(textIncludes(core, 'scheduleDraft:null') && textIncludes(core, 'beginScheduleEdit') && textIncludes(core, 'discardScheduleEdit'));
assert(textIncludes(schedules, 'data-action="save-schedule"') && textIncludes(schedules, 'data-action="cancel-schedule-editor"'));
assert(!textIncludes(events, "if(el.dataset.scheduleProp){const sc=activeSchedule();if(!sc)return;setPath(sc,el.dataset.scheduleProp,typed(el));await A.save"));
assert(!textIncludes(events, "if(el.dataset.scheduleDay!==undefined){const sc=activeSchedule();if(!sc)return;const d=Number(el.dataset.scheduleDay),set=new Set(sc.days||[]);el.checked?set.add(d):set.delete(d);sc.days=[...set].sort();await A.save"));
assert(textIncludes(events, "if(act==='save-schedule')"));
// Rule schedule mapping is explicitly multi-select and runtime keeps any-schedule semantics.
assert(textIncludes(rules, 'data-rule-schedule-multi="true"'));
assert(textIncludes(rules, 'schedule.scheduleIds'));
assert(textIncludes(rules, 'selected</span>'));
const scheduleRuntime = read('src/shared/schedule.js'),
  engine = read('src/background/rule-engine.js');
assert(textIncludes(scheduleRuntime, 'matchesAny'));
assert(textIncludes(engine, 'root.Schedule.matchesAny(profile.schedules,s.scheduleIds,at)'));
// Alarm Profile settings keep a local draft inside Settings and live-switch a test alarm.
assert(textIncludes(core, 'alarmDraft:null') && textIncludes(core, 'ensureAlarmDraft'));
assert(textIncludes(alarms, 'A.ensureAlarmDraft'));
assert(textIncludes(main, 'source:m.alarm?.source||""'));
assert(textIncludes(events, "el.id==='alarmPreset'&&A.state?.runtime?.activeAlarm?.active&&A.state.runtime.activeAlarm.source==='Alarm Settings Test'"));
assert(!textIncludes(events, 'await A.load();}return;}') || textIncludes(events, "await A.send(MESSAGE.PLAY_ALARM,{alarm:preview,meta:alarmTestMeta()});}return;"));
// Focus Jira tab is a separate per-server behavior and works even if refresh is disabled.
assert(textIncludes(defaults, 'focusJiraTabOnDetection:false'));
assert(textIncludes(servers, 'id="focusJiraTabOnDetection"'));
assert(textIncludes(events, 'focusJiraTabOnDetection:Boolean'));
assert(textIncludes(worker, 'focus=Boolean(site?.behavior?.focusJiraTabOnDetection)'));
assert(textIncludes(worker, "chrome.tabs.update(focusTarget.id,{active:true})"));
assert(textIncludes(worker, "chrome.windows.update(focusTarget.windowId,{focused:true})"));
console.log('v1522-schedule-alarm-focus-test: OK');
