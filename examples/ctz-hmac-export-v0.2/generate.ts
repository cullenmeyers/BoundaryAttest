#!/usr/bin/env node

import { createHash, createHmac, createPublicKey } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signInteropV02Claim } from "../interop-v0.2/verify-receipt.js";

export const CTZ_REPOSITORY = "vedchaos/chaos-type-zero";
export const CTZ_COMMIT = "531d1796b312318f59bf241b8183718a3fcd2839";
export const CTZ_PATH = "bridge_core/receipts.py";
export const FIXTURE_HMAC_SECRET = "TEST-ONLY-CTZ-HMAC-SECRET-DO-NOT-USE-IN-PRODUCTION";

const fixtureDir = resolve("examples", "ctz-hmac-export-v0.2");
const artifactPath = resolve(fixtureDir, "artifact", "report.md");
const nativeReceiptPath = resolve(fixtureDir, "ctz-native-receipt.json");
const privateKeyPath = resolve(fixtureDir, "test-only-boundaryattest-private-key.pem");
const publicKeyPath = resolve(fixtureDir, "boundaryattest-public-key.pem");

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function pythonSortedCompactJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonSortedCompactJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${pythonSortedCompactJson(value[key])}`).join(",")}}`;
}

export function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function ctzHashPayload(value: JsonValue | Buffer): string {
  const bytes = Buffer.isBuffer(value)
    ? value
    : typeof value === "string"
      ? Buffer.from(value, "utf8")
      : Buffer.from(pythonSortedCompactJson(value), "utf8");
  return sha256Hex(bytes);
}

export function createNativeReceipt(): Record<string, JsonValue> {
  const keyId = `key-${sha256Hex(FIXTURE_HMAC_SECRET).slice(0, 12)}`;
  const body: Record<string, JsonValue> = {
    receipt_id: "rcpt_1773748800_7a11c0ffee42",
    timestamp: "2026-03-17T12:00:00+00:00",
    task_id: "task-synthetic-security-report-001",
    task_description: "Export a synthetic dependency review report",
    handoff: { from_agent: "PlannerAgent", to_agent: "ExecutorAgent" },
    action: { action_type: "consequential_tool_call", tool_name: "report_writer.export_markdown" },
    provenance: {
      input_hash: ctzHashPayload({ package: "example-package", requested_check: "dependency_review" }),
      result_hash: ctzHashPayload({ artifact: "report.md", finding_count: 1, status: "complete" }),
    },
    status: "exported",
    signer: { key_id: keyId, algorithm: "HMAC-SHA256" },
  };
  const signature = createHmac("sha256", Buffer.from(FIXTURE_HMAC_SECRET, "utf8"))
    .update(pythonSortedCompactJson(body), "utf8")
    .digest("hex");
  return { version: "ctz-receipt-v1.0", receipt: body, signature };
}

export function createBoundaryAttestClaim(nativeBytes: Buffer, artifactBytes: Buffer): Record<string, unknown> {
  const nativeReceipt = JSON.parse(nativeBytes.toString("utf8")) as {
    receipt: { receipt_id: string; signer: { key_id: string } };
  };
  return {
    receipt_version: "0.2",
    receipt_role: "server_attested",
    event_id: "ctz-export-task-synthetic-security-report-001",
    timestamp: "2026-03-17T12:00:01.000Z",
    action_type: "ctz.evidence_exported",
    status: "exported",
    ctz_export: {
      source: { repository: CTZ_REPOSITORY, commit: CTZ_COMMIT, path: CTZ_PATH },
      native_receipt: {
        receipt_id: nativeReceipt.receipt.receipt_id,
        hmac_key_id: nativeReceipt.receipt.signer.key_id,
        filename: "ctz-native-receipt.json",
        media_type: "application/json",
        representation: "raw_bytes",
        sha256: sha256Hex(nativeBytes),
      },
      artifact: {
        filename: "report.md",
        media_type: "text/markdown",
        representation: "raw_bytes",
        sha256: sha256Hex(artifactBytes),
      },
      adapter: {
        identity: "boundaryattest-synthetic-ctz-export-adapter",
        scope: "attest frozen CTZ receipt and exported artifact bytes only",
      },
    },
  };
}

export function generateFixture(): void {
  const artifactBytes = readFileSync(artifactPath);
  const nativeReceiptText = JSON.stringify(createNativeReceipt(), null, 2);
  writeFileSync(nativeReceiptPath, nativeReceiptText);
  const nativeBytes = readFileSync(nativeReceiptPath);
  const privateKey = readFileSync(privateKeyPath, "utf8");
  const publicKey = readFileSync(publicKeyPath, "utf8");
  const claim = createBoundaryAttestClaim(nativeBytes, artifactBytes);
  const publicKeyDer = createPublicKey(publicKey).export({ type: "spki", format: "der" });
  const receipt = {
    claim,
    signature: signInteropV02Claim(claim, privateKey),
    public_key_id: `sha256:${sha256Hex(publicKeyDer)}`,
  };
  writeFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  writeFileSync(resolve(fixtureDir, "expected.json"), `${JSON.stringify({
    ctz_native_receipt_sha256: sha256Hex(nativeBytes),
    artifact_sha256: sha256Hex(artifactBytes),
    boundaryattest_public_key_id: receipt.public_key_id,
  }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(artifactPath), { recursive: true });
  generateFixture();
  console.log("Generated deterministic CTZ export fixture.");
}
