const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const load = rel => vm.runInThisContext(read(rel), { filename: rel });

globalThis.SDCompanion = {};
load('src/shared/constants.js');
load('src/shared/utils.js');

const SD = globalThis.SDCompanion;
const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.version, '2.6.2');
assert.equal(SD.Constants.BUILD_VERSION, '2.6.2');

// Variables are first-class for comments and JSON field edits.
const issue = {
  key: 'IT-42',
  summary: 'Printer says "offline"',
  status: 'Open',
  projectKey: 'IT',
  projectName: 'Service Desk',
  assignee: { key: 'ada', displayName: 'Ada Lovelace' },
  reporter: { key: 'grace', displayName: 'Grace Hopper' },
  labels: ['hardware', 'urgent'],
  fields: { customfield_12345: 'Floor 3' }
};
assert.equal(SD.Utils.template('{{issue.key}} · {{issue.assignee}} · {{issue.labels}}', issue), 'IT-42 · Ada Lovelace · hardware, urgent');
const expandedJson = SD.Utils.templateJson('{"description":"{{issue.summary}}","location":"{{issue.fields.customfield_12345}}"}', issue);
assert.deepEqual(JSON.parse(expandedJson), { description: 'Printer says "offline"', location: 'Floor 3' });

const ruleEngine = read('src/background/rule-engine.js');
const queue = read('src/background/job-queue.js');
const actions = read('src/ui/app/pages/rule-actions.js');
assert(ruleEngine.includes('payload.commentTemplate = chosen'));
assert(ruleEngine.includes('issue\\.fields\\.([A-Za-z0-9_:-]+)'));
assert(queue.includes('template(job.payload.commentTemplate || job.payload.comment || "", issue)'));
assert(queue.includes('JSON.parse(templateJson(job.payload.fieldsJson || "{}", issue))'));
for (const token of ['{{issue.key}}', '{{issue.assignee}}', '{{issue.fields.customfield_12345}}', '{{now}}']) assert(actions.includes(token));

// Duration is independent from the selected stop method and blank means unlimited.
const alarms = read('src/ui/app/pages/alarms.js');
const events = read('src/ui/app/app-events.js');
const worker = read('src/background/service-worker.js');
const offscreen = read('src/offscreen/alarm.js');
assert(alarms.includes('<label>Duration</label>'));
assert(alarms.includes('placeholder="Unlimited"'));
assert(!alarms.includes("alarm.stopMethod === 'duration' ? `<div class=\"field\"><label>Duration"));
assert(events.includes("base.durationSeconds = rawDuration ? seconds(rawDuration, base.durationUnit || 'seconds', 1, 86400) : 0"));
assert(worker.includes('if (Number.isFinite(durationSeconds) && durationSeconds > 0)'));
assert(offscreen.includes('const timed = cfg => Number.isFinite(Number(cfg.durationSeconds)) && Number(cfg.durationSeconds) > 0;'));

// Popup stop UI is sent to all eligible normal web tabs, not just Jira candidate tabs.
const popupStart = worker.indexOf('const alarmPopupTabs = async () =>');
const popupEnd = worker.indexOf('let alarmPlaybackGeneration', popupStart);
const popupBlock = worker.slice(popupStart, popupEnd);
assert(popupBlock.includes('chrome.tabs.query({})'));
assert(popupBlock.includes('/^https?:\\/\\//i'));
assert(!popupBlock.includes('SD.JiraTabs.candidateTabs'));

// Logs and Audit are one user-facing Activity Journal.
const journal = read('src/ui/app/pages/logs-more.js');
const core = read('src/ui/app/app-core.js');
assert(journal.includes("head('Activity Journal'"));
assert(journal.includes('data-action="export-journal"'));
assert(journal.includes('data-action="clear-journal"'));
assert(journal.includes("link('logs', 'Activity Journal')"));
assert(!journal.includes("link('audit', 'Audit Journal')"));
assert(core.includes("Promise.all([A.refreshLogs(), A.refreshAudit()])"));

// Operational Feedback stays on one compact row.
const css = read('src/ui/app/app.css');
assert(css.includes('grid-template-columns: minmax(210px, 254px) minmax(150px, max-content) !important;'));
assert(css.includes('align-items: end !important;'));
assert(css.includes('height: 40px !important;'));

console.log('v2.6.2 final features regression: OK');
