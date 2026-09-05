const { textIncludes } = require('./source-assertions');
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
globalThis.crypto = require('crypto').webcrypto;
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
const local = {}, session = {};
const api = store => ({
  get: async (k) => {
    if (Array.isArray(k))
      return Object.fromEntries(k.map(x => [x, store[x]]));
    return typeof k === 'string' ? { [k]: store[k] } : { ...store };
  },
  set: async (obj) => Object.assign(store, obj),
  remove: async (k) => {
    for (const x of Array.isArray(k) ? k : [k])
      delete store[x];
  },
  clear: async () => {
    for (const k of Object.keys(store))
      delete store[k];
  }
});
globalThis.chrome = { storage: { local: api(local), session: api(session) }, alarms: { clear: async () => true } };
globalThis.SDCompanion = {};
for (const f of [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/shared/schedule.js',
  'src/shared/condition-registry.js',
  'src/shared/rule-query.js',
  'src/shared/defaults.js',
  'src/shared/migrations.js',
  'src/shared/storage.js'
])
  vm.runInThisContext(read(f), { filename: f });
(async () => {
  const SD = SDCompanion, K = SD.Constants.STORAGE_KEYS;
  assert.equal(SD.Constants.BUILD_VERSION, '2.6.5');
  let st = await SD.Storage.securityStatus();
  assert.equal(st.enabled, false);
  assert.equal(st.unlocked, true);
  st = await SD.Storage.setSecurityPasscode({ method: 'pin', passcode: '482913', sessionMinutes: 45 });
  assert.equal(st.enabled, true);
  assert.equal(st.method, 'pin');
  assert.equal(st.unlocked, true);
  assert.equal(st.sessionMinutes, 45);
  assert(!textIncludes(JSON.stringify(local[K.SECURITY]), '482913'), 'plaintext PIN must never be stored');
  assert(local[K.SECURITY].salt && local[K.SECURITY].verifier, 'salted verifier must be stored');
  await SD.Storage.lockSecurity();
  st = await SD.Storage.securityStatus();
  assert.equal(st.unlocked, false);
  await assert.rejects(() => SD.Storage.unlockSecurity('000000'), /Incorrect PIN or password/);
  st = await SD.Storage.unlockSecurity('482913');
  assert.equal(st.unlocked, true);
  const risk = await SD.Storage.issueSecurityRiskToken('482913');
  assert(risk.token.length > 40);
  assert.equal(await SD.Storage.validateSecurityRiskToken(risk.token), true);
  st = await SD.Storage.updateSecuritySettings({ sessionMinutes: 120 });
  assert.equal(st.sessionMinutes, 120);
  st = await SD.Storage.disableSecurity();
  assert.equal(st.enabled, false);
  assert.equal(local[K.SECURITY], undefined);
  const manifest = JSON.parse(read('manifest.json')),
    core = read('src/ui/app/app-core.js'),
    events = read('src/ui/app/app-events.js'),
    settings = read('src/ui/app/pages/logs-more.js'),
    help = read('src/ui/app/pages/help.js'),
    worker = read('src/background/service-worker.js'),
    app = read('src/ui/app/app.html'),
    side = read('src/ui/app/sidepanel.html'),
    css = read('src/ui/app/app.css');
  assert.equal(manifest.version, '2.6.5');
  for (const src of [app, side])
    assert(textIncludes(src, 'securityLockOverlay') && textIncludes(src, 'securityReauthOverlay'));
  assert(textIncludes(settings, "nav('security','Security')"));
  assert(textIncludes(settings, 'security-set-passcode'));
  assert(textIncludes(settings, 'Save Session Timeout'));
  assert(!textIncludes(settings, 'Protected sensitive actions'));
  assert(textIncludes(help, 'Security and protected actions'));
  assert(textIncludes(help, 'Changing a Jira server URL or PAT is protected.'));
  assert(textIncludes(core, 'A.requestSecurityReauth'));
  assert(textIncludes(core, "mode:'risk'"));
  assert(textIncludes(core, 'A.scheduleSecurityRelock'));
  assert(textIncludes(events, "requestSecurityReauth('process this Jira action immediately')"));
  assert(textIncludes(events, "requestSecurityReauth('replace the Jira PAT')"));
  assert(textIncludes(events, "requestSecurityReauth('erase all SD Companion data')"));
  assert(textIncludes(worker, 'enforceExtensionUnlock'));
  assert(textIncludes(worker, 'SECURITY_REAUTH_REQUIRED'));
  assert(textIncludes(worker, "requireRiskAuth(message,'process this Jira action immediately')"));
  assert(textIncludes(worker, "if(message.fullImport)await requireRiskAuth"));
  assert(textIncludes(css, '.security-lock-overlay') && textIncludes(css, '.security-reauth-overlay'));
  console.log('v212-extension-security-lock-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
