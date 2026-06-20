# Intergrax PoC Integration

This document records the BoundaryAttest PoC integration with Intergrax `attestation_demo`, including EBE-9 host-side event signing. It is a small verifier with one pinned demo public key, not a production integration or key-management system. BoundaryAttest was previously called AgentReceipt during early PoC work.

## Integration Flow

The example adapter in `examples/intergrax-poc` posts the sanitized request fixture to an Intergrax `attestation_demo` runtime, reads and orders `boundary_events[]` from the response, accepts only `execution_boundary_event.v1`, and maps each event into its own BoundaryAttest receipt. It creates one receipt per boundary event and no composite run receipt. When `signed: true`, the adapter first verifies the EBE-9 host-attestation envelope with the pinned `attestation-demo-host-1` Ed25519 public key. A failed host verification rejects the event before receipt creation. When `signed: false` and `host_attestation: null`, the existing unsigned v2 flow remains supported.

For every accepted boundary event it writes both:

- a local signed receipt under `receipts/`
- an Intergrax evidence sidecar next to the receipt

Generated receipts, sidecars, traces, local signing keys, and temporary test folders are intentionally ignored by git. The committed fixtures are sanitized examples only.

## Live Result

PoC v2 defines two claims for a successful run: a `records.put` `tool_execution` event followed by a `harness_step` event. EBE-9 signs each event separately; there is no composite run signature. The local BoundaryAttest adapter verifies each host signature, then writes and independently verifies separate `client_observed` receipts. BoundaryAttest signs what its client observed and ingested:

```text
verification: valid
host_attestation: verified
receiptRole: client_observed
boundary_type: tool_execution, harness_step
event_sequence: 1, 2
run_id: run_<dynamic>
step_id: store_demo_record
input hash: match
output hash: match
```

The public fixtures use stable sanitized event identifiers and keep comparable hashes from the deterministic sample payloads. `event_id` is stored as the source event/evidence key, and `event_sequence` preserves ordering within the run.

```text
input_hash: sha256:abcbed6ef04e1fa9d538c02d19dd08a0f6cea55967f87fbf0b6fa84812bd97e3
output_hash: sha256:0523e7f40600893a2eed408f2c2624ca0d6c528b761a3f20641eadd1c77cba46
```

BoundaryAttest recomputes those hashes with its canonical hashing and reports both as `match`.

## Lineage And Journal Correlation

Each Intergrax event supplies `run_id`, `step_id`, and a distinct `lineage.ref`. BoundaryAttest maps that lineage into each receipt, while metadata/evidence preserves the grouping fields and boundary type.

```text
lineage_ref: run_<dynamic>:store_demo_record
lineage_type: execution_record
```

The failed-tool fixture also remains two claims: a `failed` tool receipt and a valid completed-harness receipt. Harness `completed` maps to BoundaryAttest's existing `success` status, with the original `completed` value preserved in metadata. A null harness `tool_id` maps to `intergrax.harness_step`; no core schema change is needed.

The shared `run_id` and `step_id`, plus each event's `lineage.ref`, correlate receipts and evidence sidecars with the Intergrax journal for the run. This per-event data comes from `boundary_events[]`. The Intergrax trace endpoint is run/task-level, not per-event, and is not the source of per-event correlation. The journal remains the Intergrax-side operational record; each BoundaryAttest receipt is a portable attestation that the adapter observed and signed for one boundary event.

## EBE-9 Verification

The generic verifier reconstructs the complete unsigned event by removing `host_attestation` and normalizing `signed` to `false`. It serializes the event as sorted-key, compact UTF-8 JSON, computes the prefixed SHA-256 digest, rebuilds the six-field host-attestation statement, and verifies its Ed25519 signature. It rejects digest mismatches, invalid signatures, unknown key IDs, unsupported algorithms, missing envelopes, and malformed envelopes.

The committed Intergrax golden vector pins the expected event digest and canonical statement bytes. The Intergrax-specific adapter supplies the event extraction and pinned demo key; the core host-attestation verifier does not depend on the Intergrax event schema.

## What The Two Signatures Attest

The Intergrax host signature is a host/runtime claim over one canonical boundary event. The BoundaryAttest receipt signature is a separate local `client_observed` wrapper and ingestion claim over what this adapter received. BoundaryAttest does not relabel its receipt signature as the host signature.

The receipt is a signed claim that this local BoundaryAttest adapter received a specific Intergrax boundary event payload and hashed the received input and output. Local verification checks the BoundaryAttest signature and link into the local receipt chain.

The comparison also checks that the BoundaryAttest canonical input and output hashes match the hashes Intergrax included in the observed event.

## What It Does Not Prove

Neither signature proves that the event is true, that the action was authorized, that the host/runtime was uncompromised, or that a claimed business outcome occurred. They also do not prove business correctness or that the Intergrax journal is complete.

## Why This Is Not Server Attestation

The BoundaryAttest wrapper remains `client_observed`, not `server_attested`, even after a valid EBE-9 host signature is verified.

BoundaryAttest signs what the adapter observed after receiving the Intergrax event. EBE-9's distinct Intergrax signature is recorded as a verified host/runtime claim when present. Collapsing those trust boundaries or treating either signature as proof of the non-claims above would overstate this PoC.
