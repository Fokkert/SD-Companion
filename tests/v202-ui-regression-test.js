const { textIncludes } = require('./source-assertions');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('manifest.json')),
  constants = read('src/shared/constants.js'),
  home = read('src/ui/app/pages/home.js'),
  settings = read('src/ui/app/pages/logs-more.js'),
  data = read('src/ui/app/pages/data.js'),
  events = read('src/ui/app/app-events.js'),
  css = read('src/ui/app/app.css');
assert.equal(manifest.version, '2.1.0');
assert.equal(manifest.version_name, 'V2');
assert(textIncludes(constants, 'BUILD_VERSION:"2.1.0"'));
// V1.5.22 radar contract: compact monitor geometry + explicit axes/rings/sweep DOM.
for (const token of ['radar radar-pro', 'radar-axis h', 'radar-axis v', 'radar-ring r1', 'radar-ring r2', 'radar-ring r3', 'radar-sweep', 'radar-core'])
  assert(textIncludes(home, token), `missing V1 radar token ${token}`);
assert(!textIncludes(home, 'classic-radar'));
assert(!textIncludes(css, '.classic-radar{'));
assert(textIncludes(css, '.monitor-compact-grid{display:grid!important;grid-template-columns:142px minmax(0,1fr)!important'));
assert(textIncludes(css, '.radar-monitor-card .radar.radar-pro{width:140px!important;height:140px!important'));
// Settings sections are horizontal page-title tabs, not a vertical rail.
assert(textIncludes(settings, 'settings-tabbar'));
assert(textIncludes(settings, 'settings-page-tab'));
assert(!textIncludes(settings, '<aside class="settings-rail">'));
assert(textIncludes(css, '.settings-tabbar{display:flex'));
assert(textIncludes(css, '.settings-workspace{display:grid!important;grid-template-columns:1fr!important'));
// Data search updates only results so typing cannot destroy/recreate the focused input.
assert(textIncludes(data, 'A.refreshInventorySearchDom'));
assert(textIncludes(data, 'id="inventoryResults"'));
assert(textIncludes(data, 'id="inventoryResultLimit"'));
const handler = (events.match(/if\s*\(\s*el\.id\s*===\s*['"]inventorySearch['"]\s*\)\s*\{[\s\S]*?\n\s*\}(?=\s*if\s*\(\s*el\.dataset\.settingsProp)/) || [''])[0];
assert(textIncludes(handler, 'refreshInventorySearchDom'));
assert(!textIncludes(handler, 'renderPage'));
// Every data type selector gets a visible card boundary.
assert(textIncludes(css, '.data-catalog-item{min-height:52px!important;border:1px solid var(--line)!important'));
assert(textIncludes(data, "['projects','Projects'"));
assert(textIncludes(data, "['filters','Filters'"));
assert(textIncludes(data, "['users','Users'"));
console.log('v202-ui-regression-test: OK');
