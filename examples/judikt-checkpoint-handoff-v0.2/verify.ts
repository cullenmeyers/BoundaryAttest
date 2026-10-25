#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyInteropV02Receipt } from "../interop-v0.2/verify-receipt.js";
import {
  CHECKPOINT_FILENAME,
  JUDIKT_AUDIT_PATH,
  JUDIKT_CLI_PATH,
  JUDIKT_COMMIT,
  JUDIKT_REPOSITORY,
} from "./generate.js";

type Result = { ok: true } | { ok: false; reason: string };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validSource(value: unknown): boolean {
  return isRecord(value)
    && value.repository === JUDIKT_REPOSITORY
    && value.commit === JUDIKT_COMMIT
    && value.audit_path === JUDIKT_AUDIT_PATH
    && value.cli_path === JUDIKT_CLI_PATH;
}

export function verifyJudiktCheckpointHandoff(
  receiptText: string,
  checkpointBytes: Buffer,
  independentlySuppliedPublicKeyPem: string,
): Result {
  const signatureResult = verifyInteropV02Receipt(receiptText, independentlySuppliedPublicKeyPem);
  if (!signatureResult.ok) return signatureResult;
  const claim = (JSON.parse(receiptText) as { claim: Record<string, unknown> }).claim;
  if (claim.action_type !== "judikt.audit_checkpoint_handoff" || claim.status !== "exported") {
    return { ok: false, reason: "invalid_judikt_checkpoint_claim" };
  }
  const extension = claim.judikt_checkpoint;
  if (!isRecord(extension) || !validSource(extension.source)) {
    return { ok: false, reason: "invalid_judikt_checkpoint_claim" };
  }
  const checkpoint = extension.checkpoint;
  const adapter = extension.adapter;
  if (!isRecord(checkpoint)
    || checkpoint.filename !== CHECKPOINT_FILENAME
    || checkpoint.media_type !== "application/json"
    || checkpoint.representation !== "raw_bytes"
    || typeof checkpoint.sha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(checkpoint.sha256)
    || typeof checkpoint.chain_id !== "string"
    || !Number.isSafeInteger(checkpoint.seq)
    || typeof checkpoint.head_hash !== "string"
    || !/^[0-9a-f]{64}$/.test(checkpoint.head_hash)
    || checkpoint.native_signature_algorithm !== "HMAC-SHA256") {
    return { ok: false, reason: "invalid_judikt_checkpoint_claim" };
  }
  if (!isRecord(adapter)
    || adapter.identity !== "boundaryattest-synthetic-judikt-checkpoint-export-adapter"
    || typeof adapter.scope !== "string"
    || adapter.scope.length === 0) {
    return { ok: false, reason: "invalid_judikt_checkpoint_claim" };
  }

  const actualDigest = createHash("sha256").update(checkpointBytes).digest("hex");
  if (checkpoint.sha256 !== actualDigest) return { ok: false, reason: "checkpoint_digest_mismatch" };

  let native: unknown;
  try {
    native = JSON.parse(checkpointBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_native_checkpoint" };
  }
  if (!isRecord(native)
    || typeof native.chain_id !== "string"
    || !Number.isSafeInteger(native.seq)
    || typeof native.head_hash !== "string"
    || !/^[0-9a-f]{64}$/.test(native.head_hash)
    || typeof native.created_at !== "string"
    || typeof native.signature !== "string") {
    return { ok: false, reason: "invalid_native_checkpoint" };
  }
  if (checkpoint.chain_id !== native.chain_id) return { ok: false, reason: "checkpoint_chain_id_mismatch" };
  if (checkpoint.seq !== native.seq) return { ok: false, reason: "checkpoint_seq_mismatch" };
  if (checkpoint.head_hash !== native.head_hash) return { ok: false, reason: "checkpoint_head_hash_mismatch" };
  return { ok: true };
}

function main(): void {
  const fixtureDir = resolve("examples", "judikt-checkpoint-handoff-v0.2");
  const checkpointBytes = readFileSync(resolve(fixtureDir, CHECKPOINT_FILENAME));
  const receiptText = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
  const expectedPublicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");
  const result = verifyJudiktCheckpointHandoff(receiptText, checkpointBytes, expectedPublicKey);
  if (!result.ok) throw new Error(`Judikt checkpoint handoff verification failed: ${result.reason}`);
  console.log("PASS strict v0.2 envelope, expected-key ID, and Ed25519/JCS signature");
  console.log("PASS exact exported Judikt checkpoint bytes match the signed digest");
  console.log("PASS signed chain_id, seq, and head_hash match the frozen checkpoint");
  console.log("PASS external verification did not use the Judikt HMAC secret");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
