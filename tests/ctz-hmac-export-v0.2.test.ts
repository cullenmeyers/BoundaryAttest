import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  createBoundaryAttestClaim,
  createNativeReceipt,
  FIXTURE_HMAC_SECRET,
  sha256Hex,
} from "../examples/ctz-hmac-export-v0.2/generate.js";
import {
  verifyBoundaryExport,
} from "../examples/ctz-hmac-export-v0.2/verify.js";
import { verifyNativeCtzReceipt } from "../examples/ctz-hmac-export-v0.2/verify-native.js";
import {
  interopV02PublicKeyId,
  signInteropV02Claim,
} from "../examples/interop-v0.2/verify-receipt.js";

const fixtureDir = resolve("examples", "ctz-hmac-export-v0.2");
const nativeBytes = readFileSync(resolve(fixtureDir, "ctz-native-receipt.json"));
const artifactBytes = readFileSync(resolve(fixtureDir, "artifact", "report.md"));
const boundaryText = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
const publicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");
const privateKey = readFileSync(resolve(fixtureDir, "test-only-boundaryattest-private-key.pem"), "utf8");

function signedReceiptWithClaim(claim: Record<string, unknown>): string {
  return JSON.stringify({
    claim,
    signature: signInteropV02Claim(claim, privateKey),
    public_key_id: interopV02PublicKeyId(publicKey),
  });
}

test("checked-in CTZ and BoundaryAttest fixture fully matches", () => {
  assert.equal(verifyNativeCtzReceipt(nativeBytes.toString("utf8"), FIXTURE_HMAC_SECRET), true);
  assert.deepEqual(verifyBoundaryExport(boundaryText, nativeBytes, artifactBytes, publicKey), { ok: true });
});

test("native CTZ receipt reproduces the pinned implementation semantics exactly", () => {
  assert.equal(JSON.stringify(createNativeReceipt(), null, 2), nativeBytes.toString("utf8"));
});

test("artifact byte tamper has a deterministic digest failure", () => {
  const changed = Buffer.concat([artifactBytes, Buffer.from("tampered")]);
  assert.deepEqual(verifyBoundaryExport(boundaryText, nativeBytes, changed, publicKey), {
    ok: false,
    reason: "artifact_digest_mismatch",
  });
});

test("frozen native receipt byte tamper has a deterministic digest failure", () => {
  const changed = Buffer.concat([nativeBytes, Buffer.from("\n")]);
  assert.deepEqual(verifyBoundaryExport(boundaryText, changed, artifactBytes, publicKey), {
    ok: false,
    reason: "native_receipt_digest_mismatch",
  });
});

test("mismatched claimed CTZ receipt ID fails after raw-byte digest verification", () => {
  const receipt = JSON.parse(boundaryText) as {
    claim: Record<string, unknown> & { ctz_export: { native_receipt: { receipt_id: string } } };
  };
  receipt.claim.ctz_export.native_receipt.receipt_id = "rcpt_different";
  assert.deepEqual(verifyBoundaryExport(signedReceiptWithClaim(receipt.claim), nativeBytes, artifactBytes, publicKey), {
    ok: false,
    reason: "native_receipt_id_mismatch",
  });
});

test("mismatched claimed CTZ HMAC key ID fails after raw-byte digest verification", () => {
  const receipt = JSON.parse(boundaryText) as {
    claim: Record<string, unknown> & { ctz_export: { native_receipt: { hmac_key_id: string } } };
  };
  receipt.claim.ctz_export.native_receipt.hmac_key_id = "key-different";
  assert.deepEqual(verifyBoundaryExport(signedReceiptWithClaim(receipt.claim), nativeBytes, artifactBytes, publicKey), {
    ok: false,
    reason: "native_hmac_key_id_mismatch",
  });
});

test("BoundaryAttest signed claim tamper fails signature verification", () => {
  const receipt = JSON.parse(boundaryText) as { claim: { status: string } };
  receipt.claim.status = "changed";
  assert.deepEqual(verifyBoundaryExport(JSON.stringify(receipt), nativeBytes, artifactBytes, publicKey), {
    ok: false,
    reason: "invalid_signature",
  });
});

test("wrong independently supplied BoundaryAttest public key fails key-id verification", () => {
  const wrongKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.deepEqual(verifyBoundaryExport(boundaryText, nativeBytes, artifactBytes, wrongKey), {
    ok: false,
    reason: "public_key_id_mismatch",
  });
});

test("native CTZ receipt body tamper fails native HMAC verification", () => {
  const receipt = JSON.parse(nativeBytes.toString("utf8")) as { receipt: { status: string } };
  receipt.receipt.status = "changed";
  assert.equal(verifyNativeCtzReceipt(JSON.stringify(receipt), FIXTURE_HMAC_SECRET), false);
});

test("v0.2 envelope is strict, JCS-signed, and binds exact raw bytes", () => {
  const receipt = JSON.parse(boundaryText) as {
    claim: ReturnType<typeof createBoundaryAttestClaim> & { ctz_export: { native_receipt: { sha256: string; representation: string }; artifact: { sha256: string; representation: string } } };
    signature: string;
    public_key_id: string;
  };
  assert.deepEqual(Object.keys(receipt).sort(), ["claim", "public_key_id", "signature"]);
  assert.equal(receipt.claim.receipt_version, "0.2");
  assert.equal(receipt.claim.receipt_role, "server_attested");
  assert.equal(receipt.signature, signInteropV02Claim(receipt.claim, privateKey));
  assert.equal(receipt.public_key_id, interopV02PublicKeyId(publicKey));
  assert.equal(receipt.claim.ctz_export.native_receipt.representation, "raw_bytes");
  assert.equal(receipt.claim.ctz_export.native_receipt.sha256, sha256Hex(nativeBytes));
  assert.equal(receipt.claim.ctz_export.artifact.representation, "raw_bytes");
  assert.equal(receipt.claim.ctz_export.artifact.sha256, sha256Hex(artifactBytes));
  assert.equal(createPublicKey(createPrivateKey(privateKey)).export({ type: "spki", format: "pem" }).toString(), publicKey);
});

test("external verifier has no HMAC secret parameter", () => {
  assert.equal(verifyBoundaryExport.length, 4);
  assert.deepEqual(verifyBoundaryExport(boundaryText, nativeBytes, artifactBytes, publicKey), { ok: true });
});
