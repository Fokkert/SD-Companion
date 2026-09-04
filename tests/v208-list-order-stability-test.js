const { textIncludes } = require('./source-assertions');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const constants = fs.readFileSync(path.join(root, 'src/shared/constants.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/ui/app/app-core.js'), 'utf8');
const events = fs.readFileSync(path.join(root, 'src/ui/app/app-events.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'src/ui/app/pages/rules.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/ui/app/pages/home.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src/background/rule-engine.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/ui/app/app.css'), 'utf8');
const soft = fs.readFileSync(path.join(root, 'src/ui/app/soft-select.js'), 'utf8');
assert.equal(manifest.version, '2.0.12');
assert(textIncludes(constants, 'BUILD_VERSION:"2.0.12"'));
// Schedule selector: name only, no appended human schedule description.
assert(textIncludes(rules, 'A.glassMulti(p.schedules,x=>x.id,x=>x.name'));
assert(!textIncludes(rules, 'x=>`${x.name} · ${SD.Schedule.describe(x)}`'));
assert(textIncludes(css, '.rule-schedule-multi{min-width:0;max-width:100%;overflow:hidden}'));
// Selected-first lists: initial render and live/search reordering.
assert(textIncludes(core, 'Number(set.has(b.v))-Number(set.has(a.v))'));
assert(textIncludes(core, 'data-choice-order="${index}"'));
assert(textIncludes(events, 'const reorderGlassMulti='));
assert(textIncludes(events, "const av=!a.hidden&&a.classList.contains('selected'),bv=!b.hidden&&b.classList.contains('selected')"));
assert(textIncludes(events, 'choice.hidden=!matches'));
assert(textIncludes(events, "reorderGlassMulti(group,search?.value||'')"));
assert(textIncludes(soft, 'const reorderVisibleOptions='));
assert(textIncludes(soft, "a.index===select.selectedIndex&&String(a.opt.value||'')!==''"));
assert(textIncludes(soft, "search.addEventListener('input',()=>reorderVisibleOptions(menu,search.value))"));
// Action-history order is immutable and no longer keyed to mutable live scheduledAt.
assert(textIncludes(engine, 'historyOrderAt:new Date(scheduledMs).toISOString()'));
assert(textIncludes(home, 'a.historyOrderAt||a.createdAt||a.scheduledAt'));
assert(textIncludes(home, 'b.historyOrderAt||b.createdAt||b.scheduledAt'));
assert(!textIncludes(home, 'x.jobs.sort((a,b)=>new Date(a.scheduledAt||a.createdAt||0)'));
console.log('v208-list-order-stability-test: OK');
