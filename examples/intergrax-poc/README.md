# Intergrax PoC Adapter

This is the smallest BoundaryAttest adapter for the live Intergrax `attestation_demo` PoC. BoundaryAttest was previously called AgentReceipt during early PoC work.

## Start Intergrax

Use Intergrax commit `96b7f997` on branch `agent_experiment_runtime`:

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

The adapter posts `fixtures/poc_run_request.v1.json`, orders all supported `boundary_events[]` by `event_sequence`, and creates one local `client_observed` receipt per event. A successful run produces separate `tool_execution` and `harness_step` events, each with its own EBE-9 signature and no composite run receipt. Before creating a receipt for `signed: true`, the adapter verifies the canonical event hash and Ed25519 host-attestation statement with the pinned `attestation-demo-host-1` public key. Invalid signed events are rejected. Each accepted event gets a separate BoundaryAttest receipt and evidence sidecar linked by `event_id`.

`event_id`, `event_sequence`, `boundary_type`, `run_id`, `step_id`, policy verdicts, step outcome, and the original Intergrax action status are preserved in metadata/evidence. `lineage.ref` is mapped into receipt lineage. Because BoundaryAttest's existing action status vocabulary does not include `completed`, harness `completed` maps to receipt status `success`; the original value remains `source_action_status: "completed"`. A harness event has no `tool_id`, so it maps to the adapter label `intergrax.harness_step`.

## What The Receipt Attests

The Intergrax EBE-9 signature is a host/runtime claim over one boundary event. The generated BoundaryAttest receipt remains a separate signed `client_observed` wrapper and ingestion claim. It says that this adapter received a specific event payload and hashed the received input/output with BoundaryAttest canonical hashing. Local verification checks the BoundaryAttest signature and chain link; it does not substitute that signature for the Intergrax host signature.

## What It Does Not Prove

An EBE-9 host-signed event does not prove truth, authorization, an uncompromised host/runtime, or a final business outcome. The BoundaryAttest wrapper must not be treated as the host signature or as `server_attested`.

When Intergrax host signing is disabled, v2 events with `signed: false` and `host_attestation: null` remain supported. In that mode, metadata explicitly records the event as unsigned and makes no host-attestation claim.
