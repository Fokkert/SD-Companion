'use strict';

const fs = require('fs');
const assert = require('assert');
const { textIncludes } = require('./source-assertions');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
const home = fs.readFileSync('src/ui/app/pages/home.js', 'utf8');
const rules = fs.readFileSync('src/ui/app/pages/rules.js', 'utf8');
const help = fs.readFileSync('src/ui/app/pages/help.js', 'utf8');
const settings = fs.readFileSync('src/ui/app/pages/logs-more.js', 'utf8');
const css = fs.readFileSync('src/ui/app/app.css', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

assert.equal(manifest.version, '2.6.3');
assert(textIncludes(constants, 'BUILD_VERSION:"2.6.3"'));

// Help disclosure rows use native clickable summaries without a custom arrow.
assert(!help.includes('help-chevron'));
assert(textIncludes(help, '<summary><span>${title}</span></summary>'));
assert(textIncludes(css, '.help-topic summary::marker{content:""}'));

// Rule list entries have a stable local icon chosen from a deterministic set.
assert(rules.includes('const ruleIcons = ['));
assert(rules.includes('const ruleIcon = rule =>'));
assert(rules.includes('class="rule-entry-icon"'));
assert(css.includes('.rule-entry-icon'));

// Detections and Actions is one combined action-bearing issue list.
assert(!home.includes('const detectionRows ='));
assert(!home.includes('small-section-title">Detections'));
assert(!home.includes('Actions by issue'));
assert(textIncludes(home, 'const scopedActivityJobs=(site,profile)=>(A.jobs||[]).filter'));
assert(textIncludes(home, "const jobs=view==='recent'?allJobs:allJobs.filter(job=>currentDetected.has(job.issueKey)||!terminalStatus(job.status))"));
assert(textIncludes(home, '<div class="issue-activity-list">${issueActivity(site,profile,view,current,recent)}</div>'));

// Monitoring deck has Detected, Actions, Rules only; the old Evaluated/rule ribbon is gone.
assert(home.includes('data-home-stat="detected"'));
assert(home.includes('data-home-stat="actions"'));
assert(home.includes('data-home-stat="rules"'));
assert(!home.includes('data-home-stat="evaluated"'));
assert(!home.includes('data-home-rule-count'));
assert(!home.includes('<div class="monitor-timing">'));
assert(textIncludes(home, 'rules:`${enabledRules}/${totalRules}`'));

// Home alignment/layout and selector centering have explicit final rules.
assert(css.includes('.detections-actions-toolbar'));
assert(css.includes('.detections-actions-title'));
assert(textIncludes(css, '.detections-actions-global-controls .freshness-chip{margin-left:auto}'));
assert(textIncludes(css, 'scrollbar-gutter:stable both-edges'));

// Security status indicators are explicit cards.
assert(settings.includes('class="security-status-card"'));
assert(css.includes('.security-status-card'));

// Release packages are documented as version-folder archives.
assert(readme.includes('SD-Companion-vX.Y.Z/'));
assert(readme.includes('one versioned top-level folder'));

console.log('v221-home-ui-test: PASS');
