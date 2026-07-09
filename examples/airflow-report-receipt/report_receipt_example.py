"""Dependency-light Airflow/Cloud Composer report receipt example.

This file is illustrative and PythonOperator-compatible. It does not import
Airflow, GCS, or a crypto package.

Stdlib Python can hash the exact report bytes and build the receipt claim.
Actual public-key signing must be provided by a BoundaryAttest-compatible
signer hook, such as a CLI/sidecar, Cloud KMS adapter, or an Ed25519 Python
implementation allowed by your deployment.

Do not replace public-key signing with HMAC or a placeholder signature.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Optional, Protocol, TypedDict


Claim = dict[str, Any]


class SignatureResult(TypedDict):
    """Result returned by a real BoundaryAttest-compatible signer."""

    signature: str
    public_key_id: str


class ClaimSigner(Protocol):
    """BoundaryAttest-compatible claim signer interface.

    Implementations are responsible for using the canonicalization, signature
    algorithm, and public-key-id semantics expected by the verifier.
    """

    def __call__(self, claim: Mapping[str, Any]) -> SignatureResult:
        ...


def utc_now_iso() -> str:
    """Return an ISO-8601 UTC timestamp with a trailing Z."""

    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    """Return a BoundaryAttest-style SHA-256 hash string for raw bytes."""

    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def build_report_claim(
    *,
    report_bytes: bytes,
    monitored_dags: list[str],
    report_ref: str,
    status: str = "success",
    event_id: Optional[str] = None,
    timestamp: Optional[str] = None,
    dag_id: Optional[str] = None,
    dag_run_id: Optional[str] = None,
    task_id: Optional[str] = None,
    gcs_ref: Optional[str] = None,
    email_ref: Optional[str] = None,
    recipient_hash: Optional[str] = None,
    trace_ref: Optional[str] = None,
) -> Claim:
    """Build the unsigned claim for a generated HTML report."""

    claim: Claim = {
        "receipt_version": "0.1",
        "receipt_role": "client_observed",
        "event_id": event_id or f"evt_airflow_report_{uuid.uuid4().hex}",
        "timestamp": timestamp or utc_now_iso(),
        "action_type": "airflow.report.generated",
        "status": status,
        "monitored_dags": monitored_dags,
        "report_ref": report_ref,
        "artifact_hash": sha256_bytes(report_bytes),
        "artifact_hash_alg": "sha256",
    }

    optional_fields = {
        "dag_id": dag_id,
        "dag_run_id": dag_run_id,
        "task_id": task_id,
        "gcs_ref": gcs_ref,
        "email_ref": email_ref,
        "recipient_hash": recipient_hash,
        "trace_ref": trace_ref,
    }
    claim.update({key: value for key, value in optional_fields.items() if value is not None})
    return claim


def emit_receipt(*, claim: Mapping[str, Any], signer: ClaimSigner) -> dict[str, Any]:
    """Sign a claim and return the BoundaryAttest interop-style envelope."""

    signed = signer(claim)
    return {
        "claim": dict(claim),
        "signature": signed["signature"],
        "public_key_id": signed["public_key_id"],
    }


def signer_not_configured(_claim: Mapping[str, Any]) -> SignatureResult:
    """Placeholder that prevents accidental fake signatures."""

    raise NotImplementedError(
        "Configure a real BoundaryAttest-compatible signer. Stdlib Python can "
        "build the claim, but it cannot produce the required public-key signature."
    )


def write_json(path: str | Path, value: Mapping[str, Any]) -> None:
    """Write deterministic, readable JSON for local examples or Airflow volumes."""

    Path(path).write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def emit_report_receipt_task(
    *,
    report_html_path: str,
    receipt_json_path: str,
    monitored_dags: list[str],
    report_ref: str,
    signer: ClaimSigner = signer_not_configured,
    dag_id: Optional[str] = None,
    dag_run_id: Optional[str] = None,
    task_id: Optional[str] = None,
    gcs_ref: Optional[str] = None,
    email_ref: Optional[str] = None,
    recipient_hash: Optional[str] = None,
    trace_ref: Optional[str] = None,
) -> dict[str, Any]:
    """PythonOperator-compatible callable.

    Example Airflow usage:

        PythonOperator(
            task_id="emit_boundaryattest_receipt",
            python_callable=emit_report_receipt_task,
            op_kwargs={
                "report_html_path": "/tmp/report.html",
                "receipt_json_path": "/tmp/receipt.json",
                "monitored_dags": ["daily_sales", "warehouse_refresh"],
                "report_ref": "dag-health/2026-07-09/report.html",
                "signer": real_boundaryattest_signer,
            },
        )
    """

    report_bytes = Path(report_html_path).read_bytes()
    claim = build_report_claim(
        report_bytes=report_bytes,
        monitored_dags=monitored_dags,
        report_ref=report_ref,
        dag_id=dag_id,
        dag_run_id=dag_run_id,
        task_id=task_id,
        gcs_ref=gcs_ref,
        email_ref=email_ref,
        recipient_hash=recipient_hash,
        trace_ref=trace_ref,
    )
    receipt = emit_receipt(claim=claim, signer=signer)
    write_json(receipt_json_path, receipt)
    return receipt


def build_claim_only_task(
    *,
    report_html_path: str,
    claim_json_path: str,
    monitored_dags: list[str],
    report_ref: str,
    **metadata: Optional[str],
) -> Claim:
    """Stdlib-only mode: hash report bytes and write an unsigned claim JSON."""

    report_bytes = Path(report_html_path).read_bytes()
    claim = build_report_claim(
        report_bytes=report_bytes,
        monitored_dags=monitored_dags,
        report_ref=report_ref,
        dag_id=metadata.get("dag_id"),
        dag_run_id=metadata.get("dag_run_id"),
        task_id=metadata.get("task_id"),
        gcs_ref=metadata.get("gcs_ref"),
        email_ref=metadata.get("email_ref"),
        recipient_hash=metadata.get("recipient_hash"),
        trace_ref=metadata.get("trace_ref"),
    )
    write_json(claim_json_path, claim)
    return claim


# Optional GCS storage sketch:
#
# def upload_report_and_receipt(report_html_path: str, receipt_json_path: str, gcs_prefix: str) -> None:
#     from google.cloud import storage
#
#     client = storage.Client()
#     bucket_name, prefix = parse_gs_uri(gcs_prefix)
#     bucket = client.bucket(bucket_name)
#     bucket.blob(f"{prefix}/report.html").upload_from_filename(report_html_path)
#     bucket.blob(f"{prefix}/receipt.json").upload_from_filename(receipt_json_path)
#
# Cloud Composer deployments often store report.html and receipt.json in the
# same GCS prefix, then email stable links to one or both artifacts.


if __name__ == "__main__":
    sample_report = b"<html><body><h1>DAG health</h1><p>All monitored DAGs succeeded.</p></body></html>"
    sample_claim = build_report_claim(
        report_bytes=sample_report,
        monitored_dags=["daily_sales", "warehouse_refresh"],
        report_ref="dag-health/2026-07-09/report.html",
        gcs_ref="gs://composer-reports/dag-health/2026-07-09/report.html",
        trace_ref="airflow-run:dag_health_monitor/scheduled__2026-07-09T12:00:00+00:00",
    )
    print(json.dumps(sample_claim, indent=2, sort_keys=True))
