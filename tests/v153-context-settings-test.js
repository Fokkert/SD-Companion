const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/migrations.js',
  'src/shared/validators.js'
])
  vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.6.1');
assert.equal(SD.Constants.SCHEMA_VERSION, 34);
const state = SD.Defaults.state();
assert.equal(state.system.activityRefreshSeconds, 3);
assert.equal(state.system.completionToneEnabled, true);
globalThis.SDApp = {
  esc: v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])),
  option: (v, l, sel = false) => `<option value="${v}" ${sel ? 'selected' : ''}>${l}</option>`,
  multiOptions: () => '',
  glassMulti: () => ''
};
vm.runInThisContext(fs.readFileSync('src/ui/app/pages/rule-actions.js', 'utf8'), { filename: 'rule-actions' });
const site = {
  filters: [{ id: 'f1', name: 'Open incidents', jql: 'project = IT AND issuetype = "Incident" AND status = "Open"' }, { id: 'f2', name: 'HR incidents', jql: 'project = HR AND issuetype = Incident' }],
  transitionCatalog: [
    {
      projectId: '10',
      projectKey: 'IT',
      projectName: 'IT',
      issueTypeId: '100',
      issueTypeName: 'Incident',
      statusId: '1',
      statusName: 'Open',
      transitions: [{ id: '31', name: 'Start Progress', toStatusId: '3', toStatusName: 'In Progress' }]
    },
    {
      projectId: '10',
      projectKey: 'IT',
      projectName: 'IT',
      issueTypeId: '200',
      issueTypeName: 'Task',
      statusId: '1',
      statusName: 'Open',
      transitions: [{ id: '41', name: 'Begin Task', toStatusId: '4', toStatusName: 'Doing' }]
    },
    {
      projectId: '20',
      projectKey: 'HR',
      projectName: 'HR',
      issueTypeId: '100',
      issueTypeName: 'Incident',
      statusId: '5',
      statusName: 'Waiting',
      transitions: [{ id: '51', name: 'Review', toStatusId: '6', toStatusName: 'Reviewing' }]
    }
  ],
  users: [],
  priorities: []
};
const byType = SD.Defaults.rule('By type');
byType.logic.groups[0].conditions = [{ id: 'c', field: 'issueType', operator: 'equals', value: '100', values: [] }];
let choices = SDApp.RuleViews.transitionChoices(site, byType);
assert.deepEqual(choices.map(x => x.name).sort(), ['Review', 'Start Progress']);
const byFilter = SD.Defaults.rule('By filter');
byFilter.source.filterIds = ['f1'];
choices = SDApp.RuleViews.transitionChoices(site, byFilter);
assert.deepEqual(choices.map(x => x.name), ['Start Progress']);
const byRaw = SD.Defaults.rule('By JQL');
byRaw.source.jql = 'project = HR AND status = Waiting';
choices = SDApp.RuleViews.transitionChoices(site, byRaw);
assert.deepEqual(choices.map(x => x.name), ['Review']);
const action = SD.Defaults.action('transition');
const html = SDApp.RuleViews.actionEditor(action, site, SD.Defaults.profile(), 0, byFilter);
assert(textIncludes(html, 'Start Progress'));
assert(textIncludes(html, 'In Progress'));
assert(!textIncludes(html, 'Begin Task'));
assert(!textIncludes(html, 'Reviewing'));
const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8');
assert(textIncludes(events, "if(act==='save-rule')"));
assert(textIncludes(events, 'A.beginRuleEdit(nr,{isNew:true})'));
assert(textIncludes(events, 'dataset.settingsProp'));
assert(textIncludes(events, "if(act==='save-settings')"));
const settings = fs.readFileSync('src/ui/app/pages/logs-more.js', 'utf8');
assert(textIncludes(settings, 'Periodic project-data sync'));
assert(textIncludes(settings, 'type="checkbox" data-settings-prop="autoSync.enabled"'));
assert(textIncludes(settings, 'Home history refresh'));
assert(textIncludes(settings, 'Action Completion Tone'));
assert(textIncludes(settings, 'Alarm Profiles'));
assert(!textIncludes(settings, 'Browser notification'));
const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');
assert(!textIncludes(events, 'A.send(MESSAGE.SAVE_SETTINGS'));
assert(textIncludes(events, 'commitSettingsDraft'));
assert(textIncludes(events, 'MESSAGE.SAVE_STATE'));
assert(textIncludes(worker, 'case MESSAGE.SAVE_SETTINGS'));
const main = fs.readFileSync('src/ui/app/app-main.js', 'utf8');
assert(textIncludes(main, 'activityRefreshSeconds'));
assert(textIncludes(main, 'setTimeout'));
const offscreen = fs.readFileSync('src/offscreen/alarm.js', 'utf8'),
  jobs = fs.readFileSync('src/background/job-queue.js', 'utf8');
assert(textIncludes(offscreen, 'SD_OFFSCREEN_COMPLETION'));
assert(textIncludes(jobs, 'completionToneEnabled') && textIncludes(jobs, 'Audio?.completion'));
console.log('v153-context-settings-test: OK');
