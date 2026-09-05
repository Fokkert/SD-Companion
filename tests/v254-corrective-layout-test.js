const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const constants = read('src/shared/constants.js');
const servers = read('src/ui/app/pages/servers.js');
const settings = read('src/ui/app/pages/logs-more.js');
const actions = read('src/ui/app/pages/rule-actions.js');
const css = read('src/ui/app/app.css');

assert.equal(manifest.version, '2.5.4');
assert(constants.includes('BUILD_VERSION: "2.5.4"'));

// Connection-loss pair is bounded rather than stretched across the card.
assert(servers.includes('class="time-value-row connection-loss-duration-row"'));
assert(css.includes('grid-template-columns: minmax(112px, 160px) 96px !important;'));
assert(css.includes('width: min(100%, 268px) !important;'));
assert(css.includes('padding-right: 2px;'));

// Completion tone is plain inline content, not a setting card.
assert(settings.includes('class="completion-tone-control"'));
assert(!settings.includes('<div class="setting-line setting-line-card">` +\n          `<span>Action Completion Tone</span>'));
assert(css.includes('.completion-tone-control {'));
assert(css.includes('grid-template-columns: minmax(0, 1fr) !important;'));

// Action card itself no longer creates a hidden grid-row gap; summary is a centered flex row.
assert(css.includes('.action-card {\n  display: block !important;\n  gap: 0 !important;'));
assert(css.includes('.action-card > summary.action-head {\n  display: flex !important;'));
assert(css.includes('height: 56px !important;'));
assert(css.includes('align-items: center !important;'));
assert(!actions.includes('class="toggle-caption"'));

console.log('v2.5.4 corrective layout regression: OK');
