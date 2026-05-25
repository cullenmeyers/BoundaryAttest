import { sign, verify } from "node:crypto";
import { stableJson } from "./hash.js";
import type { Receipt, ReceiptPayload } from "./receipts.js";
import { loadPublicKey } from "./keys.js";

export function signedPayload(receipt: ReceiptPayload): string {
  return stableJson(receipt);
}

export function signReceiptPayload(payload: ReceiptPayload, privateKeyPem: string): string {
  return sign(null, Buffer.from(signedPayload(payload)), privateKeyPem).toString("base64");
}

export function verifyReceipt(receipt: Receipt, publicKeyPem = loadPublicKey()): boolean {
  const { signature, ...payload } = receipt;
  return verify(null, Buffer.from(signedPayload(payload)), publicKeyPem, Buffer.from(signature, "base64"));
}
