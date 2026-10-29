import { createHash, createPublicKey, randomUUID, sign, verify } from "node:crypto";
import { jcsCanonicalBytes } from "./jcs.js";

const TOP_LEVEL_FIELDS = ["claim", "signature", "public_key_id"] as const;
export const REQUIRED_INTEROP_V02_CLAIM_FIELDS = [
  "receipt_version",
  "receipt_role",
  "event_id",
  "timestamp",
  "action_type",
  "status",
] as const;

export type InteropV02ReceiptRole = "client_observed" | "server_attested";

export type InteropV02Claim = Record<string, unknown> & {
  receipt_version: "0.2";
  receipt_role: InteropV02ReceiptRole;
  event_id: string;
  timestamp: string;
  action_type: string;
  status: string;
};

export type InteropV02Receipt = {
  claim: InteropV02Claim;
  signature: string;
  public_key_id: string;
};

export type InteropV02FailureReason =
  | "invalid_json"
  | "invalid_receipt"
  | `missing_top_level_field:${string}`
  | `unexpected_top_level_field:${string}`
  | "claim_not_object"
  | `missing_claim_field:${string}`
  | "unsupported_version"
  | "unsupported_receipt_role"
  | "public_key_id_mismatch"
  | "invalid_signature";

export type InteropV02VerificationResult =
  | { ok: true }
  | { ok: false; reason: InteropV02FailureReason };

export type ArtifactAttestationOptions = {
  actionType: string;
  receiptRole?: InteropV02ReceiptRole;
  status?: string;
  eventId?: string;
  timestamp?: string;
};

export type ArtifactAttestationVerificationResult =
  | {
      ok: true;
      sha256: string;
      bytes: number;
      eventId: string;
      actionType: string;
      status: string;
      receiptRole: InteropV02ReceiptRole;
      publicKeyId: string;
    }
  | {
      ok: false;
      reason:
        | InteropV02FailureReason
        | "invalid_artifact_claim"
        | "artifact_length_mismatch"
        | "artifact_digest_mismatch";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const hasOwn = (value: object, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, field);

function sha256Hex(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertSignableClaim(claim: Record<string, unknown>): asserts claim is InteropV02Claim {
  for (const field of REQUIRED_INTEROP_V02_CLAIM_FIELDS) {
    if (!hasOwn(claim, field)) {
      throw new TypeError(`Missing required v0.2 claim field: ${field}`);
    }
  }
  if (claim.receipt_version !== "0.2") {
    throw new TypeError('receipt_version must be exactly "0.2"');
  }
  if (claim.receipt_role !== "client_observed" && claim.receipt_role !== "server_attested") {
    throw new TypeError('receipt_role must be "client_observed" or "server_attested"');
  }
  for (const field of ["event_id", "timestamp", "action_type", "status"] as const) {
    if (typeof claim[field] !== "string" || claim[field].length === 0) {
      throw new TypeError(`${field} must be a non-empty string`);
    }
  }
}

export function interopV02PublicKeyId(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

export function signInteropV02Claim(
  claim: Record<string, unknown>,
  privateKeyPem: string,
): string {
  assertSignableClaim(claim);
  return sign(null, jcsCanonicalBytes(claim), privateKeyPem).toString("base64");
}

export function createInteropV02Receipt(
  claim: Record<string, unknown>,
  privateKeyPem: string,
): InteropV02Receipt {
  assertSignableClaim(claim);
  const publicKeyPem = createPublicKey(privateKeyPem)
    .export({ type: "spki", format: "pem" })
    .toString();

  return {
    claim,
    signature: signInteropV02Claim(claim, privateKeyPem),
    public_key_id: interopV02PublicKeyId(publicKeyPem),
  };
}

export function verifyInteropV02Receipt(
  receiptText: string,
  publicKeyPem: string,
): InteropV02VerificationResult {
  let receipt: unknown;
  try {
    receipt = JSON.parse(receiptText);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (!isRecord(receipt)) return { ok: false, reason: "invalid_receipt" };

  for (const field of TOP_LEVEL_FIELDS) {
    if (!hasOwn(receipt, field)) {
      return { ok: false, reason: `missing_top_level_field:${field}` };
    }
  }
  for (const field of Object.keys(receipt)) {
    if (!(TOP_LEVEL_FIELDS as readonly string[]).includes(field)) {
      return { ok: false, reason: `unexpected_top_level_field:${field}` };
    }
  }

  if (!isRecord(receipt.claim)) return { ok: false, reason: "claim_not_object" };
  if (typeof receipt.signature !== "string" || typeof receipt.public_key_id !== "string") {
    return { ok: false, reason: "invalid_receipt" };
  }

  for (const field of REQUIRED_INTEROP_V02_CLAIM_FIELDS) {
    if (!hasOwn(receipt.claim, field)) {
      return { ok: false, reason: `missing_claim_field:${field}` };
    }
  }

  if (receipt.claim.receipt_version !== "0.2") {
    return { ok: false, reason: "unsupported_version" };
  }
  if (
    receipt.claim.receipt_role !== "client_observed" &&
    receipt.claim.receipt_role !== "server_attested"
  ) {
    return { ok: false, reason: "unsupported_receipt_role" };
  }

  let keyId: string;
  try {
    keyId = interopV02PublicKeyId(publicKeyPem);
  } catch {
    return { ok: false, reason: "public_key_id_mismatch" };
  }
  if (receipt.public_key_id !== keyId) {
    return { ok: false, reason: "public_key_id_mismatch" };
  }

  try {
    return verify(
      null,
      jcsCanonicalBytes(receipt.claim),
      publicKeyPem,
      Buffer.from(receipt.signature, "base64"),
    )
      ? { ok: true }
      : { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}

export function createArtifactAttestationV02(
  artifactBytes: Buffer,
  privateKeyPem: string,
  options: ArtifactAttestationOptions,
): InteropV02Receipt {
  if (!options.actionType) throw new TypeError("actionType is required");

  const claim: InteropV02Claim = {
    receipt_version: "0.2",
    receipt_role: options.receiptRole ?? "server_attested",
    event_id: options.eventId ?? randomUUID(),
    timestamp: options.timestamp ?? new Date().toISOString(),
    action_type: options.actionType,
    status: options.status ?? "exported",
    artifact: {
      representation: "raw_bytes",
      sha256: sha256Hex(artifactBytes),
      bytes: artifactBytes.byteLength,
    },
  };

  return createInteropV02Receipt(claim, privateKeyPem);
}

export function verifyArtifactAttestationV02(
  artifactBytes: Buffer,
  receiptText: string,
  expectedPublicKeyPem: string,
): ArtifactAttestationVerificationResult {
  const envelope = verifyInteropV02Receipt(receiptText, expectedPublicKeyPem);
  if (!envelope.ok) return envelope;

  const receipt = JSON.parse(receiptText) as InteropV02Receipt;
  const artifact = receipt.claim.artifact;
  if (
    !isRecord(artifact) ||
    artifact.representation !== "raw_bytes" ||
    typeof artifact.sha256 !== "string" ||
    !Number.isSafeInteger(artifact.bytes) ||
    (artifact.bytes as number) < 0
  ) {
    return { ok: false, reason: "invalid_artifact_claim" };
  }

  if (artifact.bytes !== artifactBytes.byteLength) {
    return { ok: false, reason: "artifact_length_mismatch" };
  }

  const digest = sha256Hex(artifactBytes);
  if (artifact.sha256 !== digest) {
    return { ok: false, reason: "artifact_digest_mismatch" };
  }

  return {
    ok: true,
    sha256: digest,
    bytes: artifactBytes.byteLength,
    eventId: receipt.claim.event_id,
    actionType: receipt.claim.action_type,
    status: receipt.claim.status,
    receiptRole: receipt.claim.receipt_role,
    publicKeyId: receipt.public_key_id,
  };
}
