# Intergrax PoC Adapter

This is the smallest AgentReceipt adapter for the Intergrax `attestation_demo` partner handoff.

## Start Intergrax

Use the Intergrax runbook at commit `c457037c` on branch `agent_experiment_runtime`:

```powershell
git clone https://github.com/jakbuczarnecki/intergrax
cd intergrax
git checkout c457037c
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

The adapter posts `fixtures/poc_run_request.v1.json`, reads `boundary_events[]`, accepts only `execution_boundary_event.v1`, creates a local `client_observed` receipt, writes it through `LocalFileReceiptSink`, verifies it, and prints the receipt path, evidence sidecar path, verification result, `run_id`, `step_id`, and hash comparison results.

## What The Receipt Proves

The generated receipt proves that this local AgentReceipt adapter received a specific Intergrax boundary event payload, hashed the received input/output with AgentReceipt canonical hashing, signed the receipt locally, and linked it into the local receipt chain.

## What It Does Not Prove

Intergrax emits this PoC event unsigned (`signed: false`). The receipt does not prove Intergrax cryptographically attested, signed, authorized, or certified the event. It must not be treated as `server_attested`.
