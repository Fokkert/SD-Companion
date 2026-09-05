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

assert.equal(manifest.version, '2.5.3');
assert(constants.includes('BUILD_VERSION: "2.5.3"'));

// Connection-loss duration/unit pair spans the full connection-loss grid.
assert(servers.includes('class="time-value-row connection-loss-duration-row"'));
assert(css.includes('.connection-loss-grid > .connection-loss-duration-row {'));
assert(css.includes('grid-column: 1 / -1 !important;'));
assert(css.includes('grid-template-columns: minmax(0, 1fr) minmax(96px, 110px) !important;'));

// Operational Feedback remains side-by-side and the completion label truncates instead of wrapping.
assert(settings.includes('<span>Action Completion Tone</span>'));
assert(css.includes('grid-template-columns: minmax(138px, .82fr) minmax(0, 1.18fr) !important;'));
assert(css.includes('white-space: nowrap !important;'));
assert(css.includes('text-overflow: ellipsis;'));
assert(css.includes('align-items: end !important;'));

// Action controls are icon-only on the right and centered by explicit header geometry.
assert(!actions.includes('class="toggle-caption"'));
const deletePos = actions.indexOf('class="btn btn-small btn-danger action-delete-button"');
const upPos = actions.indexOf('data-action="move-action-up"');
const downPos = actions.indexOf('data-action="move-action-down"');
const togglePos = actions.indexOf('class="master-switch action-enabled-switch"');
assert(deletePos >= 0 && deletePos < upPos && upPos < downPos && downPos < togglePos);
assert(css.includes('height: 58px !important;'));
assert(css.includes('padding: 0 14px !important;'));
assert(css.includes('align-content: center !important;'));
assert(css.includes('.action-summary-main > *,\n.action-summary-controls > * {\n  align-self: center !important;'));

console.log('v2.5.3 responsive/action centering regression: OK');
