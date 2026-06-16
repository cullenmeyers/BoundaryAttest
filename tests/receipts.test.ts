import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("withServerReceipt includes caller metadata in a server_attested receipt", async () => {
  const receiptSink = new MemoryReceiptSink();

  const handler = withServerReceipt({
    agentId: "test-server",
    tool: "calendar.create_event",
    caller: {
      id: "agent:demo-client",
      type: "agent",
      authRef: "local-demo-session",
    },
    receiptSink,
    handler: async (input: { title: string }) => ({ eventId: `event:${input.title}` }),
  });

  await handler({ title: "Project check-in" });
  const receipt = receiptSink.receipts[0];

  assert.ok(receipt);
  assert.equal(receipt.receipt_role, "server_attested");
  assert.equal(receipt.caller_id, "agent:demo-client");
  assert.equal(receipt.caller_type, "agent");
  assert.equal(receipt.caller_auth_ref, "local-demo-session");
  assert.equal(verifyReceipt(receipt), true);
});

test("caller metadata is included in the signed payload", async () => {
  const receiptSink = new MemoryReceiptSink();

  const handler = withServerReceipt({
    agentId: "test-server",
    tool: "email.send",
    caller: {
      id: "human:ada",
      type: "human",
      authRef: "session:123",
    },
    receiptSink,
    handler: async (input: { to: string }) => ({ sentTo: input.to }),
  });

  await handler({ to: "grace@example.com" });
  const receipt = receiptSink.receipts[0];

  assert.ok(receipt);
  assert.equal(verifyReceipt(receipt), true);

  const tamperedReceipt: Receipt = {
    ...receipt,
    caller_id: "human:mallory",
  };

  assert.equal(verifyReceipt(tamperedReceipt), false);
});

test("receipt includes lineage metadata when provided", async () => {
  const receiptSink = new MemoryReceiptSink();

  const wrapped = await withAgentReceipt({
    agentId: "test-client",
    tool: "workflow.execute",
    input: { workflowId: "workflow:123" },
    lineage: {
      ref: "ticket:AR-123",
      type: "ticket",
      hash: "sha256:demo-ticket-hash",
      label: "Approve workflow execution",
    },
    receiptSink,
    run: async () => ({ executed: true }),
  });

  assert.ok(wrapped.receipt);
  assert.equal(wrapped.receipt.lineage_ref, "ticket:AR-123");
  assert.equal(wrapped.receipt.lineage_type, "ticket");
  assert.equal(wrapped.receipt.lineage_hash, "sha256:demo-ticket-hash");
  assert.equal(wrapped.receipt.lineage_label, "Approve workflow execution");
  assert.equal(verifyReceipt(wrapped.receipt), true);
});

test("lineage metadata is included in the signed payload", async () => {
  const receiptSink = new MemoryReceiptSink();

  const handler = withServerReceipt({
    agentId: "test-server",
    tool: "business.record_update",
    lineage: {
      ref: "proposal:demo-001",
      type: "proposal",
      hash: "sha256:demo-proposal-hash",
      label: "Approve fake business record update",
    },
    receiptSink,
    handler: async (input: { recordId: string }) => ({ updatedRecordId: input.recordId }),
  });

  await handler({ recordId: "customer:acme" });
  const receipt = receiptSink.receipts[0];

  assert.ok(receipt);
  assert.equal(verifyReceipt(receipt), true);

  const tamperedReceipt: Receipt = {
    ...receipt,
    lineage_ref: "proposal:tampered",
  };

  assert.equal(verifyReceipt(tamperedReceipt), false);
});

test("lineage type defaults to other when omitted", async () => {
  const receiptSink = new MemoryReceiptSink();

  const wrapped = await withAgentReceipt({
    agentId: "test-client",
    tool: "workflow.execute",
    input: { workflowId: "workflow:456" },
    lineage: {
      ref: "workflow:upstream-456",
    },
    receiptSink,
    run: async () => ({ executed: true }),
  });

  assert.ok(wrapped.receipt);
  assert.equal(wrapped.receipt.lineage_ref, "workflow:upstream-456");
  assert.equal(wrapped.receipt.lineage_type, "other");
  assert.equal("lineage_hash" in wrapped.receipt, false);
  assert.equal("lineage_label" in wrapped.receipt, false);
  assert.equal(verifyReceipt(wrapped.receipt), true);
});

test("withServerReceipt still works without caller metadata", async () => {
  const receiptSink = new MemoryReceiptSink();

  const handler = withServerReceipt({
    agentId: "test-server",
    tool: "math.multiply",
    receiptSink,
    handler: async (input: { a: number; b: number }) => ({ product: input.a * input.b }),
  });

  await handler({ a: 6, b: 7 });
  const receipt = receiptSink.receipts[0];

  assert.ok(receipt);
  assert.equal(receipt.receipt_role, "server_attested");
  assert.equal("caller_id" in receipt, false);
  assert.equal("caller_type" in receipt, false);
  assert.equal("caller_auth_ref" in receipt, false);
  assert.equal(verifyReceipt(receipt), true);
});

test("receipts still work when lineage metadata is missing", async () => {
  const receiptSink = new MemoryReceiptSink();

  const wrapped = await withAgentReceipt({
    agentId: "test-client",
    tool: "client.no_lineage",
    input: { ok: true },
    receiptSink,
    run: async () => ({ ok: true }),
  });

  assert.ok(wrapped.receipt);
  assert.equal("lineage_ref" in wrapped.receipt, false);
  assert.equal("lineage_type" in wrapped.receipt, false);
  assert.equal("lineage_hash" in wrapped.receipt, false);
  assert.equal("lineage_label" in wrapped.receipt, false);
  assert.equal(verifyReceipt(wrapped.receipt), true);
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

test("receipt discovery ignores evidence sidecars next to valid receipts", async () => {
  const wrapped = await withAgentReceipt({
    agentId: "test-client",
    tool: "client.sidecar",
    input: { ok: true },
    run: async () => ({ ok: true }),
  });
  assert.ok(wrapped.receiptPath);

  writeFileSync(
    `${wrapped.receiptPath}.intergrax-evidence.json`,
    `${JSON.stringify({ receipt_id: wrapped.receipt?.receipt_id, boundary_event: { ok: true } })}\n`,
    "utf8",
  );

  const receipts = sortedReceipts(listReceiptPaths());
  const keyMaterial = setupKeys();
  const result = verifyStrictChain(receipts, keyMaterial.publicKeyPem);

  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].receipt.receipt_id, wrapped.receipt?.receipt_id);
  assert.equal(result.intact, true);
});

test("receipt discovery ignores unrelated trace JSON files", async () => {
  const wrapped = await withAgentReceipt({
    agentId: "test-client",
    tool: "client.trace",
    input: { ok: true },
    run: async () => ({ ok: true }),
  });
  assert.ok(wrapped.receiptPath);

  writeFileSync(join("receipts", "intergrax-trace-run_demo.json"), `${JSON.stringify({ trace: true })}\n`, "utf8");

  const receipts = sortedReceipts(listReceiptPaths());
  const keyMaterial = setupKeys();
  const result = verifyStrictChain(receipts, keyMaterial.publicKeyPem);

  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].receipt.receipt_id, wrapped.receipt?.receipt_id);
  assert.equal(result.intact, true);
});

test("receipt discovery still rejects invalid files using the receipt naming convention", () => {
  mkdirSync("receipts", { recursive: true });
  writeFileSync("receipts/01-2026-06-16T00-00-00-000Z-invalid-receipt.json", "{}\n", "utf8");

  assert.throws(() => sortedReceipts(listReceiptPaths()), /Receipt is missing required field: receipt_id/);
});

test("concurrent LocalFileReceiptSink writes form one linear chain", async () => {
  const count = 12;

  await Promise.all(
    Array.from({ length: count }, async (_, index) =>
      withAgentReceipt({
        agentId: "test-client",
        tool: "client.concurrent",
        input: { index },
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, index % 3));
          return { index };
        },
      }),
    ),
  );

  const receipts = sortedReceipts(listReceiptPaths());
  const keyMaterial = setupKeys();
  const result = verifyStrictChain(receipts, keyMaterial.publicKeyPem);
  const previousHashes = receipts.map((item) => item.receipt.previous_receipt_hash);
  const nonNullPreviousHashes = previousHashes.filter((hash): hash is string => hash !== null);

  assert.equal(receipts.length, count);
  assert.equal(result.intact, true);
  assert.equal(previousHashes.filter((hash) => hash === null).length, 1);
  assert.equal(new Set(nonNullPreviousHashes).size, count - 1);
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
