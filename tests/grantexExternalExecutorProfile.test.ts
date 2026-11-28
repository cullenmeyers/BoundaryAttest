import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  createExecutorClaim,
  createExecutorReceipt,
  syntheticGrant,
  syntheticInput,
  syntheticOutput,
  validateGrantexExecutorReceipt,
} from "../examples/grantex-external-executor-v0.1/run.js";

function keys() {
  return generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}

test("Grantex external-executor profile verifies distinct executor claim", () => {
  const keyPair = keys();
  const grant = syntheticGrant();
  const input = syntheticInput();
  const output = syntheticOutput();
  const claim = createExecutorClaim({ grant, input, output });
  const receipt = createExecutorReceipt(claim, keyPair.privateKey, keyPair.publicKey);

  assert.deepEqual(
    validateGrantexExecutorReceipt(JSON.stringify(receipt), keyPair.publicKey, { grant, input, output }),
    { ok: true },
  );
});

test("Grantex external-executor profile rejects changed grant under a valid receipt signature", () => {
  const keyPair = keys();
  const grant = syntheticGrant();
  const input = syntheticInput();
  const output = syntheticOutput();
  const claim = createExecutorClaim({ grant, input, output });
  const receipt = createExecutorReceipt(claim, keyPair.privateKey, keyPair.publicKey);

  const changedGrant = { ...grant, audience: "https://different-executor.example" };

  assert.deepEqual(
    validateGrantexExecutorReceipt(JSON.stringify(receipt), keyPair.publicKey, {
      grant: changedGrant,
      input,
      output,
    }),
    { ok: false, reason: "grant_digest_mismatch" },
  );
});

test("Grantex external-executor profile allows unknown timeout without output claim", () => {
  const keyPair = keys();
  const grant = syntheticGrant();
  const input = syntheticInput();
  const claim = createExecutorClaim({ grant, input, outcome: "unknown" });
  const receipt = createExecutorReceipt(claim, keyPair.privateKey, keyPair.publicKey);

  assert.deepEqual(
    validateGrantexExecutorReceipt(JSON.stringify(receipt), keyPair.publicKey, { grant, input }),
    { ok: true },
  );
});

test("Grantex external-executor profile rejects embedded grant tokens even when correctly signed", () => {
  const keyPair = keys();
  const grant = syntheticGrant();
  const input = syntheticInput();
  const output = syntheticOutput();
  const claim = createExecutorClaim({ grant, input, output });
  const assertion = claim.executor_assertion as Record<string, unknown>;
  const grantRef = assertion.grant as Record<string, unknown>;
  grantRef.token = "must-not-travel";

  const receipt = createExecutorReceipt(claim, keyPair.privateKey, keyPair.publicKey);

  assert.deepEqual(
    validateGrantexExecutorReceipt(JSON.stringify(receipt), keyPair.publicKey, { grant, input, output }),
    { ok: false, reason: "grant_reference_must_not_include_token" },
  );
});
