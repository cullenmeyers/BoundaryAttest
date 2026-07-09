# Airflow Report Receipt Example

This is a dependency-light example for adding a BoundaryAttest-style receipt step to an Apache Airflow or Cloud Composer DAG health-report workflow.

It is example code only. It is not a production Python SDK, and it does not change the BoundaryAttest receipt envelope, interop profile, schema, verifier behavior, canonicalization, crypto/key logic, package exports, CI behavior, or test vectors.

## Scenario

A Python Airflow or Cloud Composer DAG generates an HTML DAG health report and sends it to a team. BoundaryAttest can add an optional follow-up step that hashes the exact HTML report content and emits a receipt JSON.

Typical flow:

- Cloud Composer / Airflow scheduler runs the monitor DAG
- task fetches DAG statuses
- task builds an HTML report
- task sends the report by email
- optional BoundaryAttest step hashes the HTML report and emits a receipt JSON
- receipt can be stored in GCS or alongside the report
- an external verifier can later verify receipt + report bytes outside Airflow/GCP

## Correct Integration Model

BoundaryAttest should sit after report generation, not inside DAG status collection.

Preferred flow:

- fetch DAG statuses
- build HTML report
- hash exact report bytes/content
- sign and emit receipt JSON
- store report + receipt together, or send email with receipt/report links
- verify outside Airflow/GCP later

Sending the email before receipt generation is possible. If the receipt is supposed to travel with the report, the email should include the receipt or a stable link to it.

## Boundary / Trust Limits

The receipt proves only:

- a specific signer signed a specific claim
- the signed claim was not altered
- the report bytes match the signed `artifact_hash` if recomputed

It does not prove:

- the report is correct
- Airflow statuses were accurate
- the DAGs actually succeeded
- the Airflow worker was uncompromised
- GCP/GCS/Gmail delivered anything
- the report was authorized or compliant
- the evidence set is complete

## Receipt Shape

The example uses the existing BoundaryAttest interop-style envelope:

```json
{
  "claim": {
    "receipt_version": "0.1",
    "receipt_role": "client_observed",
    "event_id": "evt_airflow_report_001",
    "timestamp": "2026-07-09T12:00:00.000Z",
    "action_type": "airflow.report.generated",
    "status": "success",
    "monitored_dags": ["daily_sales", "warehouse_refresh"],
    "report_ref": "dag-health/2026-07-09/report.html",
    "artifact_hash": "sha256:...",
    "artifact_hash_alg": "sha256",
    "dag_id": "dag_health_monitor",
    "dag_run_id": "scheduled__2026-07-09T12:00:00+00:00",
    "task_id": "emit_boundaryattest_receipt",
    "gcs_ref": "gs://example-bucket/dag-health/2026-07-09/report.html",
    "recipient_hash": "sha256:...",
    "trace_ref": "airflow-run:..."
  },
  "signature": "...",
  "public_key_id": "sha256:..."
}
```

Required top-level fields:

- `claim`
- `signature`
- `public_key_id`

Claim fields used here:

- `receipt_version`
- `receipt_role`
- `event_id`
- `timestamp`
- `action_type: "airflow.report.generated"`
- `status`
- `monitored_dags`
- `report_ref`
- `artifact_hash`
- `artifact_hash_alg: "sha256"`
- optional `dag_id`
- optional `dag_run_id`
- optional `task_id`
- optional `gcs_ref`
- optional `email_ref` or `recipient_hash`
- optional `trace_ref`

## Dependency-Light Python

See `report_receipt_example.py`.

Python stdlib can compute SHA-256 and build the claim JSON. Public-key signing is not available in the Python stdlib, so the example is honest about two modes:

- stdlib-only hashing + claim construction
- pluggable signer function for actual signing

The signer hook must perform BoundaryAttest-compatible signing, including the same canonicalization, signature algorithm, and public-key-id behavior expected by the verifier. Suitable production implementations could call a BoundaryAttest CLI/sidecar, Cloud KMS, or a Python Ed25519 implementation if the deployment allows an added dependency.

The example deliberately does not fake cryptographic signing with HMAC or insecure placeholders. It also does not claim to be a complete BoundaryAttest-compatible Python signer.

## GCS Storage

GCS storage is intentionally left as pseudocode so this example has no `google-cloud-storage` dependency.

Cloud Composer deployments commonly store `report.html` and `receipt.json` in the same GCS prefix, for example:

```text
gs://composer-reports/dag-health/2026-07-09/report.html
gs://composer-reports/dag-health/2026-07-09/receipt.json
```

## Verification Flow

An external verifier receives:

- `report.html`
- `receipt.json`
- expected public key

Then it:

- checks the receipt signature with a BoundaryAttest-compatible verifier
- recomputes SHA-256 of `report.html`
- checks that recomputed hash equals `claim.artifact_hash`
- separately decides whether to trust the signer, key, report method, and source system

This verification can happen outside Airflow and outside GCP.

## Production Gaps

Before using this pattern in production, decide:

- key custody
- Cloud KMS or external signer
- key rotation/revocation
- public key distribution
- GCS retention
- recipient redaction/hashing
- whether receipt generation should fail-open or fail-closed
