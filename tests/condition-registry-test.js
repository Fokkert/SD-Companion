const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.SDCompanion = {};
for (const f of ['src/shared/condition-registry.js']) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
const R = SDCompanion.ConditionRegistry;
assert(R.get('project').operators.includes('is-any-of'));
assert(!R.get('createdAgeMinutes').queryable);
assert.equal(R.get('status').source, 'statuses');
assert(R.fields().length >= 10);
console.log('condition-registry-test: OK');
