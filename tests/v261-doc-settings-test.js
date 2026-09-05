const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const constants = fs.readFileSync(path.join(root, 'src/shared/constants.js'), 'utf8');
const alarms = fs.readFileSync(path.join(root, 'src/ui/app/pages/alarms.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/ui/app/pages/logs-more.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/ui/app/app.css'), 'utf8');
const rulesDoc = fs.readFileSync(path.join(root, 'docs/RULES-AND-ACTIONS.md'), 'utf8');

assert.equal(manifest.version, '2.6.4');
assert(constants.includes('BUILD_VERSION: "2.6.4"'));

// Alarm Profiles use the normal field name without UI commentary in the label.
assert(alarms.includes('<label>Duration</label>'));
assert(!alarms.includes('Duration <span class="muted">optional</span>'));

// Completion cue now uses the standard General Settings row and no longer shares Operational Feedback.
assert(settings.includes('general-action-complete-tone'));
assert(settings.includes('<span>Action Complete Tone</span>'));
assert(!settings.includes('completion-tone-control setting-line setting-line-card'));
assert(css.includes('.general-action-complete-tone {'));

// Rules documentation contains the complete public variable contract.
for (const token of [
  '{{issue.id}}', '{{issue.key}}', '{{issue.summary}}', '{{issue.description}}',
  '{{issue.issueType}}', '{{issue.status}}', '{{issue.projectKey}}',
  '{{issue.assignee}}', '{{issue.reporter}}', '{{issue.creator}}',
  '{{issue.priority}}', '{{issue.resolution}}', '{{issue.created}}',
  '{{issue.updated}}', '{{issue.dueDate}}', '{{issue.labels}}',
  '{{issue.fields.<field-key>}}', '{{issue.fields.customfield_12345}}',
  '{{project.key}}', '{{assignee.displayName}}', '{{now}}'
]) assert(rulesDoc.includes(token), `Missing documented variable: ${token}`);
assert(rulesDoc.includes('JSON-safe expansion'));
assert(rulesDoc.includes('the `issue.` prefix is optional'));

console.log('v2.6.4 documentation/settings regression: OK');
