const { textIncludes } = require('./source-assertions');
const fs = require('fs'), assert = require('assert');
const sw = fs.readFileSync('src/background/service-worker.js', 'utf8'),
  discovery = fs.readFileSync('src/background/discovery.js', 'utf8'),
  client = fs.readFileSync('src/api/jira-client.js', 'utf8'),
  query = fs.readFileSync('src/shared/rule-query.js', 'utf8'),
  data = fs.readFileSync('src/ui/app/pages/data.js', 'utf8');
assert(!textIncludes(sw, 'created is not EMPTY'));
assert(!textIncludes(discovery, 'created is not EMPTY'));
assert(!textIncludes(discovery, 'issue-catalog'));
assert(!textIncludes(data, '["issues","Issues"]'));
assert(textIncludes(sw, 'SD.RuleQuery.preview'));
assert(textIncludes(query, 'hasConstraint'));
assert(textIncludes(discovery, 'workflowNameFromIssuePage'));
assert(textIncludes(discovery, 'workflowDesigner'));
assert(textIncludes(discovery, 'maxResults:3'));
assert(textIncludes(discovery, 'buildWorkflowDesignerCatalog'));
assert(textIncludes(discovery, 'buildIssueExtractionCatalog'));
assert(textIncludes(discovery, 'transitionProbeBudget'));
assert(textIncludes(discovery, 'transitionSampleWindows'));
assert(textIncludes(discovery, 'await client.transitions(issue.key)'));
assert(textIncludes(discovery, 'TRANSITION_METHOD.ISSUE_EXTRACTION'));
assert(textIncludes(discovery, 'return buildWorkflowDesignerCatalog(client,site,siteId,matrix,warnings,operationId)'), 'Workflow Designer must remain the default dispatcher path');
assert(textIncludes(client, 'credentials:"include"'));
assert(textIncludes(client, '/rest/workflowDesigner/latest/workflows'));
assert(!textIncludes(discovery, 'Number.MAX_SAFE_INTEGER'));
console.log('no-blind-issues-test: OK');
