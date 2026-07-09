# MCP Server Attestation Key Custody

Status: experimental design note. This document describes a possible server-side MCP attestation pattern and the production key custody questions that must be answered before a real adapter is treated as more than a proof of concept.

This note does not change the core receipt envelope, Interop Profile semantics, schema, verifier behavior, canonicalization, cryptography or key handling, test vectors, package exports, CI behavior, or README links.

## Purpose

Server-side MCP adapters may emit `server_attested` receipts for selected high-impact tool actions. The strongest early candidates are mutating, destructive, or externally consequential operations such as file writes, deletes, moves, Docker lifecycle actions, deploys, or Git commits.

The receipt should make a portable signed claim about what the MCP server observed or performed at the server boundary. It should help later reviewers correlate an action with tool results, artifacts, logs, traces, sessions, or deployment records without requiring them to trust a local log file alone.

## Boundary

A server-attested receipt means the server signed a claim about what it observed or performed.

It does not prove:

- the action was correct
- the caller was authorized
- the server runtime was uncompromised
- the filesystem, container, Git, or deployment state still matches later
- every related event was captured
- the receipt is a complete audit log

The receipt is evidence from a particular signing key and runtime under a particular trust policy. It is not an authorization result, policy decision, compliance record, or full reconstruction of system state.

## When Server-Attested Receipts Are Useful

`server_attested` receipts are most useful when the MCP server has visibility that a client wrapper or local transcript does not have.

Examples include:

- multiple clients share one MCP server process
- logs lack caller, session, or correlation identity
- high-impact tool actions need later review
- artifacts or modified content need hashes
- an external reviewer does not fully trust local logs
- a result or action crosses a trust boundary

These receipts are especially useful when they can be matched to a target reference, artifact hash, request identifier, caller/session metadata, or external record.

## Selective Capture

Read-only tools should often be off by default. Signing every read, search, grep, host-info, or diagnostic call can create noise, storage pressure, and privacy risk. It can also make the receipt stream harder to review because consequential changes are buried among routine observations.

Mutating and destructive tools are the better first target. File writes, deletes, moves, Docker lifecycle actions, deploys, and Git commits usually have clearer review value and a more obvious trust-boundary story.

Projects may still choose to attest selected read-only actions when they are high impact, privacy-reviewed, and useful for later verification. The important default is selective capture rather than blanket capture.

## Integration Surface

The preferred pattern is to use a shared server response, helper, hook, or middleware path when one exists. An adapter should not require every tool to be wrapped manually if the MCP server already has a common place where success and error responses pass through.

Receipt emission should happen after tool completion or failure so the signed claim can distinguish what actually happened. Success and failure should be recorded distinctly. A failed delete and a successful delete are different events.

Receipt sink failures should not block the tool path by default. The host may explicitly opt into fail-closed behavior for higher-assurance deployments, but a proof-of-concept or developer workflow should usually fail open and surface receipt-writing failures separately.

Useful implementation points include:

- a common success response helper
- a common error response helper
- middleware around tool invocation
- project hooks inside composite tools
- a shared sink for receipt persistence or forwarding

Composite tools may need project hooks even if middleware exists. A single tool call can perform several meaningful operations, and only project code may know which internal event deserves a receipt.

## Candidate Claim Fields

The following shape is illustrative only. It is not a new required schema and does not extend the Interop Profile by itself.

```json
{
  "receipt_version": "0.1",
  "receipt_role": "server_attested",
  "event_id": "evt_01J00000000000000000000000",
  "timestamp": "2026-07-09T00:00:00.000Z",
  "action_type": "filesystem.write",
  "status": "executed",
  "target_ref": "file:src/example.ts",
  "redacted_args_hash": {
    "alg": "sha256",
    "value": "base64url..."
  },
  "artifact_hash": {
    "alg": "sha256",
    "value": "base64url..."
  },
  "client_ref": "client:desktop-app",
  "session_ref": "session:abc123",
  "request_ref": "mcp-request:456",
  "correlation_ref": "trace:789",
  "tool_name": "write_file",
  "signer_ref": "mcp-server:workspace-a"
}
```

An adapter might use `args_hash` when the raw argument representation is safe and stable, or `redacted_args_hash` when sensitive fields are removed or normalized before hashing. If produced or modified content exists, `artifact_hash` gives reviewers a way to compare the receipt with the resulting bytes.

Optional references should be included only when the host can define them clearly. A vague `client_ref` or `session_ref` is less useful than no field at all.

## Key Custody Modes

### Dev/demo local key

A generated local key is useful for examples and quick demos. It can show how receipts are signed and verified, but it should not be treated as production trust. Demo keys are often easy to delete, copy, overwrite, or generate inconsistently across runs.

### Stable local server key

A stable local server key survives restarts and upgrades. It is stored in a stable application data or configuration path, not in a temporary build output or unpacked application bundle. This mode needs guidance for file permissions, backup, restore, migration, and rotation.

This can be acceptable for controlled deployments, but the trust story depends on host hardening and operational discipline.

### OS secure storage

Desktop-packaged servers may use OS secure storage such as Keychain, Credential Manager, libsecret, or an equivalent platform facility. This usually improves protection over a plaintext config file and can align better with per-user desktop installs.

The adapter still needs to decide how keys are named, whether they are per-user or per-machine, how backup and restore work, and how users or administrators inspect the corresponding public key.

### TPM/HSM/KMS-backed signing

TPM, HSM, or KMS-backed signing is a stronger production option. The private key may never leave secure hardware or a managed signing service. This can improve auditability, central control, and revocation policy.

This mode usually requires explicit deployment configuration, key access policy, latency/error handling, and a public-key discovery story.

### External signer

An MCP server may send the canonical claim or claim hash to an external signing service. This is useful when an organization wants signing keys controlled outside the MCP server process.

The server must still protect the integrity of the claim it sends, handle signer failures, and record enough signer identity for later verification. The signing service should not be treated as proof that the underlying action was authorized or correct unless a separate policy system establishes that.

## Packaging and Install Considerations

Production adapters need a stable key location across install and upgrade. Keys should not live inside locations that installers, bundlers, or application updates replace.

Desktop-packaged servers introduce additional questions:

- PyInstaller, Tauri, NSIS, and similar packaging systems may unpack or replace application files during install or update
- per-user keys fit local desktop identity but may not represent an organization or shared server
- per-machine keys can represent a host but need administrative ownership and permission controls
- uninstall and reinstall behavior must be clear, especially if receipts must remain verifiable
- backup and restore can accidentally clone server identity if key movement is not deliberate
- migration from a dev key to a production key should create a new key ID and a clear trust transition

The public key or key ID must be discoverable by verifiers through trusted configuration, documentation, or a deployment-specific trust store. Embedding a generated key in an application bundle is usually not enough for production trust.

## Rotation and Revocation

Key IDs must remain verifiable for old receipts. Rotating a key should create a new key ID rather than silently replacing the key behind an existing identifier.

Verifiers need a way to know which public keys are trusted for which servers, users, organizations, time periods, or environments. Basic signature verification can confirm that a receipt matches a public key, but it cannot decide whether that public key should be trusted.

Revocation is a trust policy concern outside basic signature verification. Old receipts may remain cryptographically valid even if a key is later distrusted. A production deployment should decide how verifiers learn that a key was revoked, compromised, expired, or no longer authorized for new receipts.

## Verification Story

Basic verification needs:

- the receipt JSON
- the expected public key or a trust store that can resolve the key ID
- optional artifact bytes or content to recompute `artifact_hash`

No external registry is required for basic signature verification. A verifier can check the receipt signature if it already has the expected public key through a trusted channel.

Production deployments usually need more than basic signature verification. They need key discovery, trust policy, expected signer identity, environment scoping, rotation history, and revocation handling. Those concerns sit around the receipt verifier rather than inside the core signature check.

## Chaining

`previous_receipt_hash` and receipt chaining remain future-facing. Chaining may help establish ordering across paths, sessions, or related server events, but first integrations should not depend on chain semantics.

Early MCP server attestation work should focus on producing clear individual receipts for selected high-impact actions. If chaining is introduced later, it should be explicit about ordering guarantees, missing links, concurrency, retention, and verifier expectations.

## Non-Goals

This document does not define:

- a mandatory MCP adapter API
- a filesystem-mcp integration
- a key rotation protocol
- a compliance or audit system
- a policy engine
- a general log replacement

It also does not create an adapter, SDK, filesystem integration, production key manager, schema change, or verifier behavior change.

## Open Questions

- What should the exact MCP adapter API be?
- Where should host applications store signing keys?
- Should signing be per-user, per-server, or per-organization?
- How should clients pass caller, session, and correlation IDs?
- Should the default be fail open or fail closed?
- Should artifact hashes be required for mutating tools?
- How should desktop-packaged MCP servers be supported?
