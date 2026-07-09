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
    "artifact_hash": "sha256:example-full-result-artifact-digest",
    "artifact_hash_alg": "sha256",
    "runner_ref": "ci-runner://example-ci/linux-x64/pool/default",
    "environment_ref": "container://registry.example.org/bench-runner@sha256:example-image-digest",
    "publisher_ref": "https://benchmarks.example.org/publishers/example-team"
  },
  "signature": "base64-ed25519-signature",
  "public_key_id": "sha256:example-public-key-fingerprint"
}
```

This is a candidate claim shape, not a required profile. The fields `runner_ref`, `environment_ref`, and `publisher_ref` are optional references for correlation. Their presence does not prove runtime integrity, environment cleanliness, publication honesty, or authorization.

The producer and verifier must agree what bytes are hashed. A hash over the downloaded result file, including its exact JSON formatting, is simple and clear. A hash over a canonicalized form can also work if the artifact owner defines that canonicalization. BoundaryAttest should not silently invent benchmark-result canonicalization rules.

## Verification flow

A verifier receives:

- the result JSON artifact
- the receipt JSON
- the expected public key, or a trusted configuration path that yields it

The verifier then:

1. Checks the receipt signature using the expected public key.
2. Checks that `public_key_id` matches the expected public key identifier.
3. Recomputes the hash of the result JSON artifact using the agreed artifact hashing rules.
4. Checks that the recomputed hash equals `claim.artifact_hash`.
5. Separately decides whether it trusts the signer, benchmark method, benchmark implementation, run context, and published interpretation.

Passing these checks establishes only that the expected signer signed an unchanged claim binding that claim to the supplied artifact hash. It does not establish that the benchmark result is true, meaningful, authorized, or fairly described.

## Relationship to MCP and decision/action work

This example is not a replacement for MCP server or tool receipts. MCP receipts can describe tool calls, server-side execution claims, client observations, or cross-system action records.

This example is also not a replacement for decision/action binding. A decision/action receipt can bind a policy decision to a later action, block, escalation, or handoff.

The benchmark result receipt is narrower: it is an artifact-publication binding example. It shows how the broader generic signed-claim model can bind an externally published artifact to a signer, commit, run, and reference without requiring BoundaryAttest to own the artifact schema.

## Open questions

- Should the action type be `benchmark.result.published`, `eval.result.published`, or something more generic?
- Should both an aggregate-result hash and a full-artifact hash be supported?
- Are run-level receipts useful, or are they too noisy for benchmark suites with many cases?
- How should runner and environment references be represented without implying runtime integrity?
- How should public key discovery work for public benchmark sites?
