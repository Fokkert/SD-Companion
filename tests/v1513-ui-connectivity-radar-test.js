const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js', 'src/shared/migrations.js', 'src/shared/validators.js'])
  load(f);
const SD = SDCompanion, site = SD.Defaults.site();
assert.equal(site.behavior.connectionLossAlarm.enabled, true);
assert.equal(site.behavior.connectionLossAlarm.durationSeconds, 300);
assert.equal(site.behavior.connectionLossAlarm.failedChecks, 5);
assert.deepEqual(SD.Validators.validateConnectionLossAlarm(site.behavior.connectionLossAlarm), []);
assert(SD.Validators.validateConnectionLossAlarm({ ...site.behavior.connectionLossAlarm, durationSeconds: 1 }).length);
assert(SD.Validators.validateTransitionMethod('unsupported').length);
const legacy = SD.Defaults.state();
legacy.schemaVersion = 25;
legacy.jiraSites = [
  {
    ...site,
    inventorySettings: { ...site.inventorySettings, transitionMethod: 'unsupported' },
    behavior: { ...site.behavior, connectionLossAlarm: { enabled: true, durationMinutes: 7, trigger: 'duration', failedChecks: 8 } }
  }
];
const migrated = SD.Migrations.migrateState(legacy).state.jiraSites[0];
assert.equal(migrated.inventorySettings.transitionMethod, SD.Constants.TRANSITION_METHOD.WORKFLOW_DESIGNER);
assert.equal(migrated.behavior.connectionLossAlarm.durationSeconds, 420);
assert.equal(migrated.behavior.connectionLossAlarm.failedChecks, 8);
const rules = fs.readFileSync('src/ui/app/pages/rules.js', 'utf8'),
  core = fs.readFileSync('src/ui/app/app-core.js', 'utf8'),
  events = fs.readFileSync('src/ui/app/app-events.js', 'utf8'),
  servers = fs.readFileSync('src/ui/app/pages/servers.js', 'utf8'),
  actions = fs.readFileSync('src/ui/app/pages/rule-actions.js', 'utf8'),
  help = fs.readFileSync('src/ui/app/pages/help.js', 'utf8'),
  sw = fs.readFileSync('src/background/service-worker.js', 'utf8'),
  css = fs.readFileSync('src/ui/app/app.css', 'utf8'),
  components = fs.readFileSync('src/ui/common/components.css', 'utf8'),
  data = fs.readFileSync('src/ui/app/pages/data.js', 'utf8');
assert(textIncludes(rules, 'Search fetched filters…') && textIncludes(core, 'glass-multi-search') && textIncludes(events, "matches?.('.glass-multi-search')"), 'fetched rule filters must be searchable');
for (const id of ['transitionMethodEdit', 'connectionLossAlarmEnabled', 'connectionLossTrigger', 'connectionLossDuration', 'connectionLossFailures'])
  assert(textIncludes(servers, id), id);
for (const mode of ['WORKFLOW_DESIGNER', 'ISSUE_EXTRACTION', 'TARGET_STATUS_RANDOM', 'MANUAL_NAME'])
  assert(textIncludes(actions, mode) || textIncludes(servers, mode), mode);
assert(textIncludes(help, 'intentionally nondeterministic') && textIncludes(help, 'multiple exact-name matches fail as ambiguous'), 'transition method descriptions must live in Help');
assert(textIncludes(sw, 'connectionLossStartedAt') && textIncludes(sw, 'connectionLossFailures') && textIncludes(sw, 'maybePlayConnectionLossAlarm') && textIncludes(sw, "ruleName:'Jira connection lost'"));
assert(textIncludes(sw, 'collectCurrentMatches') && textIncludes(sw, 'updateRadar(s,p||profile,current.detections)') && textIncludes(sw, 'profile.runtime.currentDetections=current.rows'), 'scheduled cycles must maintain a full current snapshot for radar/current detections');
assert(textIncludes(css, '.detection-row') && textIncludes(css, '.rule-card{padding:8px 10px!important') && textIncludes(css, '.data-content>#inventorySearch{margin-bottom:10px!important}'), 'compact cards/data spacing regression');
assert(textIncludes(css, '.master-switch{position:relative;display:block;width:56px;height:32px}') && textIncludes(servers, 'class="master-switch"') && textIncludes(rules, 'class="master-switch"'), 'boolean settings must reuse Home master-switch');
assert(textIncludes(css, '.master-switch>span::after{top:50%!important;left:5px!important;width:22px!important;height:22px!important'), 'Shared toggle thumb must keep safe edge clearance');
assert(textIncludes(data, "workflowSource==='issue-extraction'") && textIncludes(data, 'No synchronized transitions.'));
console.log('v1513-ui-connectivity-radar-test: OK');
