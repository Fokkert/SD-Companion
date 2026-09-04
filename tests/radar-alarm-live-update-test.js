const { textIncludes } = require('./source-assertions');
const fs = require('fs'), assert = require('assert');
const read = f => fs.readFileSync(f, 'utf8'),
  sw = read('src/background/service-worker.js'),
  main = read('src/ui/app/app-main.js'),
  home = read('src/ui/app/pages/home.js'),
  defaults = read('src/shared/defaults.js'),
  events = read('src/ui/app/app-events.js'),
  servers = read('src/ui/app/pages/servers.js'),
  app = read('src/ui/app/app.html'),
  side = read('src/ui/app/sidepanel.html'),
  css = read('src/ui/app/app.css'),
  jobs = read('src/background/job-queue.js'),
  tabs = read('src/background/jira-tabs.js'),
  health = read('src/ui/app/pages/health.js');
assert(textIncludes(sw, 'SD_CYCLE_DONE') && textIncludes(main, 'SD_CYCLE_DONE'), 'scheduled cycles must notify open Home UI');
assert(textIncludes(sw, 'previousMarkers=new Map') && textIncludes(sw, 'previous?.at||d.at'), 'persistent markers must keep original detection time');
assert(textIncludes(sw, 'lastDetectionKeys') && textIncludes(defaults, 'lastDetectionKeys:[]'), 'new detection identity must not depend on capped radar markers');
assert(textIncludes(home, 'radar-dot-latest') && textIncludes(home, "'var(--danger)':'var(--primary)'"), 'latest marker red, older markers theme colored');
assert(textIncludes(app, 'id="quickStopAlarm"') && textIncludes(app, 'data-action="stop-alarm"'));
assert(textIncludes(side, 'id="quickStopAlarm"') && textIncludes(side, 'data-action="stop-alarm"'));
assert(textIncludes(sw, 'chrome.offscreen.closeDocument') && textIncludes(sw, 'SD_OFFSCREEN_STOP'), 'Stop Alarm hard stop missing');
assert(textIncludes(sw, 'getPermissionLevel') && textIncludes(sw, 'requireInteraction:true') && textIncludes(sw, 'buttons:[{title:"Stop alarm"}]'));
assert(textIncludes(sw, 'sd-companion-jira-alarm-popup') && textIncludes(sw, 'jiraAlarmPopupScript'));
assert(textIncludes(defaults, 'autoRefreshJiraTabsOnDetection:false') && textIncludes(servers, 'autoRefreshOnDetection') && textIncludes(sw, 'chrome.tabs.reload'));
assert(textIncludes(sw, 'chrome.tabs.update(tab.id,{url})'), 'Jira tab refresh fallback missing');
assert(textIncludes(tabs, 'tab?.pendingUrl'), 'tab matching must handle loading Jira tabs');
assert(textIncludes(health, 'Jira tab refresh'));
assert(textIncludes(home, 'radar-monitor-card') && textIncludes(home, 'homeMonitor') && textIncludes(home, 'run-cycle'));
assert(textIncludes(css, '.radar-monitor-card') && textIncludes(css, '@keyframes radarLatestPulse'));
assert(!textIncludes(jobs, 'globalDryRun') && !textIncludes(jobs, 'blockedByDryRun'), 'live queue must not contain Dry Run gate');
assert(textIncludes(events, "A.$('importFile')?.addEventListener") && textIncludes(events, 'if(!group)return'));
console.log('radar-alarm-live-update-test: OK');
