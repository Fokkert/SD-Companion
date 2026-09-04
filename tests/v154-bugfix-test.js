const { textIncludes } = require('./source-assertions');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.chrome = { runtime: { sendMessage: () => Promise.resolve() } };
globalThis.SDCompanion = {};
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
for (const f of ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/schedule.js', 'src/shared/defaults.js'])
  load(f);
const SD = SDCompanion;
SD.Storage = { appendLog: async () => {}, appendAudit: async () => {} };
SD.Operations = { throwIfCancelled: () => {} };
load('src/background/discovery.js');
const calls = { search: 0, names: 0, designer: 0 };
const client = {
  searchPage: async () => {
    calls.search++;
    return { issues: [{ key: 'IT-1' }], total: 12 };
  },
  workflowNameFromIssuePage: async (key) => {
    calls.names++;
    return { workflowName: 'Incident Workflow', issueKey: key, browserUser: 'agent' };
  },
  workflowDesigner: async () => {
    calls.designer++;
    return {
      isDraft: false,
      layout: {
        statuses: [{ id: 'S<1>', name: 'Open', statusId: '1', initial: false }, { id: 'S<2>', name: 'Done', statusId: '2', initial: false }],
        transitions: [{ actionId: 31, id: 'A<31:S<1>:S<2>>', name: 'Resolve', sourceId: 'S<1>', targetId: 'S<2>', initial: false }]
      },
      workflowPermissions: { administrator: false }
    };
  }
};
const site = SD.Defaults.site({ id: 's', baseUrl: 'https://jira.example.test' });
site.inventorySettings.buildTransitionCatalog = true;
(async () => {
  const rows = [
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '1', statusName: 'Open' },
    { projectId: '10', projectKey: 'IT', projectName: 'IT', issueTypeId: '100', issueTypeName: 'Incident', statusId: '2', statusName: 'Done' }
  ];
  const cat = await SD.Discovery.buildTransitionCatalog(client, site, 's', rows, [], '');
  assert.equal(calls.search, 1, 'workflow discovery needs one lightweight issue lookup per project/issue type');
  assert.equal(calls.names, 1);
  assert.equal(calls.designer, 1);
  assert.equal(cat.find(x => x.statusId === '1').transitions[0].id, '31');
  assert(!textIncludes(fs.readFileSync('src/background/discovery.js', 'utf8'), 'Number.MAX_SAFE_INTEGER'), 'unbounded issue crawling must not return');
  const main = fs.readFileSync('src/ui/app/app-main.js', 'utf8'),
    home = fs.readFileSync('src/ui/app/pages/home.js', 'utf8'),
    sw = fs.readFileSync('src/background/service-worker.js', 'utf8');
  assert(!textIncludes(main, '#homeDetectionsCard:hover'), 'home refresh must not be disabled by hover');
  assert(textIncludes(main, "A.tryHomeActivityRefresh=async()=>{if(A.page!=='home')return;try{await A.pullHomeActivity?.();}catch{}}"));
  assert(textIncludes(home, 'data-issue-key=') && textIncludes(home, 'openIssues'), 'expanded action-history rows must survive polling');
  assert(textIncludes(sw, 'collectCurrentMatches') && textIncludes(sw, 'profile.runtime.currentDetections=current.rows') && textIncludes(sw, 'profile.runtime.currentDetectionsAt=at') && textIncludes(sw, 'updateRadar(s,p||profile,current.detections)'), 'monitor cycles must refresh Current detections and radar from the full current snapshot');
  console.log('v154-bugfix-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
