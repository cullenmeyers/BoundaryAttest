#!/usr/bin/env node

import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableJson } from "../../src/hash.js";

const VECTOR_DIR = resolve("examples/interop-v0.1/test-vectors");
const REQUIRED_TOP_LEVEL_FIELDS = ["claim", "signature", "public_key_id"] as const;
const REQUIRED_CLAIM_FIELDS = [
  "receipt_version",
  "receipt_role",
  "event_id",
  "timestamp",
  "action_type",
  "status",
] as const;

type FailureReason =
  | "invalid_json"
  | "invalid_receipt"
  | `missing_top_level_field:${string}`
  | `missing_claim_field:${string}`
  | "unsupported_version"
  | "public_key_id_mismatch"
  | "invalid_signature";

type VerificationResult = { ok: true } | { ok: false; reason: FailureReason };

type VectorCase = {
  name: string;
  receiptFile: string;
  publicKeyFile: string;
  expected: "pass" | FailureReason;
};

const CASES: VectorCase[] = [
  {
    name: "valid receipt + public key",
    receiptFile: "valid-receipt.json",
    publicKeyFile: "public-key.pem",
    expected: "pass",
  },
  {
    name: "tampered claim",
    receiptFile: "tampered-claim.json",
    publicKeyFile: "public-key.pem",
    expected: "invalid_signature",
  },
  {
    name: "wrong public key",
    receiptFile: "valid-receipt.json",
    publicKeyFile: "wrong-public-key.pem",
    expected: "public_key_id_mismatch",
  },
  {
    name: "unsupported version",
    receiptFile: "unsupported-version.json",
    publicKeyFile: "public-key.pem",
    expected: "unsupported_version",
  },
  {
    name: "missing required field",
    receiptFile: "missing-required-field.json",
    publicKeyFile: "public-key.pem",
    expected: "missing_claim_field:status",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function publicKeyId(publicKeyPem: string): string {
  const spkiDer = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  const digest = createHash("sha256").update(spkiDer).digest("hex");
  return `sha256:${digest}`;
}

function verifyInteropReceipt(receiptText: string, publicKeyPem: string): VerificationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(receiptText);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: "invalid_receipt" };
  }

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!hasOwn(parsed, field)) {
      return { ok: false, reason: `missing_top_level_field:${field}` };
    }
  }

  if (!isRecord(parsed.claim) || typeof parsed.signature !== "string" || typeof parsed.public_key_id !== "string") {
    return { ok: false, reason: "invalid_receipt" };
  }

  for (const field of REQUIRED_CLAIM_FIELDS) {
    if (!hasOwn(parsed.claim, field)) {
      return { ok: false, reason: `missing_claim_field:${field}` };
    }
  }

  if (parsed.claim.receipt_version !== "0.1") {
    return { ok: false, reason: "unsupported_version" };
  }

  if (parsed.public_key_id !== publicKeyId(publicKeyPem)) {
    return { ok: false, reason: "public_key_id_mismatch" };
  }

  try {
    const valid = verify(
      null,
      Buffer.from(stableJson(parsed.claim)),
      publicKeyPem,
      Buffer.from(parsed.signature, "base64"),
    );
    return valid ? { ok: true } : { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}

function main(): void {
  let allMatched = true;
  console.log("BoundaryAttest Interop Profile v0.1 test vectors");

  for (const vector of CASES) {
    const receiptText = readFileSync(resolve(VECTOR_DIR, vector.receiptFile), "utf8");
    const publicKeyPem = readFileSync(resolve(VECTOR_DIR, vector.publicKeyFile), "utf8");
    const result = verifyInteropReceipt(receiptText, publicKeyPem);
    const actual = result.ok ? "pass" : result.reason;
    const matched = actual === vector.expected;
    allMatched &&= matched;
    console.log(`${matched ? "PASS" : "FAIL"} ${vector.name}: expected ${vector.expected}, got ${actual}`);
  }

  if (!allMatched) {
    process.exitCode = 1;
  }
}

main();
