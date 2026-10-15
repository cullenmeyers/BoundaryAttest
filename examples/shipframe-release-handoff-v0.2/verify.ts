#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyInteropV02Receipt } from "../interop-v0.2/verify-receipt.js";
import { ARTIFACT_FILENAME, DEPLOY_EVIDENCE_DOC, EVIDENCE_AUDIT_DOC, PROOF_RUNNER_DOC, SHIPFRAME_COMMIT, SHIPFRAME_REPOSITORY } from "./generate.js";

type Result = { ok: true } | { ok: false; reason: string };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function validSource(value: unknown): boolean {
  return isRecord(value)
    && value.repository === SHIPFRAME_REPOSITORY
    && value.commit === SHIPFRAME_COMMIT
    && value.deploy_evidence_doc === DEPLOY_EVIDENCE_DOC
    && value.evidence_audit_doc === EVIDENCE_AUDIT_DOC
    && value.proof_runner_doc === PROOF_RUNNER_DOC;
}

export function verifyShipFrameReleaseHandoff(
  receiptText: string,
  packageBytes: Buffer,
  independentlySuppliedPublicKeyPem: string,
): Result {
  const signatureResult = verifyInteropV02Receipt(receiptText, independentlySuppliedPublicKeyPem);
  if (!signatureResult.ok) return signatureResult;
  const claim = (JSON.parse(receiptText) as { claim: Record<string, unknown> }).claim;
  if (claim.action_type !== "shipframe.release_evidence_handoff" || claim.status !== "exported") {
    return { ok: false, reason: "invalid_shipframe_export_claim" };
  }
  const extension = claim.shipframe_export;
  if (!isRecord(extension) || !validSource(extension.source)) return { ok: false, reason: "invalid_shipframe_export_claim" };
  const artifact = extension.artifact;
  const context = extension.export_context;
  const time = extension.time_semantics;
  const adapter = extension.adapter;
  if (!isRecord(artifact)
    || artifact.filename !== ARTIFACT_FILENAME
    || artifact.media_type !== "application/zip"
    || artifact.representation !== "raw_bytes"
    || !Number.isSafeInteger(artifact.byte_length) || (artifact.byte_length as number) < 0
    || typeof artifact.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(artifact.sha256)) {
    return { ok: false, reason: "invalid_shipframe_export_claim" };
  }
  if (!isRecord(context)
    || context.synthetic_release_ref !== "synthetic-release-2026-10-14"
    || context.environment !== "staging"
    || context.selected_evidence_count !== 2
    || context.provenance !== "synthetic_fixture_context") return { ok: false, reason: "invalid_shipframe_export_claim" };
  if (!isRecord(time) || time.timestamp_kind !== "signer_asserted" || time.independently_witnessed !== false) {
    return { ok: false, reason: "invalid_shipframe_export_claim" };
  }
  if (!isRecord(adapter)
    || adapter.identity !== "boundaryattest-synthetic-shipframe-release-handoff-adapter"
    || typeof adapter.scope !== "string" || adapter.scope.length === 0) return { ok: false, reason: "invalid_shipframe_export_claim" };
  if (artifact.byte_length !== packageBytes.length) return { ok: false, reason: "artifact_byte_length_mismatch" };
  const actualDigest = createHash("sha256").update(packageBytes).digest("hex");
  if (artifact.sha256 !== actualDigest) return { ok: false, reason: "artifact_digest_mismatch" };
  return { ok: true };
}

function main(): void {
  const fixtureDir = resolve("examples", "shipframe-release-handoff-v0.2");
  const receipt = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
  const artifact = readFileSync(resolve(fixtureDir, "package", ARTIFACT_FILENAME));
  const publicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");
  const result = verifyShipFrameReleaseHandoff(receipt, artifact, publicKey);
  if (!result.ok) throw new Error(`ShipFrame-style release handoff verification failed: ${result.reason}`);
  console.log("PASS strict v0.2 envelope, independently expected key ID, and Ed25519/JCS signature");
  console.log("PASS exact ZIP byte length and SHA-256 match the signed raw-byte binding");
  console.log("PASS pinned ShipFrame references and narrow synthetic export semantics");
  console.log("PASS verification used no private key, ShipFrame runtime, CI, deployment, or provider access");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
