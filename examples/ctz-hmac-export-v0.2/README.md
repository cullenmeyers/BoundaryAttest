# CTZ HMAC export → BoundaryAttest v0.2 reference PoC

This is a BoundaryAttest-authored synthetic reference PoC against the pinned CHAOS TYPE ZERO (CTZ) native receipt format, built after the CTZ maintainer approved the experiment for review. It is not a merged integration, official CTZ support, CTZ adoption, a partnership, an endorsement, or production interoperability.

The CTZ semantics come from repository `vedchaos/chaos-type-zero`, commit `531d1796b312318f59bf241b8183718a3fcd2839`, path `bridge_core/receipts.py`. That upstream repository is not modified by this fixture.

## The bounded experiment

One synthetic dependency-review result leaves CTZ as the exact bytes of `artifact/report.md`. CTZ's native HMAC receipt is frozen as the exact bytes of `ctz-native-receipt.json`. A separate BoundaryAttest Interop Profile v0.2 `server_attested` claim, representing the synthetic export-adapter runtime rather than CTZ upstream, signs the SHA-256 digest of each frozen file. The adapter is attesting its own `ctz.evidence_exported` event; it is not independently attesting that the underlying CTZ tool action actually occurred.

The BoundaryAttest envelope contains only `claim`, `signature`, and `public_key_id`. Its claim has the required v0.2 fields and a signed `ctz_export` extension:

- `source`: pinned repository, commit, and source path
- `native_receipt`: CTZ receipt id, HMAC key id, filename, media type, `raw_bytes`, and SHA-256
- `artifact`: filename, media type, `raw_bytes`, and SHA-256
- `adapter`: narrow synthetic adapter identity and scope

The Ed25519 signature covers RFC 8785/JCS canonical bytes of `claim`. The expected public key is supplied independently from `boundaryattest-public-key.pem`; it is not accepted from the receipt.

## Exact representations

Both evidence digests are computed directly over bytes read from disk. The native receipt is not parsed and reserialized before hashing. The Markdown artifact is not canonicalized or interpreted. A trailing newline, whitespace change, or any other byte change changes the corresponding digest.

CTZ native signing is a different representation: the nested `receipt` body is serialized like Python `json.dumps(body, sort_keys=True, separators=(",", ":"))`, UTF-8 encoded, and HMAC-SHA256 signed as lowercase hex. The fixture reproduces CTZ's input/result hashing and `key-` plus the first 12 hex characters of SHA-256(secret) key-id derivation. The checked-in native sidecar uses CTZ's `json.dumps(full_receipt, indent=2)` export representation, including its lack of a trailing newline.

**TEST / FIXTURE ONLY — NEVER FOR PRODUCTION USE:** `TEST-ONLY-CTZ-HMAC-SECRET-DO-NOT-USE-IN-PRODUCTION` and `test-only-boundaryattest-private-key.pem` are public fixture material for deterministic regeneration only. No production key management is implemented or implied. A verifier possessing the shared HMAC secret can verify the native MAC, but possession of that same secret also gives that verifier the ability to create valid HMACs.

## Verify and regenerate

```sh
npm run build
npm run example:ctz-hmac-export-v0.2
npm run generate:ctz-hmac-export-v0.2
git diff --exit-code -- examples/ctz-hmac-export-v0.2
```

Native verification in `verify-native.ts` parses the CTZ receipt, compact-sorts the nested receipt body using the pinned semantics, recomputes HMAC-SHA256 with the fixture-only secret, and compares the result. This verifies native integrity within the shared-secret trust domain.

External verification in the separate `verify.ts` receives only the BoundaryAttest receipt, frozen CTZ receipt bytes, artifact bytes, and independently supplied expected Ed25519 public key. It verifies the strict v0.2 envelope/key id/JCS signature, then hashes each evidence file's raw bytes and compares those digests to the signed claim. Only after the native raw-byte digest matches does it parse the frozen receipt and correlate the signed claimed receipt ID and HMAC key ID with `receipt.receipt_id` and `receipt.signer.key_id`. Those metadata checks do not verify the native HMAC and do not treat its key ID as a trust root. The module does not import, need, or use the CTZ HMAC secret.

## Trust model

| Layer | Establishes | Does not establish |
|---|---|---|
| CTZ native HMAC receipt | Integrity/authentication inside a trust domain whose verifiers possess the HMAC secret | Which secret-holder created it; truth, authorization, or uncompromised execution |
| BoundaryAttest export attestation | The expected export key signed an unchanged claim binding the two exact frozen byte sequences | That CTZ created a truthful receipt, that the action happened, or that the artifact is correct |
| Combined fixture | A publicly verifiable export-boundary statement over evidence that can also be checked natively by a secret-holder | Complete history, absence of other actions/receipts, production custody/adoption, or CTZ operation of the Ed25519 signer |

Neither layer proves the underlying CTZ action happened, the CTZ runtime was uncompromised, the native receipt was truthful when created, the action was authorized, the artifact is semantically correct, history is complete, no other receipts/actions existed, production key custody, production adoption, or endorsement. No legal or broad cryptographic non-repudiation claim is made.

## Why this isn't duplicate signing

BoundaryAttest does not replace or re-sign the semantic truth of CTZ execution. It signs a separate export-boundary claim over frozen evidence bytes for a recipient who may not share CTZ's symmetric signing secret.

- If the external recipient is **not** given the CTZ HMAC secret, BoundaryAttest adds a distinct property: an external verifier can verify the expected BoundaryAttest export signer's Ed25519 claim using only the public key, without receiving private signing authority.
- If the recipient is intentionally trusted with the CTZ HMAC secret and accepts shared signing authority, BoundaryAttest may be largely redundant for signature-verification purposes. It should not be added merely because another signature is possible.

## Negative vectors

The focused automated tests cover a matching fixture, artifact-byte tamper, frozen-receipt-byte tamper, claimed CTZ receipt-ID mismatch, claimed CTZ HMAC-key-ID mismatch, signed-claim tamper, wrong independently supplied Ed25519 public key, and native receipt-body tamper. Failures are explicit: `artifact_digest_mismatch`, `native_receipt_digest_mismatch`, `native_receipt_id_mismatch`, `native_hmac_key_id_mismatch`, `invalid_signature`, `public_key_id_mismatch`, or failed native HMAC verification.

## Pinned README discrepancy

The pinned CTZ README example does not exactly match the pinned implementation. `bridge_core/receipts.py` emits a top-level `version` and nests `key_id` and `algorithm` under `receipt.signer`; the README example shows a different shape, including a top-level `signer_key_id`. This fixture deliberately follows `bridge_core/receipts.py`. It does not alter or “fix” CTZ's format.
