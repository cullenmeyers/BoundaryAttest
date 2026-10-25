import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CHECKPOINT_FILENAME,
  createBoundaryAttestClaim,
  createNativeCheckpoint,
  FIXTURE_HMAC_SECRET,
  renderNativeCheckpoint,
  sha256Hex,
} from "../examples/judikt-checkpoint-handoff-v0.2/generate.js";
import { verifyJudiktCheckpointHandoff } from "../examples/judikt-checkpoint-handoff-v0.2/verify.js";
import { verifyNativeJudiktCheckpoint } from "../examples/judikt-checkpoint-handoff-v0.2/verify-native.js";
import { interopV02PublicKeyId, signInteropV02Claim } from "../examples/interop-v0.2/verify-receipt.js";

const fixtureDir = resolve("examples", "judikt-checkpoint-handoff-v0.2");
const checkpointBytes = readFileSync(resolve(fixtureDir, CHECKPOINT_FILENAME));
const receiptText = readFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), "utf8");
const publicKey = readFileSync(resolve(fixtureDir, "boundaryattest-public-key.pem"), "utf8");
const privateKey = readFileSync(resolve(fixtureDir, "test-only-boundaryattest-private-key.pem"), "utf8");

function fixtureClaim(): Record<string, unknown> {
  return structuredClone((JSON.parse(receiptText) as { claim: Record<string, unknown> }).claim);
}

function checkpointClaim(claim: Record<string, unknown>): Record<string, unknown> {
  return ((claim.judikt_checkpoint as Record<string, unknown>).checkpoint as Record<string, unknown>);
}

function signedReceipt(claim: Record<string, unknown>): string {
  return JSON.stringify({
    claim,
    signature: signInteropV02Claim(claim, privateKey),
    public_key_id: interopV02PublicKeyId(publicKey),
  });
}

test("checked-in Judikt and BoundaryAttest fixture fully matches", () => {
  assert.equal(verifyNativeJudiktCheckpoint(checkpointBytes.toString("utf8"), FIXTURE_HMAC_SECRET), true);
  assert.deepEqual(verifyJudiktCheckpointHandoff(receiptText, checkpointBytes, publicKey), { ok: true });
});

test("native checkpoint reproduces pinned Judikt signing and export semantics", () => {
  assert.equal(renderNativeCheckpoint(createNativeCheckpoint()), checkpointBytes.toString("utf8"));
});

test("one-byte checkpoint export tamper fails exact-byte binding", () => {
  const changed = Buffer.from(checkpointBytes);
  changed[30] ^= 1;
  assert.deepEqual(verifyJudiktCheckpointHandoff(receiptText, changed, publicKey), {
    ok: false,
    reason: "checkpoint_digest_mismatch",
  });
});

test("an extra trailing newline changes the checkpoint artifact", () => {
  const changed = Buffer.concat([checkpointBytes, Buffer.from("\n")]);
  assert.deepEqual(verifyJudiktCheckpointHandoff(receiptText, changed, publicKey), {
    ok: false,
    reason: "checkpoint_digest_mismatch",
  });
});

test("correctly signed mismatched chain_id fails after raw-byte digest verification", () => {
  const claim = fixtureClaim();
  checkpointClaim(claim).chain_id = "judikt-other-chain";
  assert.deepEqual(verifyJudiktCheckpointHandoff(signedReceipt(claim), checkpointBytes, publicKey), {
    ok: false,
    reason: "checkpoint_chain_id_mismatch",
  });
});

test("correctly signed mismatched seq fails after raw-byte digest verification", () => {
  const claim = fixtureClaim();
  checkpointClaim(claim).seq = 129;
  assert.deepEqual(verifyJudiktCheckpointHandoff(signedReceipt(claim), checkpointBytes, publicKey), {
    ok: false,
    reason: "checkpoint_seq_mismatch",
  });
});

test("correctly signed mismatched head hash fails after raw-byte digest verification", () => {
  const claim = fixtureClaim();
  checkpointClaim(claim).head_hash = "0".repeat(64);
  assert.deepEqual(verifyJudiktCheckpointHandoff(signedReceipt(claim), checkpointBytes, publicKey), {
    ok: false,
    reason: "checkpoint_head_hash_mismatch",
  });
});

test("BoundaryAttest claim tamper fails signature verification", () => {
  const receipt = JSON.parse(receiptText) as { claim: { status: string } };
  receipt.claim.status = "changed";
  assert.deepEqual(verifyJudiktCheckpointHandoff(JSON.stringify(receipt), checkpointBytes, publicKey), {
    ok: false,
    reason: "invalid_signature",
  });
});

test("wrong independently supplied BoundaryAttest public key fails", () => {
  const wrongKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.deepEqual(verifyJudiktCheckpointHandoff(receiptText, checkpointBytes, wrongKey), {
    ok: false,
    reason: "public_key_id_mismatch",
  });
});

test("native checkpoint body tamper fails native HMAC verification", () => {
  const native = JSON.parse(checkpointBytes.toString("utf8")) as { seq: number };
  native.seq += 1;
  assert.equal(verifyNativeJudiktCheckpoint(JSON.stringify(native), FIXTURE_HMAC_SECRET), false);
});

test("fixture envelope and exact raw-byte commitment are reproducible", () => {
  const parsed = JSON.parse(receiptText) as {
    claim: Record<string, unknown>;
    signature: string;
    public_key_id: string;
  };
  assert.deepEqual(Object.keys(parsed).sort(), ["claim", "public_key_id", "signature"]);
  assert.equal(parsed.signature, signInteropV02Claim(parsed.claim, privateKey));
  assert.equal(parsed.public_key_id, interopV02PublicKeyId(publicKey));
  assert.equal(checkpointClaim(parsed.claim).sha256, sha256Hex(checkpointBytes));
  assert.deepEqual(createBoundaryAttestClaim(checkpointBytes), parsed.claim);
});

test("external verifier has no Judikt HMAC secret parameter", () => {
  assert.equal(verifyJudiktCheckpointHandoff.length, 3);
  assert.deepEqual(verifyJudiktCheckpointHandoff(receiptText, checkpointBytes, publicKey), { ok: true });
});
