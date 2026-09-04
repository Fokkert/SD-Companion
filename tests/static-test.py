import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXT_SOURCE_SUFFIXES = {'.js', '.json', '.md', '.html', '.css', '.svg'}
RUNTIME_SOURCE_SUFFIXES = {'.js', '.html', '.css'}


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding='utf-8')


def compact_source(value):
    return re.sub(r'\s+', '', value).replace(';}','}')


def source_in(source, expected):
    return compact_source(expected) in compact_source(source)


manifest = json.loads(read('manifest.json'))

assert manifest['manifest_version'] == 3
assert manifest['version'] == '2.4.1'
assert manifest['version_name'] == 'V2'
assert 'content_scripts' not in manifest
assert 'options_page' not in manifest
assert 'options_ui' not in manifest
assert manifest['action']['default_popup'] == 'src/ui/app/app.html'
assert manifest['side_panel']['default_path'] == 'src/ui/app/sidepanel.html'

for permission in (
    'sidePanel',
    'offscreen',
    'scripting',
    'alarms',
    'storage',
    'tabs',
    'unlimitedStorage',
):
    assert permission in manifest['permissions']

for html_path in ('src/ui/app/app.html', 'src/ui/app/sidepanel.html'):
    html = read(html_path)
    for script in (
        'shared/condition-registry.js',
        'shared/rule-query.js',
        'shared/validators.js',
        'pages/home.js',
        'pages/servers.js',
        'pages/rules.js',
        'pages/data.js',
        'pages/help.js',
    ):
        assert script in html, (html_path, script)

tabs = read('src/background/jira-tabs.js')
assert not (ROOT / 'src/background/transport.js').exists()
assert 'fetchViaJiraTab' not in tabs
assert 'executeScript' not in tabs
assert '/rest/api/' not in tabs

source = '\n'.join(
    path.read_text(encoding='utf-8', errors='ignore')
    for path in ROOT.rglob('*')
    if path.is_file() and path.suffix.lower() in TEXT_SOURCE_SUFFIXES
)
assert not re.search(r'Bearer\s+[A-Za-z0-9_\-]{30,}', source)

constants = read('src/shared/constants.js')
defaults = read('src/shared/defaults.js')
service_worker = read('src/background/service-worker.js')
discovery = read('src/background/discovery.js')
jobs = read('src/background/job-queue.js')
css = read('src/ui/app/app.css')
events = read('src/ui/app/app-events.js')
rules = read('src/ui/app/pages/rules.js')
actions = read('src/ui/app/pages/rule-actions.js')
home = read('src/ui/app/pages/home.js')
servers = read('src/ui/app/pages/servers.js')
settings = read('src/ui/app/pages/logs-more.js')
data = read('src/ui/app/pages/data.js')
help_source = read('src/ui/app/pages/help.js')
storage = read('src/shared/storage.js')
migrations = read('src/shared/migrations.js')
schedules = read('src/ui/app/pages/schedules.js')
client = read('src/api/jira-client.js')

# Always-live execution: no current UI/runtime gate, while migration may delete
# legacy state.
runtime = '\n'.join(
    path.read_text(encoding='utf-8', errors='ignore')
    for path in (ROOT / 'src').rglob('*')
    if path.is_file()
    and path.suffix.lower() in RUNTIME_SOURCE_SUFFIXES
    and path.name != 'migrations.js'
)
assert 'SET_DRY_RUN' not in constants
assert 'Global execution mode' not in settings
assert 'globalDryRun' not in jobs
assert 'blockedByDryRun' not in jobs

for expected in ('rules:[]', 'schedules:[]', 'templates:[]', 'actions:[]'):
    assert source_in(defaults, expected)
assert source_in(defaults, 'safety:safety()')
assert source_in(migrations, 'delete out.safety')

for expected in ("'reserved'", "'uncertain'", 'issueLocks'):
    assert expected in jobs
assert 'scheduleJob' in jobs
assert 'setTimeout' in jobs
assert '31000' in jobs, 'short action timing must have MV3-safe hybrid scheduler'

assert 'created is not EMPTY' not in service_worker
assert 'issue-catalog' not in discovery
assert 'projectDatasets' in discovery
assert 'SYNC_SCOPE_CHANGED' in discovery
assert 'scopeRevision' in discovery
for removed in ('projectComponents', 'projectVersions', 'projectRoleMap', 'visibleUsers'):
    assert removed not in discovery

assert 'Health heartbeat' in servers
assert 'maxRequestsPerMinute' in defaults
for label in ('Execution policy', 'Conflict policy', 'Effective JQL', 'Save Rule'):
    assert label in rules
assert 'Safety limits' not in rules

assert 'Global safety limits' in settings
assert 'autoSync.enabled' in settings
assert 'METADATA_SYNC' in service_worker
assert 'metadataSyncTick' in service_worker
for unit_name in ('repeatUnit', 'cursorOverlapUnit', 'intervalUnit', 'durationUnit'):
    assert unit_name in defaults
assert 'data-action-time-unit' in actions
assert 'pollUnit' in schedules

assert 'comment-template-row' in actions
assert 'data-comment-template-index' in actions
assert 'templatesText' not in actions
assert source_in(actions, "a.mode==='specific'")
assert source_in(actions, "a.mode==='random'")
assert 'Specific user' in actions
assert 'User pool' in actions

assert 'configured-object-stack' in rules
assert 'cancel-rule-edit' in rules
assert 'discardRuleEdit' in events
assert 'configured-object-stack' in servers
assert 'close-server-editor' in servers

assert 'data-workspace' in data
assert 'data-catalog' in data
assert source_in(data, 'statuses:s.statuses')

for expected in ('Detections &amp; Actions', 'activity-issue', 'actionDetail', 'Pending'):
    assert expected in home

assert 'page-host' in css
assert source_in(css, 'padding-bottom:132px')
assert source_in(css, 'overflow-x:hidden!important')
assert source_in(css, 'grid-template-columns:minmax(0,1fr) repeat(5,38px)')

assert 'chrome.tabs.reload' in service_worker
assert source_in(service_worker, 'chrome.tabs.update(tab.id,{url})')
assert 'lastTabRefreshCount' in service_worker
assert 'lastDetectionKeys' in service_worker
assert source_in(defaults, 'lastDetectionKeys:[]')

assert 'LIVE' not in read('src/ui/app/app.html')
assert 'LIVE' not in read('src/ui/app/sidepanel.html')
assert 'dry run' not in help_source.lower()
for forbidden in ('darvag', '.dc', 'jira.darvag', 'production jira'):
    assert forbidden not in help_source.lower(), forbidden

assert source_in(css, '--side-ui-min:517px')
assert source_in(css, '--side-ui-max:980px')
assert 'cancelOperation' in read('src/ui/app/app.html')
assert 'CANCEL_OPERATION' in events

ui_source = '\n'.join(
    path.read_text(encoding='utf-8', errors='ignore')
    for path in (ROOT / 'src/ui').rglob('*')
    if path.is_file() and path.suffix.lower() in {'.js', '.html'}
)
assert not re.search(r'<select[^>]*\bmultiple\b', ui_source, re.I)
assert 'sd-soft-select-portal' in read('src/ui/app/soft-select.js')

assert 'state.configRevision' in storage
assert 'STATE_REVISION_CONFLICT' in storage
assert 'avatarUrl' in discovery
assert 'projectLogo' in data
assert 'x.iconUrl' in data

assert 'ALL groups' not in rules
assert '+ Group' in rules
assert 'Condition groups' in rules
assert 'Match all groups' in rules
assert 'Match any group' in rules
assert 'Match all' in rules
assert 'Match any' in rules
assert 'filterCoverage' in discovery
assert '/filter/my' in client
assert '/filter/search' in client

assert 'fetchViaJiraTab' not in client
assert 'jira-tab' not in client
assert 'transportMode' not in client
assert 'addressSpace' not in client
assert 'NETWORK_REQUEST_FAILED' in client
assert 'targetAddressSpace' not in client
assert 'Local Network Access/CORS policy' in client

assert 'REST transport' not in servers
assert 'Network destination' not in servers
assert 'Certificate handling' not in servers
assert 'Factory reset' in settings
assert 'Audit Journal' in settings
assert 'Log level' in settings
assert 'activityRefreshSeconds' in defaults
assert 'completionToneEnabled' in defaults

print('static-test: OK')
