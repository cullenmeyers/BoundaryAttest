import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  createArtifactAttestationV02,
  createInteropV02Receipt,
  verifyArtifactAttestationV02,
  verifyInteropV02Receipt,
} from "../src/interopV02.js";

function keyPair() {
  return generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}

test("v0.2 artifact attestation verifies exact bytes with the independently supplied key", () => {
  const keys = keyPair();
  const artifact = Buffer.from("final delivered bytes\n", "utf8");
  const receipt = createArtifactAttestationV02(artifact, keys.privateKey, {
    actionType: "documents.export",
    eventId: "event:test:1",
    timestamp: "2026-10-29T00:00:00.000Z",
  });

  const result = verifyArtifactAttestationV02(
    artifact,
    JSON.stringify(receipt),
    keys.publicKey,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.actionType, "documents.export");
    assert.equal(result.receiptRole, "server_attested");
    assert.equal(result.bytes, artifact.byteLength);
  }
});

test("v0.2 artifact attestation rejects changed same-length bytes", () => {
  const keys = keyPair();
  const original = Buffer.from("hello world", "utf8");
  const changed = Buffer.from("jello world", "utf8");
  const receipt = createArtifactAttestationV02(original, keys.privateKey, {
    actionType: "artifact.export",
  });

  assert.deepEqual(
    verifyArtifactAttestationV02(changed, JSON.stringify(receipt), keys.publicKey),
    { ok: false, reason: "artifact_digest_mismatch" },
  );
});

test("v0.2 artifact attestation rejects a different expected key", () => {
  const signer = keyPair();
  const other = keyPair();
  const artifact = Buffer.from("evidence", "utf8");
  const receipt = createArtifactAttestationV02(artifact, signer.privateKey, {
    actionType: "artifact.export",
  });

  assert.deepEqual(
    verifyArtifactAttestationV02(artifact, JSON.stringify(receipt), other.publicKey),
    { ok: false, reason: "public_key_id_mismatch" },
  );
});

test("v0.2 generic receipt rejects signed claim tampering", () => {
  const keys = keyPair();
  const receipt = createInteropV02Receipt(
    {
      receipt_version: "0.2",
      receipt_role: "server_attested",
      event_id: "event:test:2",
      timestamp: "2026-10-29T00:00:00.000Z",
      action_type: "artifact.export",
      status: "exported",
    },
    keys.privateKey,
  );

  receipt.claim.status = "tampered";
  assert.deepEqual(verifyInteropV02Receipt(JSON.stringify(receipt), keys.publicKey), {
    ok: false,
    reason: "invalid_signature",
  });
});
