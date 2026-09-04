const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/condition-registry.js', 'src/shared/rule-query.js', 'src/shared/defaults.js']) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
vm.runInThisContext(fs.readFileSync('src/ui/app/app-core.js', 'utf8'), { filename: 'app-core' });
const SD = SDCompanion,
  A = SDApp,
  site = SD.Defaults.site({ baseUrl: 'https://jira.example.test', name: 'Jira' }),
  profile = SD.Defaults.profile('Default Profile', site);
site.filters = [{ id: '1', name: 'Open tickets', jql: 'project = IT AND issuetype = Incident' }, { id: '2', name: 'Empty but saved', jql: 'project = IT' }];
site.projects = [{ id: '10', key: 'IT', name: 'IT', avatarUrl: 'it.png' }, { id: '20', key: 'HR', name: 'HR' }];
site.inventorySettings.projectDatasets = { IT: SD.Defaults.projectDatasets(true) };
site.users = [{ key: 'me', name: 'me', displayName: 'Me', avatarUrl: 'me.png' }];
site.issueTypes = [{ id: '100', name: 'Incident', projectKey: 'IT', iconUrl: 'incident.png' }];
site.statuses = [{ id: '1', name: 'Open', projectKey: 'IT', issueTypeId: '100' }];
site.priorities = [{ id: '1', name: 'High' }];
site.resolutions = [{ id: '1', name: 'Done' }];
site.transitionCatalog = [
  {
    projectId: '10',
    projectKey: 'IT',
    projectName: 'IT',
    issueTypeId: '100',
    issueTypeName: 'Incident',
    statusId: '1',
    statusName: 'Open',
    transitions: [{ id: '31', name: 'Start Progress', toStatusId: '3', toStatusName: 'In Progress' }]
  },
  {
    projectId: '10',
    projectKey: 'IT',
    projectName: 'IT',
    issueTypeId: '200',
    issueTypeName: 'Task',
    statusId: '1',
    statusName: 'Open',
    transitions: [{ id: '31', name: 'Start Progress', toStatusId: '3', toStatusName: 'In Progress' }]
  }
];
site.fields = [{ id: 'summary', name: 'Summary', custom: false }, { id: 'customfield_10000', name: 'Location', custom: true }];
site.inventory = { counts: { projects: 2, users: 1, filters: 2, selectedProjects: 1 }, warnings: [], freshness: { projects: { at: new Date().toISOString(), count: 2 } } };
site.runtime = { apiHealthy: true, healthState: 'healthy', tabOpen: false, tabCount: 0, radarEvents: [], radarMarkers: [], apiStats: { requests: 4 } };
A.state = {
  jiraSites: [site],
  profiles: [profile],
  activeSiteId: site.id,
  activeProfileId: profile.id,
  appearance: { theme: 'emerald-glass', openTarget: 'popup' },
  system: { logLevel: 'info', safety: SD.Defaults.safety(), activityRefreshSeconds: 3, activityRefreshUnit: 'seconds', completionToneEnabled: true },
  runtime: { activeAlarm: { active: false } }
};
A.credentialStatus = { [site.id]: true };
A.logs = [];
A.audit = [];
for (const f of [
  'src/ui/app/pages/base.js',
  'src/ui/app/pages/rule-conditions.js',
  'src/ui/app/pages/rule-actions.js',
  'src/ui/app/pages/rules.js',
  'src/ui/app/pages/home.js',
  'src/ui/app/pages/data.js',
  'src/ui/app/pages/servers.js',
  'src/ui/app/pages/profiles.js',
  'src/ui/app/pages/health.js',
  'src/ui/app/pages/logs-more.js',
  'src/ui/app/pages/help.js'
]) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
profile.rules = [SD.Defaults.rule('Test rule')];
profile.rules[0].source.filterIds = ['1'];
A.beginRuleEdit(profile.rules[0]);
A.ruleEditorSection = 'setup';
let rules = A.pageRules();
assert(!rules.includes('Effective JQL'));
assert(!rules.includes('Saved filters · optional'));
assert(rules.includes('Save Rule'));
A.ruleEditorSection = 'conditions';
rules = A.pageRules();
assert(rules.includes('Match all'));
assert(rules.includes('Conditions'));
assert(rules.includes('Effective JQL'));
assert(!rules.includes('Saved filters · optional'));
A.ruleDraft.source.mode = 'jql';
rules = A.pageRules();
assert(rules.includes('Saved filters · optional'));
A.ruleDraft.source.mode = 'conditions';
A.ruleEditorSection = 'actions';
rules = A.pageRules();
assert(rules.includes('Actions'));
assert(rules.includes('+ Add action'));
assert(!/<select[^>]*\bmultiple\b/i.test(rules));
A.ruleEditorSection = 'advanced';
rules = A.pageRules();
assert(rules.includes('Execution policy'));
const home = A.pageHome();
assert(home.includes('Monitoring'));
assert(home.includes('Scan Now'));
assert(home.includes('Auto refresh · 3s'));
assert(home.includes('Current'));
assert(home.includes('Recent'));
const data = A.pageData();
assert(!data.includes('>Issues <'));
assert(data.includes('Filters'));
assert(data.includes('Projects'));
A.inventoryType = 'transitions';
const transitionData = A.pageData();
assert.equal((transitionData.match(/class="transition-card"/g) || []).length, 2, 'Data page must preserve the same transition separately in each workflow context');
assert(transitionData.includes('Before status'));
assert(transitionData.includes('After status'));
assert(!transitionData.includes('transition-data-head'));
assert(!transitionData.includes('>ID<'));
assert(transitionData.includes('Incident'));
assert(transitionData.includes('Task'));
A.inventoryType = 'fields';
const fieldData = A.pageData();
assert(fieldData.includes('<strong>Summary</strong>'));
assert(fieldData.includes('Custom · customfield_10000'));
A.inventoryType = 'projects';
A.serverEditId = site.id;
const servers = A.pageServers();
assert(servers.includes('Discovery'));
assert(servers.includes('data-project-dataset="users"'));
assert(servers.includes('data-project-dataset="fields"'));
assert(servers.includes('API pacing'));
assert(servers.includes('Health heartbeat'));
assert(servers.includes('serverUrlEdit'));
assert(servers.includes('Statuses'));
assert(!servers.includes('>States<'));
const profiles = A.pageProfiles();
assert(profiles.includes('Profiles on'));
const health = A.pageHealth();
assert(health.includes('Server capabilities'));
assert(health.includes('Permission matrix'));
const settings = A.pageSettings();
assert(settings.includes('Opening mode'));
assert(settings.includes('Save'));
A.settingsSection = 'automation';
A.settingsAutomationSection = 'sync';
let automation = A.pageSettings();
assert(automation.includes('Sync & Refresh'));
assert(automation.includes('Periodic project-data sync'));
assert(automation.includes('Home history refresh'));
assert(automation.includes('Action Completion Tone'));
assert(!automation.includes('Alarm Profiles'));
A.settingsAutomationSection = 'safety';
automation = A.pageSettings();
assert(automation.includes('Global safety limits'));
A.settingsSection = 'general';
const generalSettings = A.pageSettings();
assert(generalSettings.includes('Alarm Profiles'));
assert(generalSettings.includes('alarmVolumeValue'));
assert(!generalSettings.includes('Browser notification'));
const help = A.pageHelp();
assert(help.includes('Execution Policy'));
assert(help.includes('API pacing'));
console.log('ui-render-test: OK');
