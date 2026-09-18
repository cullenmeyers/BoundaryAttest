#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyInteropV02Receipt } from "../interop-v0.2/verify-receipt.js";

const fixtureDir = resolve("examples", "ctz-hmac-export-v0.2");

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function verifyBoundaryExport(
  boundaryReceiptText: string,
  nativeReceiptBytes: Buffer,
  artifactBytes: Buffer,
  independentlySuppliedPublicKeyPem: string,
): { ok: true } | { ok: false; reason: string } {
  const signatureResult = verifyInteropV02Receipt(boundaryReceiptText, independentlySuppliedPublicKeyPem);
  if (!signatureResult.ok) return signatureResult;
  const parsed = JSON.parse(boundaryReceiptText) as {
    claim: { ctz_export?: { native_receipt?: { receipt_id?: unknown; hmac_key_id?: unknown; representation?: unknown; sha256?: unknown }; artifact?: { representation?: unknown; sha256?: unknown } } };
  };
  const native = parsed.claim.ctz_export?.native_receipt;
  const artifact = parsed.claim.ctz_export?.artifact;
  if (native?.representation !== "raw_bytes" || artifact?.representation !== "raw_bytes" || typeof native.receipt_id !== "string" || typeof native.hmac_key_id !== "string" || typeof native.sha256 !== "string" || typeof artifact.sha256 !== "string") {
    return { ok: false, reason: "invalid_export_claim" };
  }
  if (native.sha256 !== sha256Hex(nativeReceiptBytes)) return { ok: false, reason: "native_receipt_digest_mismatch" };
  let frozenNative: unknown;
  try {
    frozenNative = JSON.parse(nativeReceiptBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_native_receipt" };
  }
  if (typeof frozenNative !== "object" || frozenNative === null || Array.isArray(frozenNative)) {
    return { ok: false, reason: "invalid_native_receipt" };
  }
  const frozenBody = (frozenNative as Record<string, unknown>).receipt;
  if (typeof frozenBody !== "object" || frozenBody === null || Array.isArray(frozenBody)) {
    return { ok: false, reason: "invalid_native_receipt" };
  }
  const frozenReceiptId = (frozenBody as Record<string, unknown>).receipt_id;
  const frozenSigner = (frozenBody as Record<string, unknown>).signer;
  if (typeof frozenReceiptId !== "string" || typeof frozenSigner !== "object" || frozenSigner === null || Array.isArray(frozenSigner)) {
    return { ok: false, reason: "invalid_native_receipt" };
  }
  const frozenHmacKeyId = (frozenSigner as Record<string, unknown>).key_id;
  if (typeof frozenHmacKeyId !== "string") return { ok: false, reason: "invalid_native_receipt" };
  if (native.receipt_id !== frozenReceiptId) return { ok: false, reason: "native_receipt_id_mismatch" };
  if (native.hmac_key_id !== frozenHmacKeyId) return { ok: false, reason: "native_hmac_key_id_mismatch" };
  if (artifact.sha256 !== sha256Hex(artifactBytes)) return { ok: false, reason: "artifact_digest_mismatch" };
  return { ok: true };
}

function main(): void {
  const nativeBytes = readFileSync(resolve(fixtureDir, "ctz-native-receipt.json"));
  const artifactBytes = readFileSync(resolve(fixtureDir, "artifact", "report.md"));
  const boundaryReceiptText = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
  const expectedPublicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");

  const external = verifyBoundaryExport(boundaryReceiptText, nativeBytes, artifactBytes, expectedPublicKey);
  if (!external.ok) throw new Error(`BoundaryAttest export verification failed: ${external.reason}`);
  console.log("PASS BoundaryAttest signature verified with the independently supplied public key");
  console.log("PASS exact frozen CTZ receipt bytes match the signed digest");
  console.log("PASS claimed CTZ receipt ID and HMAC key ID match the frozen receipt metadata");
  console.log("PASS exact artifact bytes match the signed digest");
  console.log("PASS external verification did not use the CTZ HMAC secret");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
