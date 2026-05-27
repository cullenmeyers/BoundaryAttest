import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { latestReceiptHash, sortedReceipts, verifyStrictChain } from "../src/chain.js";
import { hashValue } from "../src/hash.js";
import { setupKeys } from "../src/keys.js";
import { createSignedReceipt, listReceiptPaths, type Receipt, type ReceiptPayload } from "../src/receipts.js";
import { signReceiptPayload, verifyReceipt } from "../src/signing.js";
import { MemoryReceiptSink } from "../src/sinks.js";
import { withAgentReceipt, withServerReceipt, type ServerReceiptDetails } from "../src/public.js";

let originalCwd = process.cwd();
let testDir: string | null = null;

beforeEach(() => {
  originalCwd = process.cwd();
  const baseDir = join(originalCwd, ".tmp-tests");
  mkdirSync(baseDir, { recursive: true });
  testDir = mkdtempSync(join(baseDir, "agentreceipt-"));
  process.chdir(testDir);
});

afterEach(() => {
  process.chdir(originalCwd);

  if (testDir) {
    rmSync(testDir, { recursive: true, force: true });
    testDir = null;
  }
});

test("withServerReceipt creates a signed server_attested success receipt", async () => {
  const receiptSink = new MemoryReceiptSink();
  const observedReceipts: ServerReceiptDetails[] = [];

  const handler = withServerReceipt({
    agentId: "test-server",
    tool: "math.add",
    receiptSink,
    onReceipt: (details) => {
      observedReceipts.push(details);
    },
    handler: async (input: { a: number; b: number }) => ({ sum: input.a + input.b }),
  });

  const result = await handler({ a: 2, b: 40 });
  const receipt = receiptSink.receipts[0];

  assert.deepEqual(result, { sum: 42 });
  assert.ok(receipt);
  assert.equal(observedReceipts[0]?.receipt.receipt_id, receipt.receipt_id);
  assert.equal(receipt.receipt_role, "server_attested");
  assert.equal(receipt.action_status, "executed");
  assert.ok(receipt.input_hash);
  assert.ok(receipt.output_hash);
  assert.equal(receipt.input_hash, hashValue({ a: 2, b: 40 }));
  assert.equal(receipt.output_hash, hashValue({ sum: 42 }));
  assert.equal(verifyReceipt(receipt), true);
});

test("withServerReceipt creates a signed server_attested failed receipt and rethrows", async () => {
  const receiptSink = new MemoryReceiptSink();
  const originalError = new Error("server handler exploded");
  const observedReceipts: ServerReceiptDetails[] = [];

  const handler = withServerReceipt({
    agentId: "test-server",
    tool: "danger.noop",
    receiptSink,
    onReceipt: (details) => {
      observedReceipts.push(details);
    },
    handler: async (_input: { id: string }) => {
      throw originalError;
    },
  });

  await assert.rejects(() => handler({ id: "call-1" }), originalError);

  const receipt = receiptSink.receipts[0];
  assert.ok(receipt);
  assert.equal(observedReceipts[0]?.receipt.receipt_id, receipt.receipt_id);
  assert.equal(receipt.receipt_role, "server_attested");
  assert.equal(receipt.action_status, "failed");
  assert.ok(receipt.error_hash);
  assert.equal(receipt.output_hash, null);
  assert.equal(verifyReceipt(receipt), true);
});

test("withAgentReceipt creates client_observed receipts and preserves existing behavior", async () => {
  const receiptSink = new MemoryReceiptSink();

  const wrapped = await withAgentReceipt({
    agentId: "test-client",
    tool: "client.echo",
    input: { message: "hello" },
    receiptSink,
    run: async () => ({ echoed: "hello" }),
  });

  assert.deepEqual(wrapped.result, { echoed: "hello" });
  assert.ok(wrapped.receipt);
  assert.equal(wrapped.receiptPath, null);
  assert.equal(wrapped.sinkResult?.sinkName, "memory");
  assert.equal(wrapped.receipt.receipt_role, "client_observed");
  assert.equal(wrapped.receipt.action_status, "executed");
  assert.equal(wrapped.receipt.input_hash, hashValue({ message: "hello" }));
  assert.equal(wrapped.receipt.output_hash, hashValue({ echoed: "hello" }));
  assert.equal(verifyReceipt(wrapped.receipt), true);
});

test("legacy receipts without receipt_role still verify", () => {
  const { privateKeyPem } = setupKeys();
  const payload: ReceiptPayload = {
    receipt_id: "legacy-receipt-1",
    agent_id: "legacy-agent",
    tool: "legacy.tool",
    action_status: "executed",
    input_hash: hashValue({ before: "receipt_role" }),
    output_hash: hashValue({ ok: true }),
    timestamp: "2026-05-27T00:00:00.000Z",
    previous_receipt_hash: null,
    public_key_id: "legacy-key-id",
    receipt_policy: { mode: "required", reason: "legacy fixture" },
  };
  const legacyReceipt: Receipt = {
    ...payload,
    signature: signReceiptPayload(payload, privateKeyPem),
  };

  assert.equal("receipt_role" in legacyReceipt, false);
  assert.equal(verifyReceipt(legacyReceipt), true);
});

test("local chain verification passes with mixed client_observed and server_attested receipts", async () => {
  await withAgentReceipt({
    agentId: "test-client",
    tool: "client.echo",
    input: { message: "chain" },
    run: async () => ({ echoed: "chain" }),
  });

  const serverHandler = withServerReceipt({
    agentId: "test-server",
    tool: "server.echo",
    handler: async (input: { message: string }) => ({ echoed: input.message }),
  });
  await serverHandler({ message: "chain" });

  const receipts = sortedReceipts(listReceiptPaths());
  const keyMaterial = setupKeys();
  const result = verifyStrictChain(receipts, keyMaterial.publicKeyPem);

  assert.equal(receipts.length, 2);
  assert.equal(receipts[0].receipt.receipt_role, "client_observed");
  assert.equal(receipts[1].receipt.receipt_role, "server_attested");
  assert.equal(receipts[1].receipt.previous_receipt_hash, latestReceiptHash([receipts[0]]));
  assert.equal(result.intact, true);
});

test("createSignedReceipt defaults new receipts to client_observed", () => {
  const receipt = createSignedReceipt({
    agentId: "test-agent",
    tool: "default.role",
    actionStatus: "executed",
    input: { ok: true },
    output: { ok: true },
    previousReceiptHash: null,
  });

  assert.equal(receipt.receipt_role, "client_observed");
  assert.equal(verifyReceipt(receipt), true);
});
