const { textIncludes } = require('./source-assertions');
const fs = require('fs');
const assert = require('assert');
const events = fs.readFileSync('src/ui/app/app-events.js', 'utf8');
const worker = fs.readFileSync('src/background/service-worker.js', 'utf8');
const constants = fs.readFileSync('src/shared/constants.js', 'utf8');
// New UI must not depend on the V1.5.3+ SAVE_SETTINGS message because Chrome can
// temporarily pair a newly loaded UI document with a previous live worker.
assert(!textIncludes(events, 'A.send(MESSAGE.SAVE_SETTINGS'), 'Settings UI still directly depends on SAVE_SETTINGS');
assert(textIncludes(events, 'const commitSettingsDraft=async'), 'Atomic compatibility settings commit helper is missing');
assert(textIncludes(events, 'A.send(MESSAGE.GET_STATE)'), 'Settings compatibility path must fetch latest state');
assert(textIncludes(events, "A.send(MESSAGE.SAVE_STATE,{state:latest,baseRevision:latest.configRevision,validationScope:'none'})"), 'Settings compatibility path must use revision-checked SAVE_STATE');
// New worker intentionally retains SAVE_SETTINGS for an already-open V1.5.8 UI.
assert(textIncludes(constants, 'SAVE_SETTINGS:"SAVE_SETTINGS"'), 'SAVE_SETTINGS constant must remain for rolling compatibility');
assert(textIncludes(worker, 'case MESSAGE.SAVE_SETTINGS:'), 'Worker must retain SAVE_SETTINGS handler for older open UI contexts');
console.log('v159-settings-message-compat-test: PASS');
