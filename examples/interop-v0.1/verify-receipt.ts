import { createHash, createPublicKey, verify } from "node:crypto";
import { stableJson } from "../../src/hash.js";

const REQUIRED_TOP_LEVEL_FIELDS = ["claim", "signature", "public_key_id"] as const;
const REQUIRED_CLAIM_FIELDS = [
  "receipt_version",
  "receipt_role",
  "event_id",
  "timestamp",
  "action_type",
  "status",
] as const;

export type FailureReason =
  | "invalid_json"
  | "invalid_receipt"
  | `missing_top_level_field:${string}`
  | `unexpected_top_level_field:${string}`
  | `missing_claim_field:${string}`
  | "unsupported_version"
  | "public_key_id_mismatch"
  | "invalid_signature";

export type VerificationResult = { ok: true } | { ok: false; reason: FailureReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

export function interopPublicKeyId(publicKeyPem: string): string {
  const spkiDer = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  const digest = createHash("sha256").update(spkiDer).digest("hex");
  return `sha256:${digest}`;
}

export function verifyInteropReceipt(receiptText: string, publicKeyPem: string): VerificationResult {
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

  for (const field of Object.keys(parsed)) {
    if (!(REQUIRED_TOP_LEVEL_FIELDS as readonly string[]).includes(field)) {
      return { ok: false, reason: `unexpected_top_level_field:${field}` };
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

  if (parsed.public_key_id !== interopPublicKeyId(publicKeyPem)) {
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
