import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ARTIFACT_FILENAME, createBoundaryAttestClaim, createDeterministicZip, sha256Hex } from "../examples/slicc-transcript-export-v0.2/generate.js";
import { verifySliccExportHandoff } from "../examples/slicc-transcript-export-v0.2/verify.js";
import { interopV02PublicKeyId, signInteropV02Claim } from "../examples/interop-v0.2/verify-receipt.js";

const fixtureDir = resolve("examples", "slicc-transcript-export-v0.2");
const zipBytes = readFileSync(resolve(fixtureDir, "artifact", ARTIFACT_FILENAME));
const receiptText = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
const publicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");
const privateKey = readFileSync(resolve(fixtureDir, "test-only-boundaryattest-private-key.pem"), "utf8");

function signedReceipt(claim: Record<string, unknown>): string {
  return JSON.stringify({ claim, signature: signInteropV02Claim(claim, privateKey), public_key_id: interopV02PublicKeyId(publicKey) });
}

function fixtureClaim(): Record<string, unknown> {
  return structuredClone((JSON.parse(receiptText) as { claim: Record<string, unknown> }).claim);
}

function artifact(claim: Record<string, unknown>): Record<string, unknown> {
  return ((claim.slicc_export as Record<string, unknown>).artifact as Record<string, unknown>);
}

test("valid synthetic SLICC transcript-export fixture succeeds", () => {
  assert.deepEqual(verifySliccExportHandoff(receiptText, zipBytes, publicKey), { ok: true });
  assert.deepEqual(createDeterministicZip(), zipBytes);
});

test("ZIP-byte tampering fails artifact binding", () => {
  assert.deepEqual(verifySliccExportHandoff(receiptText, Buffer.concat([zipBytes, Buffer.from([0])]), publicKey), {
    ok: false, reason: "artifact_byte_length_mismatch",
  });
});

test("wrong independently supplied public key fails key-id verification", () => {
  const wrongKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.deepEqual(verifySliccExportHandoff(receiptText, zipBytes, wrongKey), { ok: false, reason: "public_key_id_mismatch" });
});

test("signed-claim tampering fails signature verification", () => {
  const receipt = JSON.parse(receiptText) as { claim: Record<string, unknown> };
  receipt.claim.status = "tampered";
  assert.deepEqual(verifySliccExportHandoff(JSON.stringify(receipt), zipBytes, publicKey), { ok: false, reason: "invalid_signature" });
});

test("correctly signed wrong ZIP digest fails digest binding", () => {
  const claim = fixtureClaim();
  artifact(claim).sha256 = "0".repeat(64);
  assert.deepEqual(verifySliccExportHandoff(signedReceipt(claim), zipBytes, publicKey), { ok: false, reason: "artifact_digest_mismatch" });
});

test("correctly signed wrong ZIP byte length fails length binding", () => {
  const claim = fixtureClaim();
  artifact(claim).byte_length = zipBytes.length + 1;
  assert.deepEqual(verifySliccExportHandoff(signedReceipt(claim), zipBytes, publicKey), { ok: false, reason: "artifact_byte_length_mismatch" });
});

test("missing slicc_export fails cleanly", () => {
  const claim = fixtureClaim();
  delete claim.slicc_export;
  assert.deepEqual(verifySliccExportHandoff(signedReceipt(claim), zipBytes, publicKey), { ok: false, reason: "invalid_slicc_export_claim" });
});

test("malformed nested SLICC export context fails cleanly", () => {
  const claim = fixtureClaim();
  ((claim.slicc_export as Record<string, unknown>).approval_context as Record<string, unknown>).portable_native_approval_reference = "invented-receipt";
  assert.deepEqual(verifySliccExportHandoff(signedReceipt(claim), zipBytes, publicKey), { ok: false, reason: "invalid_slicc_export_claim" });
});

test("v0.2 envelope and exact raw-byte commitment are reproducible", () => {
  const parsed = JSON.parse(receiptText) as { claim: Record<string, unknown>; signature: string; public_key_id: string };
  assert.deepEqual(Object.keys(parsed).sort(), ["claim", "public_key_id", "signature"]);
  assert.equal(parsed.signature, signInteropV02Claim(parsed.claim, privateKey));
  assert.equal(parsed.public_key_id, interopV02PublicKeyId(publicKey));
  assert.equal(artifact(parsed.claim).representation, "raw_bytes");
  assert.equal(artifact(parsed.claim).byte_length, zipBytes.length);
  assert.equal(artifact(parsed.claim).sha256, sha256Hex(zipBytes));
  assert.deepEqual(createBoundaryAttestClaim(zipBytes), parsed.claim);
  assert.equal(verifySliccExportHandoff.length, 3);
});
