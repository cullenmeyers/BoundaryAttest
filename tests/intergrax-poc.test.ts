import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  compareIntergraxHash,
  createReceiptFromIntergraxEvent,
  executionBoundaryEvents,
  mapIntergraxEventToReceiptOptions,
  persistIntergraxRunReceipts,
  type IntergraxRunResponse,
} from "../examples/intergrax-poc/adapter.js";
import { hashValue } from "../src/hash.js";
import { createSignedReceipt, writeReceipt } from "../src/receipts.js";
import { verifyReceipt } from "../src/signing.js";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "examples", "intergrax-poc", "fixtures", "poc_run_response.v2.json");
const failedFixturePath = join(
  repoRoot,
  "examples",
  "intergrax-poc",
  "fixtures",
  "poc_run_response.failed.v2.json",
);
let originalCwd = process.cwd();
let testDir: string | null = null;

function loadFixture(): IntergraxRunResponse {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as IntergraxRunResponse;
}

function loadFailedFixture(): IntergraxRunResponse {
  return JSON.parse(readFileSync(failedFixturePath, "utf8")) as IntergraxRunResponse;
}

function runNodeScript(scriptPath: string, env: NodeJS.ProcessEnv): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, output });
    });
  });
}

beforeEach(() => {
  originalCwd = process.cwd();
  const baseDir = join(originalCwd, ".tmp-tests");
  mkdirSync(baseDir, { recursive: true });
  testDir = mkdtempSync(join(baseDir, "intergrax-poc-"));
  process.chdir(testDir);
});

afterEach(() => {
  process.chdir(originalCwd);

  if (testDir) {
    rmSync(testDir, { recursive: true, force: true });
    testDir = null;
  }
});

test("maps documented execution boundary event into a valid signed receipt", () => {
  const response = loadFixture();
  const event = response.boundary_events?.[0];
  assert.ok(event);

  const { receipt } = createReceiptFromIntergraxEvent(event, response);

  assert.equal(receipt.agent_id, "boundary_demo_agent");
  assert.equal(receipt.tool, "records.put");
  assert.equal(receipt.action_status, "executed");
  assert.equal(receipt.input_hash, hashValue(event.input));
  assert.equal(receipt.output_hash, hashValue(event.output));
  assert.equal(receipt.tool_metadata_hash?.length, 64);
  assert.equal(verifyReceipt(receipt), true);
});

test("creates and independently verifies one receipt per successful v2 boundary event", () => {
  const response = loadFixture();
  const events = executionBoundaryEvents(response);
  const mapped = events.map((event) => createReceiptFromIntergraxEvent(event, response));

  assert.equal(mapped.length, 2);
  assert.deepEqual(events.map((event) => event.event_id), ["event-tool-success", "event-harness-success"]);
  assert.deepEqual(events.map((event) => event.event_sequence), [1, 2]);
  assert.deepEqual(events.map((event) => event.boundary_type), ["tool_execution", "harness_step"]);
  assert.deepEqual(mapped.map(({ receipt }) => receipt.receipt_role), ["client_observed", "client_observed"]);
  assert.deepEqual(mapped.map(({ receipt }) => receipt.tool), ["records.put", "intergrax.harness_step"]);
  assert.deepEqual(mapped.map(({ receipt }) => receipt.action_status), ["executed", "success"]);
  assert.ok(mapped.every(({ receipt }) => verifyReceipt(receipt)));

  for (const [index, { mapping }] of mapped.entries()) {
    assert.equal(mapping.toolMetadata.event_id, events[index].event_id);
    assert.equal(mapping.toolMetadata.source_event_key, events[index].event_id);
    assert.equal(mapping.toolMetadata.event_sequence, events[index].event_sequence);
    assert.equal(mapping.toolMetadata.boundary_type, events[index].boundary_type);
    assert.equal(mapping.hashComparisons.every((comparison) => comparison.status === "match"), true);
  }
});

test("orders boundary events by event_sequence", () => {
  const response = loadFixture();
  response.boundary_events?.reverse();

  assert.deepEqual(executionBoundaryEvents(response).map((event) => event.event_sequence), [1, 2]);
});

test("represents failed tool and completed harness as separate valid claims", () => {
  const response = loadFailedFixture();
  const events = executionBoundaryEvents(response);
  const mapped = events.map((event) => createReceiptFromIntergraxEvent(event, response));

  assert.equal(mapped.length, 2);
  assert.deepEqual(events.map((event) => event.boundary_type), ["tool_execution", "harness_step"]);
  assert.deepEqual(mapped.map(({ receipt }) => receipt.action_status), ["failed", "success"]);
  assert.equal(mapped[0].receipt.error_hash?.length, 64);
  assert.equal(mapped[1].mapping.toolMetadata.source_action_status, "completed");
  assert.ok(mapped.every(({ receipt }) => receipt.receipt_role === "client_observed" && verifyReceipt(receipt)));
});

test("persists stable event identifiers in separate evidence mappings", async () => {
  const persisted = await persistIntergraxRunReceipts(loadFixture());

  assert.equal(persisted.length, 2);
  assert.ok(persisted.every((item) => item.verificationValid));
  const evidence = persisted.map((item) => JSON.parse(readFileSync(item.evidencePath ?? "", "utf8")) as Record<string, unknown>);
  assert.deepEqual(evidence.map((item) => item.event_id), ["event-tool-success", "event-harness-success"]);
  assert.deepEqual(evidence.map((item) => item.event_sequence), [1, 2]);
  assert.deepEqual(evidence.map((item) => item.boundary_type), ["tool_execution", "harness_step"]);
  assert.equal(new Set(evidence.map((item) => item.receipt_id)).size, 2);
});

test("enforces client_observed role for Intergrax PoC receipts", () => {
  const response = loadFixture();
  const event = response.boundary_events?.[0];
  assert.ok(event);

  const mapping = mapIntergraxEventToReceiptOptions(event, response);
  const { receipt } = createReceiptFromIntergraxEvent(event, response);

  assert.equal(mapping.receiptOptions.receiptRole, "client_observed");
  assert.equal(receipt.receipt_role, "client_observed");
});

test("rejects unsupported boundary event schema", () => {
  const response = loadFixture();
  const event = response.boundary_events?.[0];
  assert.ok(event);

  assert.throws(
    () => mapIntergraxEventToReceiptOptions({ ...event, schema_id: "execution_boundary_event.v2" }, response),
    /Unsupported Intergrax boundary event schema/,
  );
});

test("compares BoundaryAttest canonical hashes with Intergrax hashes", () => {
  const value = { b: 2, a: 1 };
  const digest = hashValue(value);

  assert.equal(compareIntergraxHash("input", value, `sha256:${digest}`).status, "match");
  assert.equal(compareIntergraxHash("input", value, "sha256:0000000000000000000000000000000000000000000000000000000000000000").status, "mismatch");

  const fixtureComparison = compareIntergraxHash("input", value, "sha256:<hex>");
  assert.equal(fixtureComparison.status, "not_comparable");
  assert.match(fixtureComparison.reason ?? "", /expected sha256:<64 hex>/);
});

test("sanitized fixture includes matching Intergrax input and output hashes for both events", () => {
  const response = loadFixture();
  const events = executionBoundaryEvents(response);

  assert.equal(events.length, 2);
  for (const event of events) {
    assert.equal(compareIntergraxHash("input", event.input, event.input_hash).status, "match");
    assert.equal(compareIntergraxHash("output", event.output, event.output_hash).status, "match");
  }
});

test("maps Intergrax lineage into receipt lineage fields", () => {
  const response = loadFixture();
  const event = response.boundary_events?.[0];
  assert.ok(event);

  const { receipt } = createReceiptFromIntergraxEvent(event, response);

  assert.equal(receipt.lineage_ref, "run-v2-success:store_demo_record");
  assert.equal(receipt.lineage_type, "execution_record");
});

test("Intergrax example succeeds with existing sidecar and trace JSON in receipts directory", async () => {
  const requestFixture = readFileSync(
    join(repoRoot, "examples", "intergrax-poc", "fixtures", "poc_run_request.v1.json"),
    "utf8",
  );
  const responseFixture = readFileSync(fixturePath, "utf8");
  mkdirSync(join("examples", "intergrax-poc", "fixtures"), { recursive: true });
  writeFileSync(join("examples", "intergrax-poc", "fixtures", "poc_run_request.v1.json"), requestFixture, "utf8");

  const existingReceipt = createSignedReceipt({
    agentId: "existing-agent",
    tool: "existing.tool",
    actionStatus: "executed",
    input: { before: true },
    output: { before: true },
    previousReceiptHash: null,
  });
  const existingReceiptPath = writeReceipt(existingReceipt);
  writeFileSync(
    `${existingReceiptPath}.intergrax-evidence.json`,
    `${JSON.stringify({ receipt_id: existingReceipt.receipt_id, evidence: true })}\n`,
    "utf8",
  );
  writeFileSync(join("receipts", "intergrax-trace-run_demo.json"), `${JSON.stringify({ trace: true })}\n`, "utf8");

  const server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/v1/attestation_demo/poc/run") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(responseFixture);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address() as AddressInfo;
    const result = await runNodeScript(join(repoRoot, "dist", "examples", "intergrax-poc", "run.js"), {
      ...process.env,
      INTERGRAX_BASE_URL: `http://127.0.0.1:${address.port}`,
    });

    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /receipt_count: 2/);
    assert.match(result.output, /verification: valid/);
    assert.match(result.output, /receipt_role: client_observed/);
    assert.match(result.output, /hash_input: match/);
    assert.match(result.output, /hash_output: match/);
    assert.match(result.output, /event_id: event-tool-success/);
    assert.match(result.output, /event_id: event-harness-success/);
    assert.match(result.output, /event_sequence: 1/);
    assert.match(result.output, /event_sequence: 2/);
    assert.match(result.output, /boundary_type: tool_execution/);
    assert.match(result.output, /boundary_type: harness_step/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
