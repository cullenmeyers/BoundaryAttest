#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { interopV02PublicKeyId, signInteropV02Claim } from "../interop-v0.2/verify-receipt.js";

export const JUDIKT_REPOSITORY = "gaurav-gs7/Judikt";
export const JUDIKT_COMMIT = "16f6b911ff550d3213605e5e91a2289e0352fb5c";
export const JUDIKT_AUDIT_PATH = "src/judikt/audit.py";
export const JUDIKT_CLI_PATH = "src/judikt/cli.py";
export const CHECKPOINT_FILENAME = "judikt-native-checkpoint.json";
export const FIXTURE_HMAC_SECRET = "TEST-ONLY-JUDIKT-AUDIT-HMAC-SECRET-DO-NOT-USE-IN-PRODUCTION";

const fixtureDir = resolve("examples", "judikt-checkpoint-handoff-v0.2");
const checkpointPath = resolve(fixtureDir, CHECKPOINT_FILENAME);
const privateKeyPath = resolve(fixtureDir, "test-only-boundaryattest-private-key.pem");
const publicKeyPath = resolve(fixtureDir, "boundaryattest-public-key.pem");

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function pythonSortedCompactJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonSortedCompactJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${pythonSortedCompactJson(value[key])}`).join(",")}}`;
}

function sortJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortJson);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createNativeCheckpoint(): Record<string, JsonValue> {
  const checkpoint: Record<string, JsonValue> = {
    chain_id: "judikt-synthetic-chain-001",
    seq: 128,
    head_hash: sha256Hex(Buffer.from("synthetic-judikt-event-chain-head-v1", "utf8")),
    created_at: "2026-10-25T16:30:00+00:00",
  };
  checkpoint.signature = createHmac("sha256", Buffer.from(FIXTURE_HMAC_SECRET, "utf8"))
    .update(pythonSortedCompactJson(checkpoint), "utf8")
    .digest("hex");
  return checkpoint;
}

export function renderNativeCheckpoint(checkpoint: Record<string, JsonValue>): string {
  return `${JSON.stringify(sortJson(checkpoint), null, 2)}\n`;
}

export function createBoundaryAttestClaim(checkpointBytes: Buffer): Record<string, unknown> {
  const native = JSON.parse(checkpointBytes.toString("utf8")) as {
    chain_id: string;
    seq: number;
    head_hash: string;
  };
  return {
    receipt_version: "0.2",
    receipt_role: "server_attested",
    event_id: "judikt-checkpoint-handoff-judikt-synthetic-chain-001-128",
    timestamp: "2026-10-25T16:30:01.000Z",
    action_type: "judikt.audit_checkpoint_handoff",
    status: "exported",
    judikt_checkpoint: {
      source: {
        repository: JUDIKT_REPOSITORY,
        commit: JUDIKT_COMMIT,
        audit_path: JUDIKT_AUDIT_PATH,
        cli_path: JUDIKT_CLI_PATH,
      },
      checkpoint: {
        filename: CHECKPOINT_FILENAME,
        media_type: "application/json",
        representation: "raw_bytes",
        sha256: sha256Hex(checkpointBytes),
        chain_id: native.chain_id,
        seq: native.seq,
        head_hash: native.head_hash,
        native_signature_algorithm: "HMAC-SHA256",
      },
      adapter: {
        identity: "boundaryattest-synthetic-judikt-checkpoint-export-adapter",
        scope: "attest exact exported Judikt checkpoint bytes and correlate checkpoint metadata only",
      },
    },
  };
}

export function generateFixture(): void {
  const nativeText = renderNativeCheckpoint(createNativeCheckpoint());
  writeFileSync(checkpointPath, nativeText);
  const checkpointBytes = readFileSync(checkpointPath);
  const privateKey = readFileSync(privateKeyPath, "utf8");
  const publicKey = readFileSync(publicKeyPath, "utf8");
  const claim = createBoundaryAttestClaim(checkpointBytes);
  const receipt = {
    claim,
    signature: signInteropV02Claim(claim, privateKey),
    public_key_id: interopV02PublicKeyId(publicKey),
  };
  writeFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  writeFileSync(resolve(fixtureDir, "expected.json"), `${JSON.stringify({
    judikt_native_checkpoint_sha256: sha256Hex(checkpointBytes),
    judikt_chain_id: (JSON.parse(nativeText) as { chain_id: string }).chain_id,
    judikt_seq: (JSON.parse(nativeText) as { seq: number }).seq,
    judikt_head_hash: (JSON.parse(nativeText) as { head_hash: string }).head_hash,
    boundaryattest_public_key_id: receipt.public_key_id,
  }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateFixture();
  console.log("Generated deterministic synthetic Judikt checkpoint handoff fixture.");
}
