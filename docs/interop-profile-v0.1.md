# BoundaryAttest Interop Profile v0.1

Status: experimental compatibility target. This is not a final standard.

This profile defines a small portable envelope that external adapters can emit and independent verifiers can check. It does not replace BoundaryAttest's existing native receipt shape or the proof-kit examples. A compatible receipt is a portable signed claim: it shows that a particular key signed the included claim and that the signed claim has not changed. It does not prove truth, authorization, compliance, signer trustworthiness, runtime integrity, or business outcome.

Existing BoundaryAttest runtime and proof-kit receipts are flat JSON objects: their claim fields, `public_key_id`, and `signature` are siblings. Interop Profile v0.1 receipts instead use the `claim` envelope below and sign exactly that nested object. The profile is a separate adapter compatibility target; it does not invalidate existing receipts or make them malformed. The proof kit also uses a demo-specific key label rather than the v0.1 key-ID convention.

## Receipt shape

A v0.1 receipt is a JSON object with these required top-level fields:

- `claim`: the JSON object covered by the signature
- `signature`: the base64-encoded Ed25519 signature over the canonical claim
- `public_key_id`: the identifier of the expected signing public key

The `claim` object has these required fields:

- `receipt_version`: exactly `"0.1"` for this profile
- `receipt_role`: `client_observed` or `server_attested`
- `event_id`: an adapter- or source-assigned event identifier
- `timestamp`: the event time, normally an RFC 3339/ISO 8601 string
- `action_type`: the adapter's stable name for the action
- `status`: the adapter's status for the action

The profile requires these fields to be present but deliberately does not define universal vocabularies for `action_type` or `status`.

The following claim fields are strongly recommended:

- `target_ref`
- `artifact_hash`, or another clearly named object/content hash when there is an artifact
- `trace_ref` or `lineage_ref` when available

The following claim fields are optional:

- `tool_name`
- `session_id`
- `task_id`
- `git_ref`
- `input_hash`
- `output_hash`
- `error_hash`
- `previous_receipt_hash`
- adapter-specific fields

Adapter-specific fields belong inside `claim` so they are signed. Verifiers may ignore claim fields they do not understand. An adapter may retain any local event shape it needs as long as it can map that event into this portable receipt shape.

`previous_receipt_hash` is optional and future-facing unless the producer maintains a real chain. Its presence alone does not establish a complete or correctly ordered history.

`client_observed` means the signer claims what a client observed sending and receiving. It is not a claim from the executing host. `server_attested` means the executing host or runtime signs what it claims happened. Neither role makes the claim true by itself; their value depends on the signer, key custody, runtime, and relying party's trust decision.

Example envelope:

```json
{
  "claim": {
    "receipt_version": "0.1",
    "receipt_role": "client_observed",
    "event_id": "evt_demo_001",
    "timestamp": "2026-06-26T12:00:00.000Z",
    "action_type": "mcp.filesystem.write_file",
    "status": "success",
    "target_ref": "file:///workspace/demo.txt",
    "artifact_hash": "sha256:2a2b12fac0255b18b17bb813d98119f80561c49cee411af3ce27e344bed32023"
  },
  "signature": "base64-ed25519-signature",
  "public_key_id": "sha256:d795438daa66a97f5deb0886"
}
```

## Canonical claim and signature

v0.1 uses the repository's existing `stableJson` behavior, not RFC 8785/JCS:

1. Canonicalize exactly the value of the top-level `claim` field. Do not include `signature`, `public_key_id`, or any other envelope field.
2. Encode JSON primitives compactly as JSON, preserve array order, and recursively sort object member names with the current JavaScript comparator `a.localeCompare(b)`, with no insignificant whitespace.
3. Encode the resulting canonical JSON string as UTF-8.
4. Create or verify an Ed25519 signature over those bytes. The signature field is standard base64.

The defined field names are lowercase ASCII `snake_case`. Adapter-specific field names should follow the same convention to reduce locale-ordering differences across implementations. Implementers should use the included valid vector to confirm their canonicalization matches BoundaryAttest before exchanging receipts. The locale-based comparator is an experimental v0.1 compatibility constraint, not a claim of language-neutral canonical JSON.

## Verifier expectations

A v0.1 verifier must:

1. Parse the receipt as JSON.
2. Confirm the required top-level fields exist.
3. Confirm the required claim fields exist.
4. Reject unsupported `receipt_version` values.
5. Canonicalize exactly the `claim` object as described above.
6. Verify the signature over the canonical claim.
7. Calculate the identifier of the expected public key and confirm it equals `public_key_id`.

The expected public key must come from the verifier or its caller. A key supplied beside an untrusted receipt is not a trust decision by itself.

These are policy-layer checks, not mandatory v0.1 cryptographic checks:

- timestamp freshness
- key revocation
- signer trust
- authorization, grant, or policy validity
- artifact availability
- replay or reconstruction sufficiency

Passing v0.1 verification means only that the envelope is structurally compatible, the expected key identifier matches, and the expected key signed the unchanged claim.

## Key convention

The convention matches the current local BoundaryAttest implementation:

- Algorithm: Ed25519.
- Public key: PEM-encoded SubjectPublicKeyInfo (SPKI), including the normal `BEGIN PUBLIC KEY` and `END PUBLIC KEY` lines.
- Private key for development and tests only: PEM-encoded PKCS #8, including the normal `BEGIN PRIVATE KEY` and `END PRIVATE KEY` lines.
- `public_key_id`: SHA-256 of the exact UTF-8 public-key PEM text, take the first 24 lowercase hexadecimal characters, then prefix them with `sha256:`. The trailing newline is part of the PEM text used by the current implementation.

In pseudocode:

```text
public_key_id = "sha256:" + hex(sha256(utf8(public_key_pem)))[0:24]
```

The identifier is a compact key fingerprint, not a registry lookup or proof that a signer should be trusted. Production key custody should use organization-managed keys or an appropriate KMS/HSM rather than the repository's local development key files.

## Test vectors

Static vectors are in [`examples/interop-v0.1/test-vectors/`](../examples/interop-v0.1/test-vectors/). They cover a valid receipt, a tampered claim, the wrong public key, an unsupported version, and a missing required field.

Run them with:

```sh
npm run build
npm run example:interop-v0.1
```
