const { textIncludes, compactSlice } = require('./source-assertions');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('manifest.json')),
  constants = read('src/shared/constants.js'),
  core = read('src/ui/app/app-core.js'),
  events = read('src/ui/app/app-events.js'),
  worker = read('src/background/service-worker.js');
assert.equal(manifest.version, '2.2.1');
assert.equal(manifest.version_name, 'V2');
assert(textIncludes(constants, 'BUILD_VERSION:"2.2.1"'));
// Monitoring is an atomic operational mutation, not a full-state SAVE_STATE write.
assert(textIncludes(constants, 'SET_MONITORING:"SET_MONITORING"'));
const monitorHandler = (events.match(/if\s*\(\s*el\.id\s*===\s*['"]homeMonitor['"]\s*\)\s*\{[\s\S]*?\n\s*\}(?=\s*if\s*\(\s*\['alarmPreset')/) || [''])[0];
assert(textIncludes(monitorHandler, 'MESSAGE.SET_MONITORING'));
assert(!textIncludes(monitorHandler, 'A.save(false)'));
assert(textIncludes(monitorHandler, 'seq=++A.monitoringToggleSeq'));
assert(textIncludes(monitorHandler, 'if(seq===A.monitoringToggleSeq)'));
assert(textIncludes(core, 'monitoringToggleSeq:0'));
// Worker-side mutation is revision-safe without an expectedRevision race and touches only the profile monitoring state.
assert(textIncludes(worker, 'const setMonitoringEnabled=async(profileId,enabled)=>'));
assert(textIncludes(worker, 'p.monitoring.enabled=Boolean(enabled)'));
assert(textIncludes(worker, 'p.runtime.nextCycleAt=null'));
assert(textIncludes(worker, "case MESSAGE.SET_MONITORING:return{ok:true,state:await setMonitoringEnabled(message.profileId,message.enabled)}"));
const helper = compactSlice(worker, 'const setMonitoringEnabled=', 'const mergeProfileConfig=');
assert(textIncludes(helper, '{configWrite:true}'));
assert(!textIncludes(helper, 'expectedRevision'));
assert(textIncludes(helper, 'await configureAlarms()')); // always derive alarm scheduling from current persisted state
assert(textIncludes(helper, 'if(monitoredSiteIds(latest).has(id))await testConnection(id).catch(()=>{})'));
// Normal full configuration saves still retain revision conflict protection.
assert(textIncludes(core, "if(e.code==='STATE_REVISION_CONFLICT')"));
assert(textIncludes(worker, 'expectedRevision:message.baseRevision'));
console.log('v205-monitoring-toggle-race-test: OK');
