const { textIncludes } = require('./source-assertions');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const sw = read('src/background/service-worker.js'),
  home = read('src/ui/app/pages/home.js'),
  actions = read('src/ui/app/pages/rule-actions.js'),
  rules = read('src/ui/app/pages/rules.js'),
  soft = read('src/ui/app/soft-select.js'),
  core = read('src/ui/app/app-core.js'),
  main = read('src/ui/app/app-main.js'),
  css = read('src/ui/app/app.css'),
  theme = read('src/ui/common/theme.css'),
  events = read('src/ui/app/app-events.js'),
  api = read('src/api/jira-client.js');
assert(textIncludes(sw, 'monitoringEnabledForSite(state,siteId)'));
assert(textIncludes(sw, "filter(s=>s.auth.configured&&monitoringEnabledForSite(state,s.id))"));
assert(textIncludes(sw, 'for(const id of started)await testConnection(id)'));
assert(textIncludes(sw, "active.source==='Connection monitor'"));
assert(textIncludes(home, 'Active shift'));
assert(textIncludes(home, 'No active shift'));
assert(textIncludes(home, 'homeShiftCard'));
assert(textIncludes(home, 'radar radar-pro'));
assert(textIncludes(home, 'radar-sweep'));
assert(textIncludes(home, 'radar-ring r1'));
assert(!textIncludes(home, 'classic-radar'));
assert(!textIncludes(home, 'radar-world'));
assert(!textIncludes(css, '.radar-world'));
assert(textIncludes(css, '@media(prefers-reduced-motion:reduce)'));
for (const t of ['emerald-glass', 'midnight-glass', 'graphite-glass', 'violet-glass', 'amber-glass', 'frost-light'])
  assert(textIncludes(theme, t));
assert(textIncludes(actions, 'After previous action'));
assert(textIncludes(actions, 'Conditional action'));
assert(textIncludes(actions, 'Unassign issue'));
assert(textIncludes(actions, 'data-searchable="true"'));
assert(textIncludes(actions, 'const transitionRows=s=>'));
assert(textIncludes(actions, 'projectKey}|${x.issueTypeId}|${x.fromStatusId}|${x.id}|${x.toStatusId}|${x.name}'));
assert(textIncludes(rules, 'Duplicate'));
assert(textIncludes(rules, 'Random action selection'));
assert(textIncludes(events, "act==='duplicate-rule'"));
assert(textIncludes(soft, "dataset.searchable==='true'"));
assert(textIncludes(soft, "search.type='search'"));
assert(textIncludes(core, 'safeImportClone'));
assert(textIncludes(core, 'delete server.auth.token'));
assert(textIncludes(core, 'fullImport:true'));
assert(textIncludes(core, 'iterations<100000||iterations>1000000'));
assert(!textIncludes(main, 'innerHTML=`<pre class="fatal-error"'));
assert(textIncludes(api, "accountId:user?.accountId??null"));
assert(textIncludes(api, "name:user?.name??user?.key??null"));
console.log('v2-static-features-test: OK');
