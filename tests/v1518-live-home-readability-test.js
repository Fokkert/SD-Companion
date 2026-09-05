const { textIncludes } = require('./source-assertions');
const fs = require('fs'), assert = require('assert');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
const home = fs.readFileSync('src/ui/app/pages/home.js', 'utf8');
const core = fs.readFileSync('src/ui/app/app-core.js', 'utf8');
const main = fs.readFileSync('src/ui/app/app-main.js', 'utf8');
const sw = fs.readFileSync('src/background/service-worker.js', 'utf8');
const css = fs.readFileSync('src/ui/app/app.css', 'utf8');
assert.equal(manifest.version, '2.5.1');
assert(textIncludes(constants, 'BUILD_VERSION:"2.5.1"'));
// Every operational Home surface must participate in the lightweight periodic DOM refresh.
for (const id of ['homeMonitorCard', 'homeOperationalHealth', 'homeAlarmSlot', 'homeDetectionsActionsCard', 'homeScheduleCard'])
  assert(textIncludes(home, id), `${id} missing from Home live renderer`);
for (const id of ['homeOperationalHealth', 'homeAlarmSlot', 'homeDetectionsActionsCard', 'homeScheduleCard'])
  assert(textIncludes(home, `['${id}'`) || textIncludes(home, `["${id}"`), `${id} missing from Home refresh replacement list`);
assert(textIncludes(home, 'A.refreshHomeMonitorDom(s,p)'), 'monitor card must refresh in place so radar animation phase is preserved');
assert(!textIncludes(home, "['homeMonitorCard',monitorCard(s,p)]"), 'monitor card must not be replaced during periodic refresh');
assert(textIncludes(main, 'A.scheduleHomeRefresh') && textIncludes(main, 'A.tryHomeActivityRefresh'));
assert(textIncludes(core, "else if(p==='home')A.pullHomeActivity().then(finish)"), 'returning Home must pull fresh worker state');
assert(textIncludes(home, 'openIssues=new Set') && textIncludes(home, 'if(el)el.open=true'), 'expanded activity history must survive live refresh');
// Radar data refreshes in place while the sweep node remains mounted.
assert(textIncludes(home, 'const monitorCard=') && textIncludes(home, 'radar(s,p,live)') && textIncludes(home, 'radarDots(s,p)'));
assert(textIncludes(home, "radarEl.querySelectorAll('.radar-dot').forEach(x=>x.remove())"));
// Connection alarms must not present as Jira issue detections.
assert(textIncludes(sw, '"SD Companion · API Unreachable"'));
assert(textIncludes(sw, 'kind:meta.source==="Connection monitor"?"API Unreachable":"Jira issue detected"'));
assert(textIncludes(home, "connectionAlarm?'API Unreachable'"));
// One smaller shared toggle geometry remains in use for both Home and settings.
assert(textIncludes(css, '.master-switch{position:relative;display:block;width:56px;height:32px}'));
assert(textIncludes(css, '.master-switch span::after{content:"";position:absolute;top:50%;left:4px;width:24px;height:24px'));
assert(textIncludes(css, '.master-switch input:checked+span::after{transform:translate(24px,-50%)'));
// Rule cards must be readable and keep controls to the right.
assert(textIncludes(css, 'grid-template-columns:minmax(0,1fr) auto!important'));
assert(textIncludes(css, '.rule-card-actions{justify-self:end!important'));
assert(textIncludes(css, '.rule-card .list-title{font-size:14px!important'));
assert(textIncludes(css, '.rule-card .list-meta{font-size:12px!important'));
assert(textIncludes(css, '.rule-card .btn-small{padding:7px 11px!important;min-height:34px!important;font-size:12px!important'));
console.log('v1518-live-home-readability-test: OK');
