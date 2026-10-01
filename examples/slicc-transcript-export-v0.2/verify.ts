#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyInteropV02Receipt } from "../interop-v0.2/verify-receipt.js";
import { APPROVALS_DOC, ARTIFACT_FILENAME, SLICC_COMMIT, SLICC_REPOSITORY, TRANSCRIPT_EXPORT_DOC } from "./generate.js";

type Result = { ok: true } | { ok: false; reason: string };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function validSource(value: unknown): boolean {
  return isRecord(value)
    && value.repository === SLICC_REPOSITORY
    && value.commit === SLICC_COMMIT
    && value.transcript_export_doc === TRANSCRIPT_EXPORT_DOC
    && value.approvals_doc === APPROVALS_DOC;
}

export function verifySliccExportHandoff(
  boundaryReceiptText: string,
  zipBytes: Buffer,
  independentlySuppliedPublicKeyPem: string,
): Result {
  const signatureResult = verifyInteropV02Receipt(boundaryReceiptText, independentlySuppliedPublicKeyPem);
  if (!signatureResult.ok) return signatureResult;
  const receipt = JSON.parse(boundaryReceiptText) as { claim: Record<string, unknown> };
  const claim = receipt.claim;
  if (claim.action_type !== "slicc.transcript_export_handoff" || claim.status !== "exported") {
    return { ok: false, reason: "invalid_slicc_export_claim" };
  }
  const extension = claim.slicc_export;
  if (!isRecord(extension) || !validSource(extension.source)) return { ok: false, reason: "invalid_slicc_export_claim" };
  const artifact = extension.artifact;
  const exportContext = extension.export_context;
  const approval = extension.approval_context;
  const adapter = extension.adapter;
  if (!isRecord(artifact)
    || artifact.filename !== ARTIFACT_FILENAME
    || artifact.media_type !== "application/zip"
    || artifact.representation !== "raw_bytes"
    || !Number.isSafeInteger(artifact.byte_length)
    || (artifact.byte_length as number) < 0
    || typeof artifact.sha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(artifact.sha256)) return { ok: false, reason: "invalid_slicc_export_claim" };
  if (!isRecord(exportContext)
    || typeof exportContext.export_id !== "string" || exportContext.export_id.length === 0
    || typeof exportContext.session_ref !== "string" || exportContext.session_ref.length === 0
    || exportContext.format !== "slicc-transcript"
    || exportContext.schema_version !== 1) return { ok: false, reason: "invalid_slicc_export_claim" };
  if (!isRecord(approval)
    || approval.gate_kind !== "export"
    || approval.scenario_decision !== "allow_once"
    || approval.portable_native_approval_reference !== "unavailable"
    || approval.provenance !== "synthetic_fixture_context") return { ok: false, reason: "invalid_slicc_export_claim" };
  if (!isRecord(adapter)
    || adapter.identity !== "boundaryattest-synthetic-slicc-export-adapter"
    || typeof adapter.scope !== "string" || adapter.scope.length === 0) return { ok: false, reason: "invalid_slicc_export_claim" };
  if (artifact.byte_length !== zipBytes.length) return { ok: false, reason: "artifact_byte_length_mismatch" };
  const actualDigest = createHash("sha256").update(zipBytes).digest("hex");
  if (artifact.sha256 !== actualDigest) return { ok: false, reason: "artifact_digest_mismatch" };
  return { ok: true };
}

function main(): void {
  const fixtureDir = resolve("examples", "slicc-transcript-export-v0.2");
  const receipt = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
  const artifact = readFileSync(resolve(fixtureDir, "artifact", ARTIFACT_FILENAME));
  const publicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");
  const result = verifySliccExportHandoff(receipt, artifact, publicKey);
  if (!result.ok) throw new Error(`SLICC transcript-export handoff verification failed: ${result.reason}`);
  console.log("PASS strict v0.2 envelope, expected key ID, and Ed25519/JCS signature");
  console.log("PASS exact ZIP byte length and SHA-256 match the signed raw-byte binding");
  console.log("PASS required pinned SLICC source and narrow synthetic export context");
  console.log("PASS verification used no private key and no SLICC runtime");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
