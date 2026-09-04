const fs = require('fs');
const assert = require('assert');
const { textIncludes } = require('./source-assertions');

const home = fs.readFileSync('src/ui/app/pages/home.js', 'utf8');
const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');
const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8');
const settings = fs.readFileSync('src/ui/app/pages/logs-more.js', 'utf8');
const appearance = fs.readFileSync('src/ui/app/pages/appearance.js', 'utf8');
const theme = fs.readFileSync('src/ui/common/theme.css', 'utf8');
const appCss = fs.readFileSync('src/ui/app/app.css', 'utf8');
const appHtml = fs.readFileSync('src/ui/app/app.html', 'utf8');
const sideHtml = fs.readFileSync('src/ui/app/sidepanel.html', 'utf8');

assert(!home.includes('No saved schedule currently matches this time'));
assert(!home.includes('Action history auto refresh'));
assert(!home.includes('No engine error'));
assert(!home.includes('data-home-monitor-next'));
assert(textIncludes(home, "hasPat&&enabledRules?'':'disabled'"), 'Scan Now must be disabled without enabled rules');
assert(textIncludes(home, "canCheck=Boolean(A.credentialStatus?.[site.id]&&enabledRules)"), 'Check now must be disabled without enabled rules');
assert(textIncludes(worker, 'const profileHasEnabledRules=profile=>Boolean((profile?.rules||[]).some(rule=>rule.enabled))'));
assert(textIncludes(worker, "reason:'no-enabled-rules'"));
assert(textIncludes(worker, "code:'NO_ENABLED_RULES'"));
assert(textIncludes(worker, 'p.siteId===siteId&&p.monitoring?.enabled&&profileHasEnabledRules(p)'));
assert(textIncludes(home, "${enabledRules?'':'disabled'}"));
assert(textIncludes(worker, 'p.monitoring?.enabled&&profileHasEnabledRules(p)&&credentialIds.has(p.siteId)'));

assert(!settings.includes('Device-local protection'));
assert(!settings.includes('The PIN/password is never stored or included in profile backups'));
assert(textIncludes(events, "if(act==='settings-back')"));
assert(textIncludes(events, "chrome.sidePanel?.open"));
assert(textIncludes(events, 'A.send(MESSAGE.SET_OPEN_TARGET'));

for (const id of ['crimson-glass', 'ocean-glass', 'copper-glass']) {
  assert(appearance.includes(id));
  assert(theme.includes(`data-theme="${id}"`));
}
assert(!appearance.includes('frost-light'));
assert(!theme.includes('data-theme="frost-light"'));

for (const html of [appHtml, sideHtml]) {
  assert(html.includes('context-section server-field'));
  assert(html.includes('context-section profile-field'));
  assert(html.includes('profile-context-icon'));
}
assert(appCss.includes('.detections-actions-global-controls .freshness-chip'));
assert(appCss.includes('.context-section'));
assert(appCss.includes('.settings-page-tab.active::after'));

console.log('v220-final-ui-test: PASS');
