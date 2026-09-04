const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
globalThis.crypto = require('crypto').webcrypto;
globalThis.SDCompanion = {};
globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
globalThis.chrome = { storage: { session: { get: () => {} }, local: { get: () => {} } }, runtime: {} };
const root = path.join(__dirname, '..'),
  load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('src/shared/constants.js');
load('src/shared/utils.js');
load('src/shared/defaults.js');
SDCompanion.Storage = { getCredential: async () => '' };
load('src/ui/app/app-core.js');
(async () => {
  assert.equal(SDCompanion.Constants.BUILD_VERSION, '2.3.0');
  const large = { format: 'sd-companion-profile', version: 3, server: { baseUrl: 'https://jira.example.test' }, profile: { name: 'Large secure backup', inventoryBlob: 'x'.repeat(750000) } };
  const password = 'correct horse battery staple';
  const encrypted = await SDApp.encrypt(large, password);
  assert.equal(encrypted.format, 'sd-companion-secure-backup');
  assert(encrypted.ciphertext.length > 750000, 'ciphertext should exercise large Base64 conversion');
  const decrypted = await SDApp.decrypt(encrypted, password);
  assert.deepEqual(decrypted, large);
  console.log('v211-large-secure-backup-test: OK');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
