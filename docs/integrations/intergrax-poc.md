# Intergrax PoC Integration Proof

This document records the completed AgentReceipt proof of concept for the Intergrax `attestation_demo` handoff.

## Integration Flow

The example adapter in `examples/intergrax-poc` posts the sanitized request fixture to an Intergrax `attestation_demo` runtime, reads and orders `boundary_events[]` from the response, accepts only `execution_boundary_event.v1`, and maps each event into its own AgentReceipt receipt. For every event it writes both:

- a local signed receipt under `receipts/`
- an Intergrax evidence sidecar next to the receipt

Generated receipts, sidecars, traces, local signing keys, and temporary test folders are intentionally ignored by git. The committed fixtures are sanitized examples only.

## Live Result

PoC v2 defines two claims for a successful run: a `records.put` `tool_execution` event followed by a `harness_step` event. The local AgentReceipt adapter writes and independently verifies two receipts:

```text
verification: valid
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

AgentReceipt recomputes those hashes with its canonical hashing and reports both as `match`.

## Lineage And Journal Correlation

Each Intergrax event supplies `run_id`, `step_id`, and a distinct `lineage.ref`. AgentReceipt maps that lineage into each receipt, while metadata/evidence preserves the grouping fields and boundary type.

```text
lineage_ref: run_<dynamic>:store_demo_record
lineage_type: execution_record
```

The failed-tool fixture also remains two claims: a `failed` tool receipt and a valid completed-harness receipt. Harness `completed` maps to AgentReceipt's existing `success` status, with the original `completed` value preserved in metadata. A null harness `tool_id` maps to `intergrax.harness_step`; no core schema change is needed.

The shared `run_id` and `step_id`, plus each event's `lineage.ref`, correlate receipts and evidence sidecars with the Intergrax journal for the run. The journal remains the Intergrax-side operational record; each AgentReceipt receipt is a portable local record that the adapter observed and signed for one boundary event.

## What The Receipt Proves

The receipt proves that this local AgentReceipt adapter received a specific Intergrax boundary event payload, hashed the received input and output, signed the resulting receipt with the local AgentReceipt key, verified the signature as valid, and linked the receipt into the local receipt chain.

It also proves that the AgentReceipt canonical input and output hashes match the hashes Intergrax included in the observed event.

## What It Does Not Prove

The receipt does not prove the business correctness of the action, that the action was authorized, that the surrounding Intergrax runtime was secure, or that the Intergrax journal is complete.

The PoC event is unsigned by Intergrax (`signed: false`). AgentReceipt records that fact in tool metadata as `intergrax_signed: false`.

## Why This Is Not Server Attestation

This proof is `client_observed`, not `server_attested`.

AgentReceipt signs what the adapter observed after receiving the Intergrax event. Intergrax did not cryptographically sign or attest the event with a server key that AgentReceipt verifies. Treating this as `server_attested` would overstate the trust model.

Server attestation would require Intergrax, or another trusted server-side runtime, to sign the execution fact with its own key and expose a verification path for that server signature.
