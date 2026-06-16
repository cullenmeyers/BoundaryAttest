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
  mapIntergraxEventToReceiptOptions,
  type IntergraxRunResponse,
} from "../examples/intergrax-poc/adapter.js";
import { hashValue } from "../src/hash.js";
import { createSignedReceipt, writeReceipt } from "../src/receipts.js";
import { verifyReceipt } from "../src/signing.js";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "examples", "intergrax-poc", "fixtures", "poc_run_response.v1.json");
let originalCwd = process.cwd();
let testDir: string | null = null;

function loadFixture(): IntergraxRunResponse {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as IntergraxRunResponse;
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

test("compares AgentReceipt canonical hashes with Intergrax hashes", () => {
  const value = { b: 2, a: 1 };
  const digest = hashValue(value);

  assert.equal(compareIntergraxHash("input", value, `sha256:${digest}`).status, "match");
  assert.equal(compareIntergraxHash("input", value, "sha256:0000000000000000000000000000000000000000000000000000000000000000").status, "mismatch");

  const fixtureComparison = compareIntergraxHash("input", value, "sha256:<hex>");
  assert.equal(fixtureComparison.status, "not_comparable");
  assert.match(fixtureComparison.reason ?? "", /expected sha256:<64 hex>/);
});

test("sanitized fixture includes matching Intergrax input and output hashes", () => {
  const response = loadFixture();
  const event = response.boundary_events?.[0];
  assert.ok(event);

  assert.equal(compareIntergraxHash("input", event.input, event.input_hash).status, "match");
  assert.equal(compareIntergraxHash("output", event.output, event.output_hash).status, "match");
});

test("maps Intergrax lineage into receipt lineage fields", () => {
  const response = loadFixture();
  const event = response.boundary_events?.[0];
  assert.ok(event);

  const { receipt } = createReceiptFromIntergraxEvent(event, response);

  assert.equal(receipt.lineage_ref, "run-<dynamic>:store_demo_record");
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
    assert.match(result.output, /verification: valid/);
    assert.match(result.output, /receipt_role: client_observed/);
    assert.match(result.output, /hash_input: match/);
    assert.match(result.output, /hash_output: match/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
