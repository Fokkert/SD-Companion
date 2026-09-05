const { textIncludes, compactSlice } = require('./source-assertions');
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('manifest.json')),
  constants = read('src/shared/constants.js'),
  rules = read('src/ui/app/pages/rules.js'),
  actions = read('src/ui/app/pages/rule-actions.js'),
  conditions = read('src/ui/app/pages/rule-conditions.js'),
  settings = read('src/ui/app/pages/logs-more.js'),
  alarms = read('src/ui/app/pages/alarms.js'),
  events = read('src/ui/app/app-events.js'),
  pages = read('src/ui/app/app-pages.js'),
  worker = read('src/background/service-worker.js'),
  engine = read('src/background/rule-engine.js'),
  defaults = read('src/shared/defaults.js'),
  migrations = read('src/shared/migrations.js'),
  css = read('src/ui/app/app.css'),
  servers = read('src/ui/app/pages/servers.js');
assert.equal(manifest.version, '2.6.5');
assert.equal(manifest.version_name, 'V2');
assert(textIncludes(constants, 'BUILD_VERSION:"2.6.5"'));
// Alarm configuration is profile-owned and actions reference Alarm Profiles.
assert(textIncludes(settings, 'Alarm Profiles'));
assert(textIncludes(alarms, 'id="alarmPreset"'));
assert(!textIncludes(alarms, 'id="alarmSystemNotification"'));
assert(!textIncludes(alarms, 'id="alarmPagePopup"'));
assert(textIncludes(pages, 'alarms:A.pageAlarms'));
assert(textIncludes(actions, 'Alarm profile'));
assert(textIncludes(actions, 'data-aprop="alarmProfileId"'));
assert(textIncludes(engine, 'profile.alarmProfiles||[]'));
assert(textIncludes(engine, 'action.alarmProfileId'));
assert(textIncludes(defaults, 'alarmProfileId:""'));
assert(textIncludes(migrations, 'delete profile.alarmDefaults'));
// Detection Source belongs to Conditions, not Setup.
const setup = compactSlice(rules, "if(section==='setup')", "else if(section==='conditions')");
const cond = compactSlice(rules, "else if(section==='conditions')", "else if(section==='actions')");
assert(!textIncludes(setup, 'Detection source'));
assert(textIncludes(cond, 'Detection method'));
assert(textIncludes(cond, 'Manual'));
assert(textIncludes(cond, 'Saved filters · optional'));
// Conditional action header and shared switches have bounded geometry / spacing.
assert(textIncludes(conditions, 'action-condition-head'));
assert(textIncludes(conditions, 'action-condition-match'));
assert(textIncludes(conditions, 'action-condition-add'));
assert(textIncludes(css, 'grid-template-columns:minmax(0,1fr) 116px'));
assert(textIncludes(css, 'left:5px!important;width:22px!important;height:22px!important'));
assert(textIncludes(css, 'transform:translate(24px,-50%)!important'));
assert(textIncludes(css, '.action-conditions{display:grid!important;gap:12px!important'));
// Server URL editing is visible, normalized, duplicate-safe and keeps the stable site id.
assert(textIncludes(servers, 'id="serverUrlEdit"'));
assert(textIncludes(events, "SD.Utils.normalizeBaseUrl(A.$('serverUrlEdit')?.value||s.baseUrl)"));
assert(textIncludes(events, 'baseUrl,name:'));
assert(textIncludes(worker, "state.jiraSites.find(x=>x.id!==s.id&&SD.Utils.normalizeBaseUrl(x.baseUrl)===nextBase"));
assert(textIncludes(worker, "code:'DUPLICATE_SERVER_URL'"));
assert(textIncludes(worker, 's.baseUrl=nextBase'));
assert(!textIncludes(worker, 's.id=SD.Utils.siteIdFromBaseUrl(nextBase)'));
// Migration removes obsolete per-rule Alarm overrides while retaining profile alarm defaults.
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/migrations.js'
])
  vm.runInThisContext(read(f), { filename: f });
const SD = SDCompanion,
  site = SD.Defaults.site({ baseUrl: 'https://jira.example' }),
  profile = SD.Defaults.profile('P', site),
  rule = SD.Defaults.rule('R');
rule.actions = [{ ...SD.Defaults.action(SD.Constants.ACTION.ALARM), preset: 'bell', volume: .2, showPagePopup: false }];
profile.rules = [rule];
const st = SD.Defaults.state();
st.jiraSites = [site];
st.profiles = [profile];
st.activeSiteId = site.id;
st.activeProfileId = profile.id;
const migrated = SD.Migrations.migrateState(st).state.profiles[0];
assert.equal(migrated.alarmProfiles.length, 1);
assert.equal(migrated.alarmProfiles[0].preset, 'radar');
assert.equal(migrated.rules[0].actions[0].alarmProfileId, migrated.defaultAlarmProfileId);
assert(!('preset' in migrated.rules[0].actions[0]));
assert(!('volume' in migrated.rules[0].actions[0]));
console.log('v204-alarm-layout-server-url-test: OK');
