const { textIncludes } = require('./source-assertions');
const fs = require('fs');
const assert = require('assert');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
const home = fs.readFileSync('src/ui/app/pages/home.js', 'utf8');
const rules = fs.readFileSync('src/ui/app/pages/rules.js', 'utf8');
const profiles = fs.readFileSync('src/ui/app/pages/profiles.js', 'utf8');
const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8');
const settings = fs.readFileSync('src/ui/app/pages/logs-more.js', 'utf8');
const help = fs.readFileSync('src/ui/app/pages/help.js', 'utf8');
const css = fs.readFileSync('src/ui/app/app.css', 'utf8');
const discovery = fs.readFileSync('src/background/discovery.js', 'utf8');
const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');

assert.equal(manifest.version, '2.6.3');
assert(textIncludes(constants, 'BUILD_VERSION:"2.6.3"'));

// Home is one operational workspace, while Rules owns one-time Bulk Operations.
assert(textIncludes(home, 'Detections &amp; Actions'));
assert(textIncludes(home, 'homeDetectionsActionsCard'));
assert(textIncludes(home, 'refresh-current-matches'));
assert(textIncludes(home, 'approve-all-jobs'));
assert(textIncludes(home, 'process-all-jobs'));
assert(textIncludes(home, 'cancel-all-jobs'));
assert(textIncludes(home, 'homeShowCompletedActions'));
assert(!textIncludes(home, 'data-page="bulk"'));
assert(textIncludes(rules, 'data-page="bulk"'));
assert(textIncludes(rules, 'Bulk Operations'));

// Completed issue groups hide as a unit; completed rows remain within active issues.
assert(textIncludes(home, 'const hasActive=row=>row.jobs.some(j=>!terminalStatus(j.status))'));
assert(textIncludes(home, 'visibleRows=[...map.values()].filter(row=>A.homeShowCompletedActions||hasActive(row))'));
assert(textIncludes(home, 'ordered=allOrdered'));

// Current Home terminology/error presentation.
assert(textIncludes(home, 'Active Schedule'));
assert(textIncludes(home, 'No Active Schedule'));
assert(!textIncludes(home, 'Active shift'));
assert(!textIncludes(home, 'No active shift'));
assert(textIncludes(home, "st.lastError?'ERROR'"));

// List accents and control-adjacent labels follow the new global UI rules.
assert(textIncludes(css, '--control-label-font-size:14px'));
assert(textIncludes(css, '--control-label-font-weight:760'));
assert(textIncludes(css, '.list-item::before{content:none!important;display:none!important;width:0!important}'));

// Profile cards and safe deep duplication.
assert(textIncludes(profiles, 'profile-card-actions'));
assert(textIncludes(css, '.profile-list-item{display:grid!important;grid-template-columns:minmax(0,1fr)auto!important;align-items:center!important;gap:14px!important}'));
assert(!textIncludes(css, '.profile-list-item{grid-template-columns:1fr!important}'));
assert(textIncludes(profiles, 'duplicate-profile'));
assert(textIncludes(events, 'duplicateProfileObject'));
assert(textIncludes(events, 'copy.monitoring={...(copy.monitoring||{}),enabled:false}'));
assert(textIncludes(events, 'scheduleMap.set(previousId,schedule.id)'));
assert(textIncludes(events, 'poolMap.set(previousId,pool.id)'));

// Settings are split internally and protected-action documentation moved to Help.
for (const label of ['Sync & Refresh', 'Safety Limits', 'Alarm']) assert(settings.includes(label));
assert(!settings.includes('Protected sensitive actions'));
assert(help.includes('Security and protected actions'));

// Handled UI errors stay out of Chrome's extension error console.
assert(!events.includes('console.warn(err)'));
assert(textIncludes(events, "A.toast(err.message,'error')"));
assert(textIncludes(discovery, "event:'api-sync-warning'"));
assert(textIncludes(worker, "audit('metadata-auto-sync-failed',syncError,{siteId:site.id})"));

console.log('v2111-ui-cleanup-test: OK');
