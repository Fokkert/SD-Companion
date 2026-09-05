const { textIncludes } = require('./source-assertions');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('manifest.json')),
  constants = read('src/shared/constants.js'),
  events = read('src/ui/app/app-events.js'),
  home = read('src/ui/app/pages/home.js'),
  css = read('src/ui/app/app.css');
assert.equal(manifest.version, '2.5.1');
assert.equal(manifest.version_name, 'V2');
assert(textIncludes(constants, 'BUILD_VERSION:"2.5.1"'));
// Unit selectors must declare their working variables on the normal execution path.
assert(textIncludes(events, "if(!key)return false;const u=el.value;if(key==='execution-repeat')"));
assert(textIncludes(events, "if(!key)return false;const u=el.value,card=el.closest('.action-card')"));
assert(!textIncludes(events, 'if(!key)return false,u=el.value'));
// Monitoring starts visually immediately; saving must not force a full Home rerender.
const monitorHandler = (events.match(/if\s*\(\s*el\.id\s*===\s*['"]homeMonitor['"]\s*\)\s*\{[\s\S]*?\n\s*\}(?=\s*if\s*\(\s*\['alarmPreset')/) || [''])[0];
assert(textIncludes(monitorHandler, 'A.setHomeMonitoringVisual?.(enabled)'));
assert(textIncludes(monitorHandler, 'MESSAGE.SET_MONITORING'));
assert(!textIncludes(monitorHandler, 'A.save(false)'));
assert(!textIncludes(monitorHandler, 'A.renderPage()'));
// Auto refresh updates the existing radar instead of replacing homeMonitorCard, preserving animation phase.
assert(textIncludes(home, 'A.refreshHomeMonitorDom=(s,p)=>'));
assert(textIncludes(home, "radarEl.querySelectorAll('.radar-dot').forEach(x=>x.remove())"));
const refresh = (home.match(/A\.refreshHomeActivityDom\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};(?=\s*A\.pageHome)/) || [''])[0];
assert(textIncludes(refresh, 'A.refreshHomeMonitorDom(s,p)'));
assert(!textIncludes(refresh, "['homeMonitorCard',monitorCard(s,p)]"));
// V1 sweep remains present and continuous; shared switch is only slightly enlarged.
assert(textIncludes(home, 'class="radar-sweep"'));
assert(textIncludes(css, 'animation:radarSweepFull 3.4s linear infinite!important'));
assert(textIncludes(css, '.master-switch{width:56px!important;height:32px!important}'));
assert(textIncludes(css, '.radar-monitor-controls{column-gap:12px!important}'));
console.log('v203-unit-radar-continuity-test: OK');
