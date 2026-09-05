const { textIncludes } = require('./source-assertions');
const fs = require('fs');
const assert = require('assert');
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const components = fs.readFileSync('src/ui/common/components.css', 'utf8');
const app = fs.readFileSync('src/ui/app/app.css', 'utf8');
assert(textIncludes(constants, 'BUILD_VERSION:"2.6.1"'));
assert.equal(manifest.version, '2.6.1');
// Ordinary boolean switches now reuse the exact Home monitoring component; no second geometry exists.
assert(!textIncludes(components, '.switch input[type="checkbox"]'));
assert(!textIncludes(components, '.toggle-card>input[type="checkbox"]'));
assert(textIncludes(app, '.master-switch{position:relative;display:block;width:56px;height:32px}'));
assert(textIncludes(app, '.master-switch span::after{content:"";position:absolute;top:50%;left:4px;width:24px;height:24px'));
assert(textIncludes(app, '.master-switch input:checked+span::after{transform:translate(24px,-50%)'));
assert(!textIncludes(app, '.master-switch{width:52px!important;height:30px!important;flex:0 0 52px!important}')); // no second geometry override
// Inset scrollbar treatment for rounded scrolling surfaces.
assert(textIncludes(app, 'scrollbar-gutter:stable'));
assert(textIncludes(app, '::-webkit-scrollbar-track'));
assert(textIncludes(app, 'border-block:7px solid transparent'));
assert(textIncludes(app, 'clip-path:inset(0 round 20px)'));
// Conditions are distinct boxed rows and the add control has a real flow gap.
assert(textIncludes(app, '.condition-simple{display:grid;gap:10px}'));
assert(textIncludes(app, '.condition-list{display:grid;gap:9px}'));
assert(textIncludes(app, '.condition-row{padding:10px!important;border:1px solid'));
// Last/Next metadata has compact, explicit separation.
assert(textIncludes(app, '.settings-inline-meta{display:flex;align-items:center;gap:11px'));
assert(textIncludes(app, 'font-size:9px!important'));
console.log('v1515-ui-geometry-test: OK');
