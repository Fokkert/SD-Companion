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

assert.equal(manifest.version, '2.6.3');
assert(constants.includes('BUILD_VERSION: "2.6.3"'));

// Connection-loss duration/unit pair is bounded and keeps a fixed unit gutter.
assert(servers.includes('class="time-value-row connection-loss-duration-row"'));
assert(css.includes('.connection-loss-grid > .connection-loss-duration-row {'));
assert(css.includes('grid-column: 1 / -1 !important;'));
assert(css.includes('grid-template-columns: minmax(112px, 160px) 96px !important;'));
assert(css.includes('width: min(100%, 268px) !important;'));

// Completion tone is no longer part of Operational Feedback; it lives in General Settings.
assert(settings.includes('general-action-complete-tone'));
assert(settings.includes('<span>Action Complete Tone</span>'));
assert(!settings.includes('completion-tone-control setting-line setting-line-card'));
assert(css.includes('.general-action-complete-tone {'));

// Action controls are icon-only and the card no longer has a hidden grid gap.
assert(!actions.includes('class="toggle-caption"'));
const deletePos = actions.indexOf('class="btn btn-small btn-danger action-delete-button"');
const upPos = actions.indexOf('data-action="move-action-up"');
const downPos = actions.indexOf('data-action="move-action-down"');
const togglePos = actions.indexOf('class="master-switch action-enabled-switch"');
assert(deletePos >= 0 && deletePos < upPos && upPos < downPos && downPos < togglePos);
assert(css.includes('.action-card {\n  display: block !important;\n  gap: 0 !important;'));
assert(css.includes('height: 56px !important;'));
assert(css.includes('padding: 0 14px !important;'));
assert(css.includes('justify-content: space-between !important;'));
assert(css.includes('.action-summary-main > *,\n.action-summary-controls > * {'));

console.log('v2.6.3 responsive/action centering regression: OK');
