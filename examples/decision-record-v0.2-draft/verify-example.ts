#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyInteropV02Receipt } from "../interop-v0.2/verify-receipt.js";

const DIR = resolve("examples/decision-record-v0.2-draft");
type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function equal(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectTamperFailure(label: string, receipt: JsonRecord, publicKey: string, mutate: (claim: JsonRecord) => void): void {
  const changed = clone(receipt);
  mutate(record(changed.claim, "claim"));
  const result = verifyInteropV02Receipt(JSON.stringify(changed), publicKey);
  if (result.ok || result.reason !== "invalid_signature") throw new Error(`${label} did not fail signature verification`);
  console.log(`PASS tampering with ${label} fails signature verification`);
}

function main(): void {
  const receiptText = readFileSync(resolve(DIR, "sample-receipt.json"), "utf8");
  const publicKey = readFileSync(resolve(DIR, "sample-public-key.pem"), "utf8");
  const verified = verifyInteropV02Receipt(receiptText, publicKey);
  if (!verified.ok) throw new Error(`v0.2 receipt verification failed: ${verified.reason}`);

  const receipt = record(JSON.parse(receiptText), "receipt");
  const claim = record(receipt.claim, "claim");
  const decision = record(claim.decision_record, "decision_record");
  const evidence = record(decision.evidence, "evidence");
  const opened = record(decision.opened, "opened");
  const resolution = record(decision.resolution, "resolution");
  const adjudication = record(decision.adjudication, "adjudication");
  const execution = record(decision.execution_observation, "execution_observation");
  const inputs = array(decision.inputs, "inputs").map((item, index) => record(item, `inputs[${index}]`));
  const options = array(opened.options, "options");
  const dissent = array(resolution.dissent, "dissent");
  const tally = record(resolution.tally, "tally");

  equal("receipt_version", claim.receipt_version, "0.2");
  equal("action_type", claim.action_type, "governance.decision_evidence_exported");
  equal("export status", claim.status, "exported");
  equal("decision mode", decision.mode, "shadow");
  equal("final verdict", resolution.verdict, "deny");
  equal("chosen option", resolution.chosen_option, "deny");
  assert(typeof resolution.reason === "string" && resolution.reason.length > 0, "resolution reason must be preserved");
  equal("allow tally", tally.allow, 1);
  equal("deny tally", tally.deny, 2);
  equal("dissent count", dissent.length, 1);
  const dissentingInput = record(dissent[0], "dissent[0]");
  equal("dissent source", dissentingInput.source, "operations-reviewer-c");
  equal("dissent selection", dissentingInput.selection, "allow");
  assert(typeof dissentingInput.reason === "string" && dissentingInput.reason.length > 0, "dissent reason must be preserved");
  equal("adjudication outcome", adjudication.outcome, "released");
  equal("adjudication path", adjudication.path, "shadow_observation");
  equal("execution state", execution.state, "not_observed");
  equal("execution scope", execution.scope, "exporter_observed_hold_release_only");
  assert(resolution !== adjudication, "resolution and adjudication must be distinct objects");
  assert(resolution.verdict !== adjudication.outcome, "verdict must not be treated as adjudication outcome");
  assert(resolution.verdict === "deny" && execution.state === "not_observed", "DENY must coexist with unknown downstream execution");

  const decisionId = decision.decision_id;
  const digest = evidence.bundle_digest;
  equal("input count", inputs.length, 3);
  const sourceRounds = new Set<string>();
  for (const [index, input] of inputs.entries()) {
    equal(`input ${index} type`, input.type, "vote");
    equal(`input ${index} decision`, input.decision_id, decisionId);
    equal(`input ${index} evidence`, input.evidence_bundle_digest, digest);
    assert(options.includes(input.selection), `input ${index} selection must be in the closed option set`);
    const sourceRound = `${String(input.source)}:${String(input.round)}`;
    assert(!sourceRounds.has(sourceRound), `input ${index} duplicates a source/round`);
    sourceRounds.add(sourceRound);
  }
  for (const option of options) {
    equal(`${String(option)} tally from inputs`, tally[String(option)], inputs.filter((input) => input.selection === option).length);
  }
  equal("adjudication decision", adjudication.decision_id, decisionId);
  const openedAt = Date.parse(String(opened.timestamp));
  const resolvedAt = Date.parse(String(resolution.timestamp));
  const adjudicatedAt = Date.parse(String(adjudication.timestamp));
  assert(inputs.every((input) => Date.parse(String(input.timestamp)) >= openedAt && Date.parse(String(input.timestamp)) <= resolvedAt), "inputs must fall between opening and resolution");
  assert(resolvedAt <= adjudicatedAt && adjudicatedAt <= Date.parse(String(claim.timestamp)), "resolution, adjudication, and export chronology must be preserved");

  console.log("PASS sample-receipt.json: native Interop Profile v0.2 signature verified with expected key");
  console.log("PASS decision semantics: identity, evidence, inputs, resolution, dissent, adjudication, shadow mode, and scoped execution knowledge verified");

  expectTamperFailure("decision input", receipt, publicKey, (c) => {
    const d = record(c.decision_record, "decision_record");
    record(array(d.inputs, "inputs")[0], "input").selection = "allow";
  });
  expectTamperFailure("resolution", receipt, publicKey, (c) => {
    record(record(c.decision_record, "decision_record").resolution, "resolution").verdict = "allow";
  });
  expectTamperFailure("adjudication", receipt, publicKey, (c) => {
    record(record(c.decision_record, "decision_record").adjudication, "adjudication").outcome = "rejected";
  });
  expectTamperFailure("execution observation", receipt, publicKey, (c) => {
    record(record(c.decision_record, "decision_record").execution_observation, "execution").state = "executed";
  });
  console.log("LIMIT: the receipt does not prove source truth, completeness, authorization, policy correctness, adjudication effect, or downstream execution.");
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
