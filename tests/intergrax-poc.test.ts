import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  compareIntergraxHash,
  createReceiptFromIntergraxEvent,
  mapIntergraxEventToReceiptOptions,
  type IntergraxRunResponse,
} from "../examples/intergrax-poc/adapter.js";
import { hashValue } from "../src/hash.js";
import { verifyReceipt } from "../src/signing.js";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "examples", "intergrax-poc", "fixtures", "poc_run_response.v1.json");
let originalCwd = process.cwd();
let testDir: string | null = null;

function loadFixture(): IntergraxRunResponse {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as IntergraxRunResponse;
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
