const { textIncludes } = require('./source-assertions');
const fs = require('fs');
const assert = require('assert');
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
assert(textIncludes(constants, 'BUILD_VERSION:"2.5.4"'));
assert.equal(manifest.version, '2.5.4');
const core = fs.readFileSync('src/ui/app/app-core.js', 'utf8'),
  events = fs.readFileSync('src/ui/app/app-events.js', 'utf8'),
  css = fs.readFileSync('src/ui/common/components.css', 'utf8') + fs.readFileSync('src/ui/app/app.css', 'utf8'),
  servers = fs.readFileSync('src/ui/app/pages/servers.js', 'utf8'),
  settings = fs.readFileSync('src/ui/app/pages/logs-more.js', 'utf8'),
  help = fs.readFileSync('src/ui/app/pages/help.js', 'utf8');
assert(textIncludes(core, 'glass-multi-search'));
assert(textIncludes(events, 'applyGlassMultiSearch'));
assert(textIncludes(events, "e.key==='Enter'"));
assert(textIncludes(css, '.glass-choice[hidden]{display:none!important}'));
assert(textIncludes(css, '.master-switch{position:relative;display:block;width:56px;height:32px}'));
assert(textIncludes(css, '.master-switch span{position:absolute;inset:0;border-radius:999px'));
assert(textIncludes(css, '.master-switch input:checked+span::after{transform:translate(24px,-50%)'));
assert(textIncludes(settings, 'class="master-switch"'));
assert(textIncludes(servers, 'Transition Handling Method'));
assert(textIncludes(servers, 'Full Workflow Map (Recommended)'));
assert(textIncludes(servers, 'Issue-Based Transition Discovery'));
assert(textIncludes(servers, 'Target Status + Runtime Choice'));
assert(!textIncludes(servers, 'Workflow Designer is the default and maps'));
assert(!textIncludes(servers, "Uses the active profile's Alarm Studio sound."));
assert(!textIncludes(settings, 'Changes apply after Save.'));
assert(textIncludes(help, 'Target Status + Runtime Choice'));
assert(textIncludes(help, 'connection-loss alarm uses the active profile'));
assert(textIncludes(css, 'min-width:122px'));
assert(textIncludes(css, 'connection-behavior-grid'));
console.log('v1514-ui-polish-test: OK');
