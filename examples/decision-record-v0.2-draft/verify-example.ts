#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { jcsCanonicalBytes } from "../../src/jcs.js";
import { signInteropV02Claim, verifyInteropV02Receipt } from "../interop-v0.2/verify-receipt.js";

const DIR = resolve("examples/decision-record-v0.2-draft");
const TEST_PRIVATE_KEY = resolve("examples/interop-v0.2/test-vectors/test-only-private-key.pem");
const EXECUTION_SCOPES = ["shadow_no_hold", "hold_released_downstream_unobserved", "exporter_terminated_before_downstream_observation"] as const;
const CONTROL_EFFECTS = ["blocked", "not_blocked", "unknown"] as const;
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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasOwn(value: JsonRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function parseTimestamp(value: unknown, label: string): number {
  assert(typeof value === "string", `${label} must be a timestamp string`);
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed), `${label} must be a valid timestamp`);
  return parsed;
}

function expectedControlEffect(mode: unknown, outcome: unknown): "blocked" | "not_blocked" | "unknown" {
  if (outcome === "rejected") return "blocked";
  if (outcome === "released") return "not_blocked";
  if (mode === "shadow") return "unknown";
  return "unknown";
}

function validateDecisionSemantics(claim: JsonRecord, evidenceBundle: JsonRecord): void {
  const decision = record(claim.decision_record, "decision_record");
  const subject = record(decision.subject, "subject");
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

  const bundleDigest = `sha256:${createHash("sha256").update(jcsCanonicalBytes(evidenceBundle)).digest("hex")}`;
  equal("evidence bundle digest", evidence.bundle_digest, bundleDigest);
  const bundleSubject = record(evidenceBundle.subject, "evidence bundle subject");
  equal("bundle subject", jcsCanonicalBytes(subject).toString("hex"), jcsCanonicalBytes(bundleSubject).toString("hex"));

  equal("final verdict", resolution.verdict, "deny");
  equal("chosen option", resolution.chosen_option, resolution.verdict);
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
  assert(resolution !== adjudication, "resolution and adjudication must be distinct objects");
  assert(resolution.verdict !== adjudication.outcome, "verdict must not be treated as adjudication outcome");

  assert((CONTROL_EFFECTS as readonly unknown[]).includes(decision.control_effect), "control_effect must use the closed vocabulary");
  equal("derived control effect", decision.control_effect, expectedControlEffect(decision.mode, adjudication.outcome));
  equal("shadow DENY with released hold", decision.control_effect, "not_blocked");
  equal("execution state", execution.state, "not_observed");
  assert((EXECUTION_SCOPES as readonly unknown[]).includes(execution.scope), "execution_observation.scope must use the closed vocabulary");
  equal("execution scope", execution.scope, "hold_released_downstream_unobserved");
  assert(resolution.verdict === "deny" && execution.state === "not_observed", "DENY must coexist with unknown downstream execution");

  const decisionId = decision.decision_id;
  equal("input count", inputs.length, 3);
  const sources = new Set<unknown>();
  for (const [index, input] of inputs.entries()) {
    equal(`input ${index} type`, input.type, "vote");
    equal(`input ${index} decision`, input.decision_id, decisionId);
    assert(!hasOwn(input, "evidence_bundle_digest"), `input ${index} must use the record's single evidence bundle`);
    assert(!hasOwn(input, "confidence"), `input ${index} must omit unused confidence`);
    assert(!hasOwn(input, "round"), `input ${index} must omit undefined round semantics`);
    assert(options.includes(input.selection), `input ${index} selection must be in the closed option set`);
    assert(typeof input.source === "string" && input.source.length > 0, `input ${index} source must be an opaque non-empty reference`);
    assert(!sources.has(input.source), `input ${index} duplicates a source`);
    sources.add(input.source);
  }
  for (const option of options) {
    equal(`${String(option)} tally from inputs`, tally[String(option)], inputs.filter((input) => input.selection === option).length);
  }
  equal("adjudication decision", adjudication.decision_id, decisionId);

  const openedAt = parseTimestamp(opened.timestamp, "opened.timestamp");
  const resolvedAt = parseTimestamp(resolution.timestamp, "resolution.timestamp");
  const adjudicatedAt = parseTimestamp(adjudication.timestamp, "adjudication.timestamp");
  const observedAt = parseTimestamp(execution.timestamp, "execution_observation.timestamp");
  const exportedAt = parseTimestamp(claim.timestamp, "claim.timestamp");
  assert(inputs.every((input, index) => {
    const timestamp = parseTimestamp(input.timestamp, `inputs[${index}].timestamp`);
    return timestamp >= openedAt && timestamp <= resolvedAt;
  }), "inputs must fall between opening and resolution");
  assert(resolvedAt <= adjudicatedAt && adjudicatedAt <= observedAt && observedAt <= exportedAt, "resolution, adjudication, observation, and export chronology must be preserved");
}

function expectSignatureFailure(label: string, receipt: JsonRecord, publicKey: string, mutate: (claim: JsonRecord) => void): void {
  const changed = clone(receipt);
  mutate(record(changed.claim, "claim"));
  const result = verifyInteropV02Receipt(JSON.stringify(changed), publicKey);
  if (result.ok || result.reason !== "invalid_signature") throw new Error(`${label} did not fail signature verification`);
  console.log(`PASS cryptographic failure: tampering with ${label} invalidates the signature`);
}

function expectSemanticFailure(label: string, receipt: JsonRecord, evidenceBundle: JsonRecord, privateKey: string, mutateClaim?: (claim: JsonRecord) => void, mutateBundle?: (bundle: JsonRecord) => void): void {
  const changed = clone(receipt);
  const claim = record(changed.claim, "claim");
  const bundle = clone(evidenceBundle);
  mutateClaim?.(claim);
  mutateBundle?.(bundle);
  changed.signature = signInteropV02Claim(claim, privateKey);
  const publicKey = readFileSync(resolve(DIR, "sample-public-key.pem"), "utf8");
  const verified = verifyInteropV02Receipt(JSON.stringify(changed), publicKey);
  if (!verified.ok) throw new Error(`${label} failed cryptographically instead of semantically: ${verified.reason}`);
  try {
    validateDecisionSemantics(claim, bundle);
  } catch {
    console.log(`PASS semantic failure: valid signature rejected for ${label}`);
    return;
  }
  throw new Error(`${label} did not fail semantic validation`);
}

function main(): void {
  const receiptText = readFileSync(resolve(DIR, "sample-receipt.json"), "utf8");
  const publicKey = readFileSync(resolve(DIR, "sample-public-key.pem"), "utf8");
  const privateKey = readFileSync(TEST_PRIVATE_KEY, "utf8");
  const evidenceBundle = record(JSON.parse(readFileSync(resolve(DIR, "evidence-bundle.json"), "utf8")), "evidence bundle");
  const verified = verifyInteropV02Receipt(receiptText, publicKey);
  if (!verified.ok) throw new Error(`v0.2 receipt verification failed: ${verified.reason}`);

  const receipt = record(JSON.parse(receiptText), "receipt");
  const claim = record(receipt.claim, "claim");
  validateDecisionSemantics(claim, evidenceBundle);
  console.log("PASS sample-receipt.json: native Interop Profile v0.2 signature verified with independently supplied expected key");
  console.log("PASS decision semantics: subject/bundle binding, one-bundle inputs, tally, dissent, chronology, adjudication, control effect, and execution scope verified");

  expectSignatureFailure("decision input", receipt, publicKey, (c) => {
    const d = record(c.decision_record, "decision_record");
    record(array(d.inputs, "inputs")[0], "input").selection = "allow";
  });
  expectSignatureFailure("resolution", receipt, publicKey, (c) => {
    record(record(c.decision_record, "decision_record").resolution, "resolution").verdict = "allow";
  });
  expectSignatureFailure("adjudication", receipt, publicKey, (c) => {
    record(record(c.decision_record, "decision_record").adjudication, "adjudication").outcome = "rejected";
  });
  expectSignatureFailure("execution observation", receipt, publicKey, (c) => {
    record(record(c.decision_record, "decision_record").execution_observation, "execution").state = "executed";
  });

  expectSemanticFailure("invalid execution scope", receipt, evidenceBundle, privateKey, (c) => {
    record(record(c.decision_record, "decision_record").execution_observation, "execution").scope = "free_text_scope";
  });
  expectSemanticFailure("incorrect derived control effect", receipt, evidenceBundle, privateKey, (c) => {
    record(c.decision_record, "decision_record").control_effect = "blocked";
  });
  expectSemanticFailure("changed evidence bundle", receipt, evidenceBundle, privateKey, undefined, (bundle) => {
    record(bundle.evidence_metadata, "evidence_metadata").environment = "staging";
  });
  expectSemanticFailure("subject/evidence-bundle mismatch", receipt, evidenceBundle, privateKey, (c) => {
    record(record(c.decision_record, "decision_record").subject, "subject").action_ref = "tool-call:payments.transfer:request-other";
  });
  expectSemanticFailure("tally mismatch", receipt, evidenceBundle, privateKey, (c) => {
    record(record(record(c.decision_record, "decision_record").resolution, "resolution").tally, "tally").deny = 1;
  });

  console.log("LIMIT: signatures and semantic checks do not prove source truth, completeness, authority, real-time chronology, policy applicability, or downstream execution.");
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
