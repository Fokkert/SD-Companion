const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const constants = read('src/shared/constants.js');
const actions = read('src/ui/app/pages/rule-actions.js');
const css = read('src/ui/app/app.css');

assert.equal(manifest.version, '2.5.2');
assert(constants.includes('BUILD_VERSION: "2.5.2"'));

// Action summary controls: delete X, movement arrows, then state/toggle with the toggle at the far edge.
const deletePos = actions.indexOf('class="btn btn-small btn-danger action-delete-button"');
const upPos = actions.indexOf('class="btn btn-small action-move-button" data-action="move-action-up"');
const downPos = actions.indexOf('class="btn btn-small action-move-button" data-action="move-action-down"');
const captionPos = actions.indexOf('class="toggle-caption"');
const switchPos = actions.indexOf('class="master-switch action-enabled-switch"');
assert(deletePos >= 0 && deletePos < upPos && upPos < downPos && downPos < captionPos && captionPos < switchPos);
assert(actions.includes('aria-label="Delete action">×</button>'));
assert(!actions.includes('data-action="delete-action" data-id="${a.id}">Delete</button>'));

// Vertical centering and compact controls are explicit.
assert(css.includes('.action-card > summary.action-head {'));
assert(css.includes('align-items: center !important;'));
assert(css.includes('.action-summary-controls .action-delete-button {'));
assert(css.includes('width: 30px;'));

// Shared time/value spacing and single-result list sizing are protected.
assert(css.includes('.time-value-row,\n.time-pair,\n.duration-control {\n  column-gap: 12px !important;'));
assert(css.includes('.glass-multi {\n  align-content: start !important;\n  grid-auto-rows: max-content;'));

// Completion tone remains compact but no longer over-tightened/misaligned.
assert(css.includes('min-height: 44px !important;'));
assert(css.includes('align-self: center !important;'));

console.log('v2.5.2 action/layout spacing regression: OK');
