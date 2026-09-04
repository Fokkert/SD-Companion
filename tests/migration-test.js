const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/migrations.js'
]) load(f);
const SD = SDCompanion;
const base = SD.Defaults.state(),
  oldSchedule = { id: 'stock', name: 'Bussiness Hours', enabled: true, days: [1, 2, 3, 4, 5], startTime: '09:00:00', endTime: '18:00:00', timeZone: 'UTC', startDate: '', endDate: '' },
  custom = { id: 'custom', name: 'Night', enabled: true, days: [1], startTime: '20:00:00', endTime: '23:00:00', timeZone: 'UTC', startDate: '', endDate: '' },
  r = SD.Defaults.rule('Scheduled rule');
r.enabled = true;
r.schedule = { mode: 'scheduled', scheduleIds: ['stock'] };
r.executionPolicy = { mode: SD.Constants.EXECUTION_POLICY.REPEAT, repeatMinutes: 15 };
r.polling = { cursorOverlapMinutes: 5 };
r.safety = { maxIssuesPerCycle: 4, maxActionsPerCycle: 8, maxCommentsPerHour: 3, maxAssignmentsPerHour: 5, maxTransitionsPerHour: 6 };
const old = { ...base, schemaVersion: 19, system: { logLevel: 'info', dryRun: true }, profiles: [{ ...base.profiles[0], id: 'p', schedules: [oldSchedule, custom], rules: [r] }], activeProfileId: 'p' };
const migrated = SD.Migrations.migrateState(old).state, p = migrated.profiles[0], mr = p.rules[0];
assert.equal(migrated.schemaVersion, 32);
assert(!('dryRun' in migrated.system));
assert('safety' in migrated.system);
assert(!('safety' in mr));
assert.equal(mr.executionPolicy.repeatSeconds, 900);
assert.equal(mr.polling.cursorOverlapSeconds, 300);
assert.equal(p.schedules.length, 1);
assert.equal(p.schedules[0].id, 'custom');
assert.equal(mr.enabled, false, 'rule whose only removed stock schedule vanished must fail closed');
assert.deepEqual(mr.schedule.scheduleIds, []);
assert(Array.isArray(SD.Defaults.profile().schedules) && SD.Defaults.profile().schedules.length === 0);
console.log('migration-test: OK');
