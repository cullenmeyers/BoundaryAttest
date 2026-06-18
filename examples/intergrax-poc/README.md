# Intergrax PoC Adapter

This is the smallest AgentReceipt adapter for the Intergrax `attestation_demo` partner handoff.

## Start Intergrax

Use the Intergrax PoC v2 runbook at commit `106aee77` (or newer) on branch `agent_experiment_runtime`:

```powershell
git clone https://github.com/jakbuczarnecki/intergrax
cd intergrax
git checkout agent_experiment_runtime
copy applications\attestation_demo\.env.example applications\attestation_demo\.env
applications\attestation_demo\docker\build-docker.bat
docker run --rm --name attestation-demo --env-file applications/attestation_demo/.env -p 8097:8097 attestation-demo
```

The adapter defaults to `http://127.0.0.1:8097`. Override with `INTERGRAX_BASE_URL`. If the host requires a key, set `INTERGRAX_HARNESS_API_KEY`; the adapter sends it as `X-Api-Key`.

## Run

```powershell
npm run build
npm run example:intergrax-poc
```

The adapter posts `fixtures/poc_run_request.v1.json`, orders all supported `boundary_events[]` by `event_sequence`, and creates one local `client_observed` receipt per event. A successful PoC v2 run produces separate `tool_execution` and `harness_step` receipts. Each receipt is written through `LocalFileReceiptSink`, verified independently, and linked to an evidence sidecar by `event_id`.

`event_id`, `event_sequence`, `boundary_type`, `run_id`, `step_id`, policy verdicts, step outcome, and the original Intergrax action status are preserved in metadata/evidence. `lineage.ref` is mapped into receipt lineage. Because AgentReceipt's existing action status vocabulary does not include `completed`, harness `completed` maps to receipt status `success`; the original value remains `source_action_status: "completed"`. A harness event has no `tool_id`, so it maps to the adapter label `intergrax.harness_step`.

## What The Receipt Proves

The generated receipt proves that this local AgentReceipt adapter received a specific Intergrax boundary event payload, hashed the received input/output with AgentReceipt canonical hashing, signed the receipt locally, and linked it into the local receipt chain.

## What It Does Not Prove

Intergrax emits this PoC event unsigned (`signed: false`). The receipt does not prove Intergrax cryptographically attested, signed, authorized, or certified the event. It must not be treated as `server_attested`.
