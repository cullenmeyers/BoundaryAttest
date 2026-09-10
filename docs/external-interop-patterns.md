# External interop patterns

## Why this page exists

BoundaryAttest is experimental and is not a standard. This page indexes external implementations, integration examples, and repository examples that have exercised its portable signed-claim model. It is a starting point for maintainers evaluating what has actually been tried, where strict interoperability ends, and which checks remain the integrating system's responsibility.

## Pattern 1: source/provenance claim receipt

[ckg-agentforce](https://github.com/Yarmoluk/ckg-agentforce) is an external implementation whose `verify_source(concept, receipt=True)` option emits a BoundaryAttest-style signed receipt for a source/provenance claim. The repository includes a [mapping note](ckg-agentforce-boundaryattest-mapping-v0.1-draft.md) and [runnable fixtures](../examples/ckg-agentforce-verify-source-v0.1/).

This validates source verification as a useful receipt seam, but the external envelope is not strictly compatible with Interop Profile v0.1. ckg-agentforce includes a top-level `public_key` convenience field and fingerprints raw Ed25519 key bytes. The strict BoundaryAttest envelope keeps only `claim`, `signature`, and `public_key_id`, and derives the key ID from SPKI DER bytes. Translation therefore requires explicit normalization and re-signing; the strict verifier is not relaxed.

## Pattern 2: export/import artifact handoff receipt

[agentenv](https://github.com/css521/agentenv) has an external integration example at `examples/boundaryattest-export/` (commit [`7110a264332509b8601c7090a9a80409f38ff9d3`](https://github.com/css521/agentenv/commit/7110a264332509b8601c7090a9a80409f38ff9d3)). It uses BoundaryAttest's Python interop example as a pinned compatibility checkout and gates import on:

- strict receipt verification against an expected public key;
- `server_attested`, action, status, and export-kind policy checks;
- SHA-256 recomputation over the exact received bundle bytes; and
- importing the same private staged bytes that were hashed.

The division of responsibility matters: BoundaryAttest proves expected-key possession and signed-claim integrity. The agentenv adapter owns claim policy, artifact binding, staging, and import gating. This is an external integration example, not a partnership, endorsement, or production-deployment claim.

## Pattern 3: Causly server-attested workflow receipts

[Causly Server PR #10](https://github.com/KNIHAL/causly-server/pull/10) is a real upstream-merged, optional BoundaryAttest Interop v0.2 `server_attested` integration. It is off by default and covers selected Causly workflow operations rather than every tool. The Causly runtime/operator controls the Ed25519 signing key, and the integration uses RFC 8785/JCS with the strict v0.2 envelope. Receipt failures do not change the underlying tool outcome.

The integration remains experimental. It does not establish runtime integrity, independent truth, production-grade key custody, universal Causly support, partnership, endorsement, or production deployment.

## Pattern 4: Python-native arbitrary digest signing

The [Python interop example](../examples/python-interop-v0.1/) signs arbitrary host-provided artifact or action digests plus structured metadata. It emits the strict Interop Profile v0.1 envelope—`claim`, `signature`, and `public_key_id`—and requires Python's `cryptography` package. Its checked-in keys are demo-only, and its documented cross-language canonicalization limits are part of the example's compatibility boundary.

## Pattern 5: benchmark/eval result artifact receipt

The [benchmark/eval design note](benchmark-result-receipt-example.md) and [public-artifact example](../examples/benchmark-result-public-v0.1/) show a receipt binding a benchmark or eval artifact hash and signed metadata. That binding does not establish that the benchmark is correct, fair, representative, or complete.

Where reproducibility requires both views, a producer can record a hash of the exact raw artifact bytes and a separate hash of a documented public canonical artifact. The producer must define which bytes and canonicalization each digest covers; this does not change BoundaryAttest's signed-claim canonicalization.

## Pattern 6: x402 authorization-linked receipt

The [draft x402 authorization-linked receipt profile](x402-authorization-linked-receipt-v0.1-draft.md) and [synthetic fixtures](../examples/x402-authorization-linked-receipt-v0.1/) show how an optional signed `authorization_ref` can bind a BoundaryAttest action/result receipt to a separate authorization artifact by digest. Authorization identity, cap, purpose, expiry, validity, and payment settlement remain external checks; the pattern does not change the Interop v0.1 schema or verifier.

## Pattern 7: exported gate decision and asynchronous run result

The [exported gate decision and run result design note](exported-gate-and-run-result-profile-v0.1-draft.md) narrows receipts to two trust-boundary seams: exported gate decisions and asynchronous result handoffs. Its signed claims carry an explicit draft profile version and self-describing digest bindings; an exported gate decision binds both the request and exact response body. It distinguishes portable public-key receipts from shared-secret webhook delivery signatures and explicitly excludes same-boundary gate calls, RBAC restatements, and generic high-volume tool-call receipts. It is a design note only and does not change the Interop v0.1 schema.

## Pattern 8: Pragma bundle export receipt

The [Pragma bundle export receipt draft](pragma-bundle-export-receipt-v0.1-draft.md) and [synthetic fixture](../examples/pragma-bundle-export-receipt-v0.1/) show an external signed claim over Pragma-computed bundle, project, root, and export metadata values. Pragma remains responsible for validating the `.pragma` bundle's internal structure and content; BoundaryAttest verifies only the surrounding claim, and a relying verifier compares its fields with values from Pragma's normal verification path. This docs/examples-only pattern is not an integration, endorsement, or statement of Pragma support.

## What these patterns have in common

- A small signed claim crosses a system or trust boundary.
- The expected public key comes from trusted verifier configuration, not from an untrusted receipt alone.
- Artifact consumers recompute digests over the exact bytes they will use.
- Domain semantics and accept/reject policy stay with the adapter or relying party.
- Strict envelope and key-ID rules remain stable even when an external producer uses a nearby experimental shape.

Additional [TrustMCP](../examples/trustmcp-post-scan-receipt/), [FAF](../examples/faf-mcp-handoff-v0.1/), and [Airflow](../examples/airflow-report-receipt/) examples explore related handoff and post-action receipt seams; they are experimental examples, not adoption claims.

The [synthetic SCRIBE report example](../examples/openclaw-scribe-report-v0.1/) narrows the SOC use case to the external handoff of an exact report artifact. Internal SOC logs remain authoritative inside the trust domain, lineage is represented only by reference hashes, and RESPONDER is explicitly optional. This is a docs/examples-only pattern, not an OpenClaw, Wazuh, or OpenCTI integration or endorsement.

## What BoundaryAttest does not prove

A passing signature check proves only that the corresponding expected key signed the unchanged claim. It does not prove truth, authorization, safety, compliance, signer trustworthiness, key custody, runtime integrity, artifact correctness, freshness, completeness, or downstream state. Relying parties must separately define signer trust, semantic policy, replay/freshness rules, artifact retrieval and digest checks, and the action taken after verification.

## Where to start

1. Read [Interop Profile v0.1](interop-profile-v0.1.md) and its [verification limits](interop-verification-limits-v0.1.md).
2. Run the [Interop v0.1 vectors](../examples/interop-v0.1/) to understand the strict envelope and failure cases.
3. Use the [Python interop example](../examples/python-interop-v0.1/) for a minimal cross-language signer/verifier or the [adapter guide](interop-adapter-guide-v0.1.md) for a dependency-free implementation path.
4. Choose the closest pattern above, then document the adapter-owned semantic and artifact checks explicitly.
