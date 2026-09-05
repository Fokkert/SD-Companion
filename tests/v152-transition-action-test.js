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
  'src/shared/validators.js'
])
  load(f);
const SD = SDCompanion;
assert.equal(SD.Constants.BUILD_VERSION, '2.5.2');
const enabled = SD.Defaults.rule('Open Incidents');
enabled.enabled = true;
enabled.source.jql = 'project = IT';
enabled.actions = [SD.Defaults.action('transition')];
let errs = SD.Validators.validateRule(enabled);
assert(errs.some(x => textIncludes(x, 'transition, target status, or manual transition name')));
const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8');
assert(textIncludes(events, 'A.beginRuleEdit'));
assert(textIncludes(events, "if(act==='save-rule')"));
assert(!textIncludes(events, "r.actions.push(SD.Defaults.action(el.value));await saveRule(r,true)"));
const actions = fs.readFileSync('src/ui/app/pages/rule-actions.js', 'utf8');
assert(textIncludes(actions, 'transitionChoices'));
assert(textIncludes(actions, 'No relevant synchronized transitions'));
const data = fs.readFileSync('src/ui/app/pages/data.js', 'utf8');
assert(textIncludes(data, 'const transitionItems=s=>'));
assert(!textIncludes(data, 'transitions:s.transitionCatalog'));
globalThis.SDApp = {
  esc: v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])),
  option: (v, l, sel = false) => `<option value="${v}" ${sel ? 'selected' : ''}>${l}</option>`,
  multiOptions: () => '',
  glassMulti: () => '',
  uniqueStatuses: s => s.statuses || []
};
vm.runInThisContext(fs.readFileSync('src/ui/app/pages/rule-actions.js', 'utf8'), { filename: 'rule-actions.js' });
const site = {
  filters: [],
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
    }
  ],
  statuses: [],
  users: [],
  priorities: []
};
const rule = SD.Defaults.rule('Incident rule');
rule.logic.groups[0].conditions = [{ id: 'c', field: 'issueType', operator: 'equals', value: '100', values: [] }];
const a = SD.Defaults.action('transition');
const html = SDApp.RuleViews.actionEditor(a, site, SD.Defaults.profile(), 0, rule);
assert(textIncludes(html, 'Start Progress'));
assert(textIncludes(html, 'In Progress'));
assert(!textIncludes(html, 'Begin Task'));
assert(!textIncludes(html, 'Doing'));
console.log('v152-transition-action-test: OK');
