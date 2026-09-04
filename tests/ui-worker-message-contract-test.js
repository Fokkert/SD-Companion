const { textIncludes } = require('./source-assertions');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const uiFiles = files('src/ui').filter(f => f.endsWith('.js'));
const constantsText = fs.readFileSync('src/shared/constants.js', 'utf8');
const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');
const defined = new Set([...constantsText.matchAll(/([A-Z][A-Z0-9_]+)\s*:\s*"([A-Z][A-Z0-9_]+)"/g)].map(m => m[1]));
const used = new Set();
for (const f of uiFiles) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/A\.send\(MESSAGE\.([A-Z][A-Z0-9_]+)/g))
    used.add(m[1]);
}
const missingConstants = [...used].filter(x => !defined.has(x));
assert.deepStrictEqual(missingConstants, [], `UI messages missing from constants: ${missingConstants.join(', ')}`);
const explicitNonSwitch = new Set();
const missingHandlers = [...used].filter(x => !textIncludes(worker, `case MESSAGE.${x}:`) && !explicitNonSwitch.has(x));
assert.deepStrictEqual(missingHandlers, [], `UI messages missing worker handlers: ${missingHandlers.join(', ')}`);
console.log(`ui-worker-message-contract-test: PASS (${used.size} UI message types checked)`);
