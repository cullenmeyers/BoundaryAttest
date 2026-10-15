import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ARTIFACT_FILENAME, createBoundaryAttestClaim, createDeterministicZip, createSyntheticEvidenceManifest, createSyntheticReleaseReport, sha256Hex } from "../examples/shipframe-release-handoff-v0.2/generate.js";
import { verifyShipFrameReleaseHandoff } from "../examples/shipframe-release-handoff-v0.2/verify.js";
import { interopV02PublicKeyId, signInteropV02Claim } from "../examples/interop-v0.2/verify-receipt.js";

const fixtureDir = resolve("examples", "shipframe-release-handoff-v0.2");
const packageBytes = readFileSync(resolve(fixtureDir, "package", ARTIFACT_FILENAME));
const receiptText = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
const publicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");
const privateKey = readFileSync(resolve(fixtureDir, "test-only-boundaryattest-private-key.pem"), "utf8");

function fixtureClaim(): Record<string, unknown> {
  return structuredClone((JSON.parse(receiptText) as { claim: Record<string, unknown> }).claim);
}

function artifact(claim: Record<string, unknown>): Record<string, unknown> {
  return ((claim.shipframe_export as Record<string, unknown>).artifact as Record<string, unknown>);
}

function signedReceipt(claim: Record<string, unknown>, keyId = interopV02PublicKeyId(publicKey)): string {
  return JSON.stringify({ claim, signature: signInteropV02Claim(claim, privateKey), public_key_id: keyId });
}

test("valid synthetic ShipFrame-style release handoff passes", () => {
  assert.deepEqual(verifyShipFrameReleaseHandoff(receiptText, packageBytes, publicKey), { ok: true });
  assert.deepEqual(createDeterministicZip(), packageBytes);
});

test("one-byte package tampering fails", () => {
  const tampered = Buffer.from(packageBytes);
  tampered[40] ^= 1;
  assert.deepEqual(verifyShipFrameReleaseHandoff(receiptText, tampered, publicKey), { ok: false, reason: "artifact_digest_mismatch" });
});

test("changed release report in rebuilt package fails original digest binding", () => {
  const report = createSyntheticReleaseReport().replace("homepage synthetic smoke: PASS", "homepage synthetic smoke: FAIL");
  assert.equal(Buffer.byteLength(report), Buffer.byteLength(createSyntheticReleaseReport()));
  const rebuilt = createDeterministicZip({ releaseReport: report });
  assert.deepEqual(verifyShipFrameReleaseHandoff(receiptText, rebuilt, publicKey), { ok: false, reason: "artifact_digest_mismatch" });
});

test("changed evidence manifest in same-length rebuilt package fails original digest binding", () => {
  const manifest = createSyntheticEvidenceManifest().replace("observed", "altered!");
  assert.equal(Buffer.byteLength(manifest), Buffer.byteLength(createSyntheticEvidenceManifest()));
  const rebuilt = createDeterministicZip({ evidenceManifest: manifest });
  assert.deepEqual(verifyShipFrameReleaseHandoff(receiptText, rebuilt, publicKey), { ok: false, reason: "artifact_digest_mismatch" });
});

test("wrong independently supplied public key fails", () => {
  const wrongKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.deepEqual(verifyShipFrameReleaseHandoff(receiptText, packageBytes, wrongKey), { ok: false, reason: "public_key_id_mismatch" });
});

test("unsigned receipt claim tampering fails signature verification", () => {
  const receipt = JSON.parse(receiptText) as { claim: Record<string, unknown> };
  receipt.claim.status = "tampered";
  assert.deepEqual(verifyShipFrameReleaseHandoff(JSON.stringify(receipt), packageBytes, publicKey), { ok: false, reason: "invalid_signature" });
});

test("correctly signed wrong artifact digest fails artifact verification", () => {
  const claim = fixtureClaim();
  artifact(claim).sha256 = "0".repeat(64);
  assert.deepEqual(verifyShipFrameReleaseHandoff(signedReceipt(claim), packageBytes, publicKey), { ok: false, reason: "artifact_digest_mismatch" });
});

test("correctly signed wrong byte length fails", () => {
  const claim = fixtureClaim();
  artifact(claim).byte_length = packageBytes.length + 1;
  assert.deepEqual(verifyShipFrameReleaseHandoff(signedReceipt(claim), packageBytes, publicKey), { ok: false, reason: "artifact_byte_length_mismatch" });
});

test("missing and malformed shipframe_export fields fail closed", () => {
  const missing = fixtureClaim();
  delete missing.shipframe_export;
  assert.deepEqual(verifyShipFrameReleaseHandoff(signedReceipt(missing), packageBytes, publicKey), { ok: false, reason: "invalid_shipframe_export_claim" });
  const malformed = fixtureClaim();
  ((malformed.shipframe_export as Record<string, unknown>).time_semantics as Record<string, unknown>).independently_witnessed = true;
  assert.deepEqual(verifyShipFrameReleaseHandoff(signedReceipt(malformed), packageBytes, publicKey), { ok: false, reason: "invalid_shipframe_export_claim" });
});

test("a bundled key cannot establish trust by itself", () => {
  const attacker = generateKeyPairSync("ed25519");
  const attackerPrivate = attacker.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const attackerPublic = attacker.publicKey.export({ type: "spki", format: "pem" }).toString();
  const claim = fixtureClaim();
  const attackerReceipt = JSON.stringify({
    claim,
    signature: signInteropV02Claim(claim, attackerPrivate),
    public_key_id: interopV02PublicKeyId(attackerPublic),
  });
  assert.deepEqual(verifyShipFrameReleaseHandoff(attackerReceipt, packageBytes, publicKey), { ok: false, reason: "public_key_id_mismatch" });
});

test("fixture envelope and exact raw-byte commitment are reproducible", () => {
  const parsed = JSON.parse(receiptText) as { claim: Record<string, unknown>; signature: string; public_key_id: string };
  assert.deepEqual(Object.keys(parsed).sort(), ["claim", "public_key_id", "signature"]);
  assert.equal(parsed.signature, signInteropV02Claim(parsed.claim, privateKey));
  assert.equal(parsed.public_key_id, interopV02PublicKeyId(publicKey));
  assert.equal(artifact(parsed.claim).byte_length, packageBytes.length);
  assert.equal(artifact(parsed.claim).sha256, sha256Hex(packageBytes));
  assert.deepEqual(createBoundaryAttestClaim(packageBytes), parsed.claim);
  assert.equal(verifyShipFrameReleaseHandoff.length, 3);
});
