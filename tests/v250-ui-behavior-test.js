const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const worker = read('src/background/service-worker.js');
const servers = read('src/ui/app/pages/servers.js');
const alarms = read('src/ui/app/pages/alarms.js');
const actions = read('src/ui/app/pages/rule-actions.js');
const events = read('src/ui/app/app-events.js');
const data = read('src/ui/app/pages/data.js');
const help = read('src/ui/app/pages/help.js');
const profiles = read('src/ui/app/pages/profiles.js');
const schedules = read('src/ui/app/pages/schedules.js');
const css = read('src/ui/app/app.css');

assert.equal(manifest.version, '2.5.3');
assert(worker.includes("text = 'ON'"));
assert(worker.includes("text = 'ERR'"));
assert(worker.includes("text = '!'"));
assert(worker.includes("await chrome.action.setBadgeText({ text })"));
assert(worker.includes('await setBadge().catch(() => {});'));
assert(alarms.includes('rule-card alarm-profile-entry'));
assert(alarms.includes('alarm-profile-icon'));
assert(alarms.includes('duplicate-alarm-profile'));
assert(!alarms.includes(' · ${A.esc(stopName'));
assert(servers.includes('<span><strong>Refresh Jira tab on new detection</strong></span>'));
assert(servers.includes('server-card-meta'));
assert(!servers.includes('>${connectionLabel}</span>'));
assert(events.includes("find(x => x.id === b.dataset.group)"));
assert(actions.includes('data-action-card-id'));
assert(actions.includes('actionIsOpen(a.id, index)'));
assert(data.includes("avatarUrl(x)"));
assert(help.includes('Version ${A.esc(SD.Constants.BUILD_VERSION)}'));
assert(profiles.includes('profile-card-icon profile-context-icon'));
assert(schedules.includes('schedule-entry-icon'));
assert(schedules.includes('schedule-entry-meta'));
assert(css.includes('.action-card-body {\n  display: grid !important;'));
assert(css.includes('.discovery-project-card-body {\n  padding: 12px 14px 14px !important;'));

const context = { globalThis: {}, console };
context.globalThis.SDCompanion = { Constants: { LIMITS: {
  ACTION_DELAY_MAX_SECONDS: 86400, COMMENT_TEMPLATE_COUNT_MAX: 50, COMMENT_TEMPLATE_MAX_CHARS: 5000,
  RULE_MAX_ISSUES: 10000, RULE_MAX_ACTIONS: 1000, RULE_MAX_HOURLY: 10000, RULE_ACTION_COUNT_MAX: 50,
  REPEAT_SECONDS_MIN: 1, REPEAT_SECONDS_MAX: 31536000, JQL_MAX_CHARS: 20000,
  CURSOR_OVERLAP_MIN_SECONDS: 0, CURSOR_OVERLAP_MAX_SECONDS: 86400,
  ALERT_THROTTLE_MAX_ALERTS: 1000, ALERT_THROTTLE_WINDOW_MAX_MINUTES: 10080,
  POLL_MIN_SECONDS: 1, POLL_MAX_SECONDS: 86400, POLL_JITTER_MAX: 100,
  REQUEST_SPACING_MIN_MS: 0, REQUEST_SPACING_MAX_MS: 60000, REQUEST_JITTER_MAX: 100,
  REQUEST_TIMEOUT_MIN_MS: 1, REQUEST_TIMEOUT_MAX_MS: 600000, REQUEST_RETRIES_MAX: 20,
  REQUESTS_PER_MINUTE_MIN: 1, REQUESTS_PER_MINUTE_MAX: 100000, CONCURRENCY_MIN: 1, CONCURRENCY_MAX: 100,
  BACKOFF_MAX_SECONDS: 86400, METADATA_SYNC_MIN_SECONDS: 1, METADATA_SYNC_MAX_SECONDS: 31536000,
  CONNECTION_LOSS_MIN_SECONDS: 1, CONNECTION_LOSS_MAX_SECONDS: 31536000,
  CONNECTION_LOSS_FAILURES_MIN: 1, CONNECTION_LOSS_FAILURES_MAX: 1000
}, EXECUTION_POLICY: { REPEAT: 'repeat' }, CONFLICT_MODE: { EXCLUSIVE: 'exclusive' }, ALARM_PRESETS: [{id:'radar'}], ALARM_STOP_METHODS: [{id:'duration'}], TRANSITION_METHOD: { WORKFLOW_DESIGNER: 'workflow-designer' } } };
vm.runInNewContext(read('src/shared/validators.js'), context);
const rule = { name: 'Empty group', priority: 100, enabled: false, source: { mode: 'conditions', jql: '' }, logic: { operator: 'AND', groups: [{ id: 'g1', conditions: [] }] }, schedule: { mode: 'always', scheduleIds: [] }, executionPolicy: { mode: 'once' }, conflict: {}, randomDelay: { minSeconds: 0, maxSeconds: 0 }, polling: { cursorOverlapSeconds: 0 }, actions: [], chainDependency: { cancelled:'continue', skipped:'continue', failed:'continue' }, manualProcess: { relativeSchedule:'update' }, alertThrottle: { enabled:false }, actionRandomness: { enabled:false, pools:[] } };
const errors = context.globalThis.SDCompanion.Validators.validateRule(rule);
assert(errors.some(x => /empty condition group/i.test(x)));
console.log('v2.5.3 UI/behavior regression: OK');
