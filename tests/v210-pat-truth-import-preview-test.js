const { textIncludes } = require('./source-assertions');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.version, '2.2.1');
assert.equal(manifest.version_name, 'V2');
const core = read('src/ui/app/app-core.js'),
  base = read('src/ui/app/pages/base.js'),
  home = read('src/ui/app/pages/home.js'),
  health = read('src/ui/app/pages/health.js'),
  servers = read('src/ui/app/pages/servers.js'),
  data = read('src/ui/app/pages/data.js'),
  profiles = read('src/ui/app/pages/profiles.js'),
  css = read('src/ui/app/app.css'),
  sw = read('src/background/service-worker.js');
// API status must be gated by the actual credential map rather than stale imported runtime health.
assert(textIncludes(base, 'A.credentialStatus?.[s.id]'));
assert(textIncludes(base, 'PAT MISSING'));
assert(textIncludes(home, 'hasPat&&st.apiHealthy'));
assert(textIncludes(home, 'API monitoring, health checks, synchronization and connection-loss alarms are paused'));
assert(textIncludes(health, "apiOnline=Boolean(hasPat&&r.apiHealthy)"));
assert(textIncludes(health, 'PAT missing'));
assert(textIncludes(servers, "hasPat&&s.runtime?.apiHealthy"));
assert(textIncludes(data, "selected&&hasPat"));
// Normal import must scrub an exported ONLINE runtime snapshot when the backup has no credential.
assert(textIncludes(core, "connectionStatus:credentialConfigured?'check-required':'pat-missing'"));
assert(textIncludes(core, "apiHealthy:false"));
assert(textIncludes(core, "lastErrorCode:credentialConfigured?'':'PAT_MISSING'"));
assert(textIncludes(core, "hadCredential=Boolean(A.credentialStatus[add.siteId])"));
// Missing PAT is not a connection outage: background timers and connection-loss alarms require a real credential.
assert(textIncludes(sw, 'const credentialSiteIds=async state'));
assert(textIncludes(sw, 'await SD.Storage.hasCredential(siteId)'));
assert(textIncludes(sw, "connectionStatus:'pat-missing'"));
assert(textIncludes(sw, "Jira API check skipped because the PAT is missing."));
assert(textIncludes(sw, "p.monitoring?.enabled&&profileHasEnabledRules(p)&&credentialIds.has(p.siteId)"));
assert(textIncludes(sw, "!await SD.Storage.hasCredential(site.id))continue"));
assert(textIncludes(sw, "!await SD.Storage.hasCredential(siteId)||!monitoringEnabledForSite"));
// Import preview must use bounded table/cards/chips, not one touching text stream.
for (const token of ['import-object-grid', 'import-summary-table', 'import-detail-grid', 'import-chip-list', 'import-auth-notice'])
  assert(textIncludes(profiles, token), token);
for (const token of ['.import-object-card', '.import-summary-table', '.import-detail-card', '.import-chip-list', '.credential-missing-notice'])
  assert(textIncludes(css, token), token);
console.log('v210-pat-truth-import-preview-test: OK');
