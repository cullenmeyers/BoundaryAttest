# Intergrax PoC Integration

This document records the live BoundaryAttest PoC v2 with Intergrax for the `attestation_demo` handoff. It validates client-observed mapping; it is not a production integration. BoundaryAttest was previously called AgentReceipt during early PoC work.

## Integration Flow

The example adapter in `examples/intergrax-poc` posts the sanitized request fixture to an Intergrax `attestation_demo` runtime, reads and orders `boundary_events[]` from the response, accepts only `execution_boundary_event.v1`, and maps each event into its own BoundaryAttest receipt. It creates one receipt per boundary event and no composite run receipt. For every boundary event it writes both:

- a local signed receipt under `receipts/`
- an Intergrax evidence sidecar next to the receipt

Generated receipts, sidecars, traces, local signing keys, and temporary test folders are intentionally ignored by git. The committed fixtures are sanitized examples only.

## Live Result

PoC v2 defines two claims for a successful run: a `records.put` `tool_execution` event followed by a `harness_step` event. The local BoundaryAttest adapter writes and independently verifies separate `client_observed` receipts for those two boundary events. BoundaryAttest signs what its client observed:

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

BoundaryAttest recomputes those hashes with its canonical hashing and reports both as `match`.

## Lineage And Journal Correlation

Each Intergrax event supplies `run_id`, `step_id`, and a distinct `lineage.ref`. BoundaryAttest maps that lineage into each receipt, while metadata/evidence preserves the grouping fields and boundary type.

```text
lineage_ref: run_<dynamic>:store_demo_record
lineage_type: execution_record
```

The failed-tool fixture also remains two claims: a `failed` tool receipt and a valid completed-harness receipt. Harness `completed` maps to BoundaryAttest's existing `success` status, with the original `completed` value preserved in metadata. A null harness `tool_id` maps to `intergrax.harness_step`; no core schema change is needed.

The shared `run_id` and `step_id`, plus each event's `lineage.ref`, correlate receipts and evidence sidecars with the Intergrax journal for the run. This per-event data comes from `boundary_events[]`. The Intergrax trace endpoint is run/task-level, not per-event, and is not the source of per-event correlation. The journal remains the Intergrax-side operational record; each BoundaryAttest receipt is a portable attestation that the adapter observed and signed for one boundary event.

## What The Receipt Attests

The receipt is a signed claim that this local BoundaryAttest adapter received a specific Intergrax boundary event payload and hashed the received input and output. The local verification checks its signature and link into the local receipt chain.

The comparison also checks that the BoundaryAttest canonical input and output hashes match the hashes Intergrax included in the observed event.

## What It Does Not Prove

The receipt does not prove the business correctness of the action, that the action was authorized, that the surrounding Intergrax runtime was secure, or that the Intergrax journal is complete.

The PoC event is unsigned by Intergrax (`signed: false`). BoundaryAttest records that fact in tool metadata as `intergrax_signed: false`.

## Why This Is Not Server Attestation

This PoC receipt is `client_observed`, not `server_attested`.

BoundaryAttest signs what the adapter observed after receiving the Intergrax event. Intergrax did not cryptographically sign or attest the event with a server key that BoundaryAttest verifies. Treating this as `server_attested` would overstate the trust model.

Host-side signing would require Intergrax, or another trusted executing host/runtime, to sign what it claims it executed with its own key and expose a verification path for that signature. This is a possible next step, not part of the completed v2 PoC.
