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

assert.equal(manifest.version, '2.6.2');
assert(constants.includes('BUILD_VERSION: "2.6.2"'));

// Connection-loss pair is bounded rather than stretched across the card.
assert(servers.includes('class="time-value-row connection-loss-duration-row"'));
assert(css.includes('grid-template-columns: minmax(112px, 160px) 96px !important;'));
assert(css.includes('width: min(100%, 268px) !important;'));
assert(css.includes('padding-right: 2px;'));

// Completion tone is no longer part of Operational Feedback; it lives in General Settings.
assert(settings.includes('general-action-complete-tone'));
assert(settings.includes('<span>Action Complete Tone</span>'));
assert(!settings.includes('completion-tone-control setting-line setting-line-card'));
assert(css.includes('.general-action-complete-tone {'));

// Action card itself no longer creates a hidden grid-row gap; summary is a centered flex row.
assert(css.includes('.action-card {\n  display: block !important;\n  gap: 0 !important;'));
assert(css.includes('.action-card > summary.action-head {\n  display: flex !important;'));
assert(css.includes('height: 56px !important;'));
assert(css.includes('align-items: center !important;'));
assert(!actions.includes('class="toggle-caption"'));

console.log('v2.6.2 corrective layout regression: OK');
