# Benchmark/eval result receipt example

Status: docs-only illustrative example. This document is not a standard, does not define a schema, does not create a required profile, and is not part of the stable BoundaryAttest Interop Profile v0.1.

## Purpose

A benchmark or eval system may already emit result JSON that leaves the runtime and gets published, emailed, archived, or handed to another team. BoundaryAttest can sign a claim binding a commit, run, or external reference to the hash of that result artifact.

This lets a verifier later check that a specific signer signed a claim about a specific externally supplied benchmark result artifact, without requiring BoundaryAttest to own the benchmark's data model.

## Core boundary

Receipts are useful when the verifier does not trust the originating runtime or when an artifact crosses a boundary between teams, systems, organizations, archives, or publication channels. Inside one trust domain, local logs, job metadata, or the benchmark system's own audit trail may be enough.

The receipt is a portable integrity and attribution wrapper around a signed claim. It is not a substitute for deciding whether the benchmark, runtime, publication process, or signer should be trusted.

## Important non-goal

The receipt does not prove that:

- the benchmark is fair
- the benchmark is representative
- the benchmark implementation is correct
- the model result is accurate
- the runtime was uncompromised
- the run was authorized
- the published interpretation is honest

It only proves that a specific signer signed a specific claim and that the signed claim has not been altered.

## Artifact-owned schema

The benchmark result JSON remains owned by the project that produces it. BoundaryAttest should not define or chase every benchmark or eval schema.

For example, a project-owned result artifact might look like this:

```json
{
  "config": {
    "model": "example-model",
    "suite": "cross_framework",
    "reps": 1,
    "max_turns": 10
  },
  "agg": {
    "framework": "example-framework",
    "runs": 28,
    "success_rate": 100.0,
    "avg_tokens": 1424,
    "avg_cost_usd": 0.0019,
    "avg_turns": 2,
    "avg_latency_s": 2.49
  },
  "runs": [
    {
      "task": "speed",
      "rep": 0,
      "ok": true,
      "tokens": 1377,
      "input_tokens": 1286,
      "output_tokens": 91,
      "cost": 0.001741,
      "turns": 2,
      "latency_s": 7.35,
      "success": true,
      "summary": "40"
    }
  ]
}
```

This shape is illustrative only. It is not normative, not a BoundaryAttest schema, and not a recommendation that benchmark producers use these field names.

## Dual artifact hashes

Benchmark/eval receipts may carry two artifact hashes because the hashes answer different questions:

- `full_artifact_hash`: SHA-256 over the exact raw result artifact bytes. It answers: "these exact bytes existed."
- `public_canonical_artifact_hash`: SHA-256 over a documented, normalized public representation. It answers: "this public artifact is reproducibly checkable by an external verifier."

The full artifact and public artifact may be the same input, but they do not have to be. Keeping the meanings distinct avoids quietly turning `artifact_hash` into "the hash after removing whatever is inconvenient." A project may use either hash or both, but it should name the selected semantics explicitly.

Some benchmark or eval result JSON may contain volatile machine-local fields such as local key paths, output paths, temp directories, absolute runner paths, or other environment-specific references. Hashing the raw bytes of an internal result file can make external reproduction difficult when the public artifact intentionally redacts or omits those fields.

For those cases, a project may define a canonical public artifact representation. This is artifact-level canonicalization only. It is separate from BoundaryAttest's signed-claim canonicalization and does not change signature behavior, verifier behavior, interop profile semantics, schemas, or the canonicalization of signed claims.

If a project uses dual hashes, the receipt claim might describe them with fields such as:

- `full_artifact_hash_alg`, such as `"sha256"`
- `public_canonical_artifact_hash_alg`, such as `"sha256"`
- `public_canonical_artifact_hash_semantics`, such as `"canonical-json"`
- `artifact_canonicalization`, such as `"benchmark-result-public-v0.1"`
- `artifact_canonicalization_ref`, optional
- `canonicalization_notes`, optional

A benchmark/eval canonicalization profile should be deterministic, documented, versioned, reproducible by an external verifier, scoped to the project or profile, explicit about excluded or normalized fields, and careful not to hide material evidence.

For example, a benchmark artifact might contain volatile fields:

```json
{
  "config": {
    "model": "example-model",
    "suite": "cross_framework",
    "key_file": "/local/path/redacted",
    "out": "/local/output/path"
  },
  "agg": {
    "success_rate": 100.0
  },
  "runs": []
}
```

A project-specific canonical representation might remove or normalize `config.key_file` and `config.out` before hashing:

```json
{
  "config": {
    "model": "example-model",
    "suite": "cross_framework"
  },
  "agg": {
    "success_rate": 100.0
  },
  "runs": []
}
```

This is illustrative only, not a BoundaryAttest-wide rule. A different project might retain those fields, replace them with stable labels, hash them separately, or disclose them through separate evidence references.

Do not use canonicalization to make inconvenient data disappear. If omitted fields matter to the claim, they should be retained, hashed separately, or disclosed through separate evidence references.

## Signature binds both hashes

If both hashes are used, both hash fields and their semantics must be inside the signed claim. The signature should bind:

- `full_artifact_hash`
- `full_artifact_hash_alg`
- `public_canonical_artifact_hash`
- `public_canonical_artifact_hash_alg`
- `public_canonical_artifact_hash_semantics`
- `artifact_canonicalization`
- `artifact_canonicalization_ref`, if used

This prevents someone from keeping a valid signature while swapping which representation the claim points to or changing how a verifier is instructed to interpret a digest.

## Floating-point canonicalization warning

Canonical JSON for benchmark/eval artifacts is not only about sorted keys and whitespace. Benchmark artifacts often contain floating-point metrics such as `avg_cost_usd`, `avg_latency_s`, and `success_rate`.

Different languages or JSON libraries may serialize the same intended numeric value differently through trailing zeros, scientific notation, precision or last-digit rounding, binary floating-point representation, and integer-looking decimals. Without pinned number formatting, two honest verifiers may compute different canonical hashes.

## Number formatting is part of the canonicalization profile

A benchmark/eval canonicalization profile must define number handling explicitly. Acceptable approaches may include:

- fixed decimal places per field
- decimal strings in public canonical artifacts
- integer minor units where possible, such as cost in micros or latency in milliseconds
- a named standard canonical JSON scheme if the project adopts one
- field-specific normalization rules documented in the canonicalization profile

This example does not require one approach globally. The chosen rules belong to the artifact owner's documented, versioned canonicalization profile, not to BoundaryAttest's signed-claim canonicalization.

### Illustrative profile: `benchmark-result-public-v0.1`

An illustrative project profile could require the following:

- remove or normalize `config.key_file`
- remove or normalize `config.out`
- sort object keys
- encode as UTF-8
- remove insignificant whitespace
- format known metric fields deterministically:
  - `success_rate` as a decimal string with one fixed decimal place, for example `"100.0"`
  - `avg_cost_usd` as a decimal string with four fixed decimal places, for example `"0.0019"`
  - `avg_latency_s` as a decimal string with two fixed decimal places, for example `"2.49"`
  - `avg_tokens` and `runs` as integers
- reject or explicitly handle `NaN`, `Infinity`, and `-0`

The profile would also need to define rounding and behavior for missing, null, or out-of-range values. This profile is illustrative only; it is not a BoundaryAttest-wide rule or a required interop profile.

## Candidate BoundaryAttest claim

A producer could publish the result artifact separately, hash the exact bytes or agreed canonical representation of that artifact, and sign a claim that points to the hash:

```json
{
  "claim": {
    "receipt_version": "0.1",
    "receipt_role": "server_attested",
    "event_id": "bench_pub_2026_07_09_001",
    "timestamp": "2026-07-09T18:00:00.000Z",
    "action_type": "benchmark.result.published",
    "status": "success",
    "benchmark_suite": "cross_framework",
    "commit_ref": "git:example-org/example-repo@9f86d081884c7d659a2feaa0c55ad015",
    "run_ref": "ci://example-ci/runs/123456",
    "result_artifact_ref": "https://benchmarks.example.org/results/123456.json",
    "full_artifact_hash": "sha256:example-full-result-artifact-digest",
    "full_artifact_hash_alg": "sha256",
    "public_canonical_artifact_hash": "sha256:example-public-canonical-artifact-digest",
    "public_canonical_artifact_hash_alg": "sha256",
    "public_canonical_artifact_hash_semantics": "canonical-json",
    "artifact_canonicalization": "benchmark-result-public-v0.1",
    "artifact_canonicalization_ref": "https://benchmarks.example.org/canonicalization/benchmark-result-public-v0.1",
    "canonicalization_notes": "Machine-local key and output paths are normalized; metric formatting is pinned by the referenced profile.",
    "runner_ref": "ci-runner://example-ci/linux-x64/pool/default",
    "environment_ref": "container://registry.example.org/bench-runner@sha256:example-image-digest",
    "publisher_ref": "https://benchmarks.example.org/publishers/example-team"
  },
  "signature": "base64-ed25519-signature",
  "public_key_id": "sha256:example-public-key-fingerprint"
}
```

This is a candidate claim shape, not a required profile. The fields `runner_ref`, `environment_ref`, and `publisher_ref` are optional references for correlation. Their presence does not prove runtime integrity, environment cleanliness, publication honesty, or authorization.

The producer and verifier must agree what bytes each digest covers. A hash over the exact result file, including its JSON formatting, is simple and clear. A second hash over a canonicalized public form can support reproducible external checking if the artifact owner defines that canonicalization. BoundaryAttest should not silently invent benchmark-result canonicalization rules.

## Verification flow

A verifier receives:

- the result JSON artifact
- the receipt JSON
- the expected public key, or a trusted configuration path that yields it

The verifier then:

1. Checks the receipt signature using the expected public key.
2. Checks that `public_key_id` matches the expected public key identifier.
3. Recomputes each applicable hash using the agreed artifact hashing rules.
4. Checks each recomputed hash against its corresponding field in the signed claim.
5. Separately decides whether it trusts the signer, benchmark method, benchmark implementation, run context, and published interpretation.

Passing these checks establishes only that the expected signer signed an unchanged claim binding that claim to the supplied artifact hash. It does not establish that the benchmark result is true, meaningful, authorized, or fairly described.

## Verification flow for raw and canonical artifact hashes

When one or both artifact hashes are present, the artifact-level flow is:

1. The verifier obtains the raw artifact and/or public artifact.
2. If the raw bytes are available, the verifier computes SHA-256 over those exact bytes and compares it with signed `claim.full_artifact_hash`.
3. If `public_canonical_artifact_hash` is used, the verifier applies the named `artifact_canonicalization` profile to the public artifact.
4. The verifier applies the profile's pinned number-formatting rules.
5. The verifier serializes the normalized public representation deterministically, including the profile's key ordering, whitespace, and UTF-8 rules.
6. The verifier computes SHA-256 over those canonical bytes.
7. The verifier compares the digest with signed `claim.public_canonical_artifact_hash`.
8. The verifier separately decides whether the canonicalization omitted material evidence.

These steps are about the artifact hash only. They do not alter BoundaryAttest claim canonicalization, receipt signature verification, or interop behavior.

## Relationship to MCP and decision/action work

This example is not a replacement for MCP server or tool receipts. MCP receipts can describe tool calls, server-side execution claims, client observations, or cross-system action records.

This example is also not a replacement for decision/action binding. A decision/action receipt can bind a policy decision to a later action, block, escalation, or handoff.

The benchmark result receipt is narrower: it is an artifact-publication binding example. It shows how the broader generic signed-claim model can bind an externally published artifact to a signer, commit, run, and reference without requiring BoundaryAttest to own the artifact schema.

## Open questions

- Should the action type be `benchmark.result.published`, `eval.result.published`, or something more generic?
- Should benchmark/eval examples prefer raw hash only, canonical hash only, or dual hash by default?
- Should metrics be represented as strings in public canonical artifacts?
- Should canonicalization profiles reject floats entirely and require decimal strings or integer units?
- Should run-level receipts carry separate hashes or remain inside the full artifact hash?
- Should both an aggregate-result hash and a full-artifact hash be supported?
- How should runner and environment references be represented without implying runtime integrity?
- How should public key discovery work for public benchmark sites?
- How should canonicalization profiles reference standards without forcing them into BoundaryAttest core?
