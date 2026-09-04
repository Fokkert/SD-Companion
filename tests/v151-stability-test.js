const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/migrations.js'
])
  load(f);
const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.1.1');
assert.equal(SD.Constants.SCHEMA_VERSION, 33);
assert.deepEqual(SD.Defaults.profile().schedules, [], 'fresh profiles must have zero named schedules');
const base = SD.Defaults.state(),
  site = SD.Defaults.site({ id: 'site1', baseUrl: 'https://jira.example.test', name: 'Production Jira' }),
  stock = { ...SD.Defaults.schedule('Business Hours'), id: 'stock' },
  p = { ...SD.Defaults.profile('Production Jira', site), id: 'p1', siteId: site.id, schedules: [stock] };
site.activeProfileId = p.id;
const old = { ...base, schemaVersion: 20, jiraSites: [site], profiles: [p], activeSiteId: site.id, activeProfileId: p.id };
const migrated = SD.Migrations.migrateState(old).state;
assert.equal(migrated.profiles[0].name, 'Default Profile', 'legacy auto-created profile named like its server should be normalized');
assert.equal(migrated.profiles[0].schedules.length, 0, 'legacy Business Hours default must be removed during 20 -> 21 migration');
const badRule = SD.Defaults.rule('Bad timing');
badRule.randomDelay = { minSeconds: -20, maxSeconds: 'broken', unit: 'seconds' };
const badState = {
  ...base,
  schemaVersion: 20,
  jiraSites: [site],
  profiles: [{ ...SD.Defaults.profile('Default Profile', site), id: 'p2', siteId: site.id, rules: [badRule] }],
  activeSiteId: site.id,
  activeProfileId: 'p2'
};
const fixed = SD.Migrations.migrateState(badState).state.profiles[0].rules[0];
assert(Number.isFinite(fixed.randomDelay.minSeconds) && Number.isFinite(fixed.randomDelay.maxSeconds) && fixed.randomDelay.minSeconds >= 0 && fixed.randomDelay.maxSeconds >= fixed.randomDelay.minSeconds, 'legacy rule timing must be normalized before draft editing');
const rules = fs.readFileSync('src/ui/app/pages/rules.js', 'utf8'),
  events = fs.readFileSync('src/ui/app/app-events.js', 'utf8'),
  data = fs.readFileSync('src/ui/app/pages/data.js', 'utf8'),
  help = fs.readFileSync('src/ui/app/pages/help.js', 'utf8'),
  alarm = fs.readFileSync('src/ui/app/pages/alarms.js', 'utf8'),
  home = fs.readFileSync('src/ui/app/pages/home.js', 'utf8'),
  main = fs.readFileSync('src/ui/app/app-main.js', 'utf8'),
  css = fs.readFileSync('src/ui/app/app.css', 'utf8');
assert(textIncludes(events, 'A.beginRuleEdit(nr,{isNew:true})'), 'new rule creation should start a local draft');
assert(textIncludes(events, "if(act==='save-rule')"), 'rules should persist only through Save Rule');
assert(!textIncludes(data, 'Non-favourite filters shown in Manage Filters cannot be enumerated'), 'filter API limitation text must not live on Data page');
assert(textIncludes(help, 'non-favourite filters visible in Jira\\\'s Manage Filters page'), 'filter API limitation belongs in Help');
assert(!textIncludes(alarm, 'alarmEscalationMode') && !textIncludes(alarm, 'Repeat until limit'), 'Alarm Studio must not expose escalation controls');
assert(!textIncludes(events, 'alarmEscalationMode') && !textIncludes(events, 'alarmRepeatEvery') && !textIncludes(events, 'alarmMaxRepeats'), 'Alarm Studio must not save escalation settings');
assert(textIncludes(home, 'activityRefreshLabel') && textIncludes(main, 'activityRefreshSeconds') && textIncludes(main, 'setTimeout'), 'Home activity refresh must use the configurable interval');
assert(!textIncludes(main, "details.activity-issue[open]") && textIncludes(main, 'tryHomeActivityRefresh'), 'activity refresh must continue even while issue history is being read');
assert(textIncludes(home, 'data-issue-key') && textIncludes(home, 'openIssues'), 'expanded issue history rows must be restored after an activity refresh');
assert(textIncludes(css, 'grid-template-columns:minmax(128px,190px) repeat(5,minmax(48px,58px))'), 'discovery matrix must pack dataset selectors near project names');
console.log('v151-stability-test: OK');
