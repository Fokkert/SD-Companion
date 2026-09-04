const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/validators.js'
]) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
const SD = SDCompanion, p = SD.Defaults.requestPolicy();
assert.deepEqual(SD.Validators.validateRequestPolicy(p), []);
assert(SD.Validators.validateRequestPolicy({ ...p, maxRequestsPerMinute: 99999 }).length);
const profile = SD.Defaults.profile('P', { id: 's' }), r = SD.Defaults.rule('R');
r.enabled = true;
r.schedule = { mode: 'scheduled', scheduleIds: [] };
r.logic.groups[0].conditions[0].values = ['IT'];
profile.rules = [r];
assert(SD.Validators.validateProfile(profile).some(x => x.includes('schedule')));
r.schedule = { mode: 'always', scheduleIds: [] };
assert(!SD.Validators.validateRule(r).some(x => x.includes('schedule')));
console.log('request-policy-test: OK');
