# SD Companion (Service Desk Companion)

SD Companion is a Chrome/Chromium browser extension for **Jira Server and Jira Data Center** that
detects issues and automates Jira actions through the Jira API.

It is designed for service-desk and operational workflows where Jira issues need to be monitored
continuously and acted on according to configurable rules.

## What SD Companion Does

SD Companion can:

- Connect to one or more Jira Server/Data Center instances using Personal Access Tokens (PATs).
- Discover Jira projects, issue types, statuses, users, fields, filters, priorities, resolutions and
  transition metadata.
- Detect Jira issues using configurable rules and Jira Query Language (JQL).
- Apply additional conditions to detected issues before actions are scheduled.
- Run one-time **Bulk Operations** from Rules using the same filters, conditions and action-chain model as rules, without saving a rule.
- Run automated Jira actions, including:
  - assign or unassign issues;
  - post comments with issue variables such as `{{issue.key}}` and `{{issue.assignee}}`;
  - transition issues;
  - edit fields with variable expansion, including custom Jira fields;
  - add or remove labels;
  - change priority.
- Schedule actions with configurable delays and dependencies.
- Require explicit user approval for selected actions before they are allowed to execute.
- Rate-limit local Alarm/Notification actions per rule to prevent alert floods.
- Run configurable monitoring schedules.
- Process matching issues immediately when requested.
- Monitor Jira connectivity and report connection problems.
- Maintain profiles for different Jira servers or automation configurations.
- Export and import profiles.
- Create password-encrypted profile backups that can include Jira credentials.
- Protect the extension UI and sensitive operations with an optional local PIN/password lock.
- Review action history with active/new work first and optionally hide completed history.
- Review technical diagnostics and operational audit events together in one Activity Journal.
- Run from the normal extension popup or Chrome/Edge side panel.
- Show Alarm Profile stop popups across eligible open web tabs so an active alarm can be stopped without returning to Jira.

Jira permissions remain authoritative: SD Companion can only read or change data that the Jira user
associated with the configured PAT is allowed to access.

## Installation

SD Companion is distributed as a GitHub Release ZIP for manual installation as an unpacked Chromium
extension.

### 1. Download SD Companion

Open the repository's **Releases** page:

https://github.com/Fokkert/SD-Companion/releases/latest

Download the `SD-Companion-vX.Y.Z.zip` file from the release assets.

Do **not** use GitHub's automatically generated **Source code (zip)** archive for normal
installation. The SD Companion release ZIP contains only the files required by the browser
extension.

### 2. Extract the ZIP

Extract the downloaded ZIP to a permanent location. The release archive contains one versioned
top-level folder, for example:

```text
C:\Users\<you>\Documents\SD-Companion-v2.6.1\
```

Do not delete that folder while the extension is installed. Chrome/Edge loads the unpacked extension
directly from it.

### 3. Open the Extensions page

Chrome:

```text
chrome://extensions
```

Microsoft Edge:

```text
edge://extensions
```

### 4. Enable Developer mode

Enable **Developer mode** on the Extensions page.

### 5. Load SD Companion

Select **Load unpacked** and choose the versioned folder created by extraction.

That selected folder directly contains:

```text
SD-Companion-vX.Y.Z\
├── manifest.json
├── icons\
└── src\
```

Choose `SD-Companion-vX.Y.Z` itself in Chrome/Edge, not its parent directory.

SD Companion should now appear in the browser's extension list.

## Updating SD Companion

1. Download the ZIP for the newest GitHub Release.
2. Extract it over your existing SD Companion installation folder, or replace that folder with the
   newly extracted version.
3. Open `chrome://extensions` or `edge://extensions`.
4. Find **SD Companion**.
5. Select **Reload**.

Your operational configuration is stored in browser extension storage rather than in the extension's
source directory. As with any operational tool, keeping a current encrypted configuration backup
before significant upgrades is recommended.

## Initial Setup

After loading SD Companion:

1. Open the extension.
2. Add a Jira server.
3. Enter the Jira base URL.
4. Enter a Jira Personal Access Token.
5. Test the connection.
6. Select the Jira projects and metadata that SD Companion should discover.
7. Synchronize Jira data.
8. Create a profile.
9. Configure rules, conditions, schedules and actions.
10. Enable monitoring when the configuration is ready.

## Jira Authentication

SD Companion uses Jira Personal Access Tokens for authenticated Jira REST API operations.

PATs can be configured for browser-local persistence or session-only use.

Normal profile exports intentionally exclude the PAT. Password-encrypted secure backups can include
credentials when explicitly requested.

Never publish real Jira PATs, exported secure backups, internal Jira URLs, customer data or
organization-specific configuration to a public repository.

## Rules and Detection

Rules determine which Jira issues SD Companion should detect.

Each rule chooses one detection method: **JQL** (saved filters and/or Additional JQL) or **Manual**. The two methods are not evaluated concurrently. Manual can be organized into condition groups, with Match all/Match any behavior both within groups and across groups.

Rules can also be restricted by schedules so that monitoring or automation only applies during the
intended operating periods.

SD Companion performs execution-time validation before writable Jira actions. Cached Jira metadata
is used for configuration and discovery, but the target issue is rechecked before an action is
executed.

## Actions

SD Companion supports action pipelines for detected issues.

Available actions include assignment/unassignment, comments, transitions, field edits, label changes,
priority changes, local alarms and browser notifications.

Actions can use delays and dependencies, allowing multi-step workflows to execute in a controlled
order rather than all at once. Individual actions can also enable **Needs approval**. Approval-gated
actions remain in Home → Detections & Actions and cannot execute until a user explicitly approves them.

Home → Detections & Actions keeps approval/running/pending work above older completed history. A
**Show completed** toggle can hide terminal actions, and **Approve all** is available for the active
server/profile when approval-gated actions are waiting.

Because these actions can modify Jira issues, test automation against non-critical issues before
enabling it broadly.

## Bulk Operations

Rules → **Bulk Operations** provides a one-time execution surface for work that should run immediately
without creating or saving a monitoring rule. Build a constrained Jira filter, optional typed
conditions and an ordered action chain, preview the current matches, then choose **Run now**.

Bulk Operations use the same action validation, Jira preflight, safety limits, delays, chained-action
dependencies and optional approval gates as normal rule actions. The temporary bulk definition is not
added to the profile's saved rules.

## Local Alert Controls

Alarm and Notification actions can be rate-limited per rule. Enable the rule's **Local alert rate
limit** and configure the maximum number of local alerts allowed within a rolling time window. The
limit applies to both Alarm and Notification actions belonging to that rule.

The top alarm-stop control stops the current rule alarm and cancels queued/scheduled Alarm actions
across the extension. Browser action notifications use one stable notification slot so new action
notifications replace the previous one instead of building an unbounded stack.

## Profiles

Profiles keep automation configuration separated.

They can contain rules, schedules, monitoring settings, Alarm Profiles and other profile-specific automation
configuration for a Jira server.

Profiles can be exported and imported for migration or backup. Exports include Alarm Profiles and synchronized-data exclusion/refresh settings alongside the profile and related server configuration. Existing profiles can also be duplicated. A duplicate receives independent rule, schedule, action and condition identifiers, resets runtime state and starts with monitoring disabled so the copy cannot immediately double-run automation.

For credential-bearing backups, use SD Companion's encrypted secure-backup option.

## Security

SD Companion includes an optional device-local extension lock.

When enabled:

- the UI can require a PIN or password;
- only a salted password verifier is stored rather than the plaintext PIN/password;
- sensitive operations require re-authentication;
- sensitive-action authorization is enforced by the extension service worker;
- browser restarts require a new unlock session.

Sensitive operations include credential changes, imports, credential-bearing exports and destructive
operations.

## Browser Permissions

SD Companion needs access to Jira pages and Jira API endpoints configured by the user.

The extension uses broad HTTP/HTTPS host permissions because Jira instances may be hosted on
different domains, internal hostnames or network locations.

Only configure and use SD Companion with Jira systems you are authorized to access.

## Networking

Jira API requests are performed by the extension service worker.

SD Companion does not disable normal browser/network security controls. TLS certificate validation,
DNS, proxies, VPNs, CORS and Chromium network-access policies still apply.

If an internal Jira instance uses a private certificate authority, the Jira certificate chain must
be trusted by the operating system/browser.

## Releases

Installable builds are published on GitHub Releases:

https://github.com/Fokkert/SD-Companion/releases

Each release provides a clean extension ZIP containing the runtime files needed by Chrome/Edge.

Versions before the first public GitHub release were internal development builds and were not
publicly distributed.

Development-only files such as tests, repository documentation and changelogs are intentionally
excluded from the installable ZIP.

## Documentation

Additional technical documentation is available in [`docs/`](docs/):

- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`API-MAP.md`](docs/API-MAP.md)
- [`RULES-AND-ACTIONS.md`](docs/RULES-AND-ACTIONS.md)
- [`SECURITY.md`](docs/SECURITY.md)
- [`TEST-REPORT.md`](docs/TEST-REPORT.md)

For version-by-version changes, see [`CHANGELOG.md`](CHANGELOG.md).

## Development

The source repository contains the extension runtime, automated tests and technical documentation.

The installable release package is intentionally smaller than the repository. A release package
contains one versioned top-level folder and only the runtime files inside it:

```text
SD-Companion-vX.Y.Z/
  manifest.json
  icons/
  src/
```

Repository files such as `README.md`, `CHANGELOG.md`, `LICENSE`, `docs/` and `tests/` are not
required by Chrome at runtime and are not included in the release asset.

## AI-Generated Code Disclosure

The implementation in this repository was generated with **ChatGPT by OpenAI** from requirements and
instructions provided by the project owner. The project owner did not manually write the source
code.

AI-generated code can contain defects, security issues or incorrect assumptions. Automated tests are
included in the repository, but users and contributors should independently review and validate the
code for their own environment before relying on it in production.

## License

SD Companion is licensed under the **Apache License 2.0**.

See [`LICENSE`](LICENSE) for the complete license text.

## Disclaimer

SD Companion can perform write operations against Jira.

Review rules and action pipelines carefully before enabling automation in production. Jira
permissions, workflow restrictions and server-side validation remain authoritative.
