# Security

- PATs are never included in normal profile exports.
- Session-only PAT storage is available when persistence is not desired.
- Password-encrypted secure profile backup uses PBKDF2-SHA256 key derivation and AES-GCM for
  protected export data. KDF iteration bounds, salt length, IV length and ciphertext shape are
  validated before decryption.
- Jira REST writes are performed only after configuration/permission checks, explicit action
  conditions, action dependencies, and action-specific optimistic state guards. Normal queued
  execution also revalidates the rule schedule; explicit manual Process is a user-requested schedule
  override.
- The idempotency ledger and per-issue lock reduce accidental replay/concurrent modification risk.
- Interrupted writes are marked uncertain when Jira may have received the request; they are not
  blindly replayed.
- Global safety limits bound comments, assignments, transitions, issues and actions.
- Individual actions can require explicit approval. Approval is a persisted queue state enforced by the background worker, not only a UI confirmation.
- Per-rule local-alert throttling and global queued-alarm cancellation reduce runaway Alarm/Notification behavior.
- Jira REST traffic originates only from the extension service worker; no Jira tab is used as an
  alternate API transport.
- SD Companion does not disable or bypass Chromium network or TLS validation. Chrome/Edge determine
  Local Network Access/CORS policy and the resolved address space; SD Companion does not force
  `targetAddressSpace`. A request that fails before Jira returns HTTP stops immediately. Because
  Fetch does not reliably distinguish TLS, LNA/CORS, DNS, proxy/VPN and reachability failures, the
  extension reports these as `NETWORK_REQUEST_FAILED` rather than falsely asserting a certificate
  problem.
- Imported JSON is recursively copied while dropping `__proto__`, `prototype` and `constructor` keys
  before it can reach application state, reducing prototype-pollution risk.
- Fatal UI exception text is inserted as text, not executable HTML.
- Logs and audit exports may contain Jira issue metadata; review them before sharing externally.

## Local extension lock (V2.0.12)

SD Companion can protect its popup and side-panel UI with a device-local PIN/password lock. The
secret is not stored or exported; only a salted PBKDF2-SHA256 verifier is persisted. Unlock sessions
and sensitive-action authorization tokens use `chrome.storage.session`, so a browser restart
requires a fresh unlock.

The lock does not pause background Jira monitoring. When the UI session expires, normal UI-to-worker
requests are rejected with `EXTENSION_LOCKED` until the user authenticates again. Alarm stop remains
allowed. Sensitive operations additionally require a fresh re-authentication token even while the
main UI session is unlocked.

This is an extension-level access control, not an OS security boundary. A user who controls the
browser profile or can uninstall/debug the extension is outside this threat model.

## TLS certificate validation

SD Companion cannot provide a per-server **Ignore invalid certificate** switch. Jira requests use the
browser extension Fetch stack, and Chromium does not expose an ordinary Manifest V3 extension API
that disables server-certificate verification for one host. The extension therefore fails closed when
TLS trust fails.

For Jira instances using an internal/private certificate authority, install/trust the issuing CA in the
operating system/browser trust store, deploy a certificate chaining to a trusted CA, or correct the Jira
TLS configuration. Do not depend on an extension-level certificate bypass.
