#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { jcsCanonicalBytes } from "../../src/jcs.js";
import {
  interopV02PublicKeyId,
  signInteropV02Claim,
  verifyInteropV02Receipt,
} from "../interop-v0.2/verify-receipt.js";

type JsonRecord = Record<string, unknown>;
export type GrantexFixtureResult = { ok: true } | { ok: false; reason: string };

export const PROFILE_ID = "boundaryattest.grantex-executor.v0.1";
export const ACTION_TYPE = "grantex.external_executor_action";

const FIXTURE_DIR = resolve("examples", "grantex-external-executor-v0.1");
const TEST_PRIVATE_KEY = resolve("examples", "interop-v0.2", "test-vectors", "test-only-private-key.pem");
const TEST_PUBLIC_KEY = resolve("examples", "interop-v0.2", "test-vectors", "public-key.pem");

const CHECK_RESULTS = ["verified", "failed", "unknown"] as const;
const REVOCATION_METHODS = ["online", "feed", "offline"] as const;
const OUTCOMES = ["succeeded", "failed", "unknown"] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: JsonRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function sha256Jcs(value: unknown): string {
  return `sha256:${createHash("sha256").update(jcsCanonicalBytes(value)).digest("hex")}`;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isEnumValue<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function syntheticGrant(): JsonRecord {
  return {
    grant_id: "grant-synthetic-001",
    issuer: "did:web:authority.example",
    subject: "did:web:agent.example",
    audience: "https://executor.example",
    permissions: ["invoice.create"],
    caps: { max_amount_usd: 2500 },
    issued_at: "2026-11-27T20:00:00.000Z",
    expires_at: "2026-11-27T22:00:00.000Z",
    fixture_notice: "Synthetic Grantex-style authority artifact; not a real token or grant.",
  };
}

export function syntheticInput(): JsonRecord {
  return {
    invoice_id: "inv-synthetic-001",
    customer_id: "cust-synthetic-001",
    amount_usd: 1250,
  };
}

export function syntheticOutput(): JsonRecord {
  return {
    provider_request_id: "req-synthetic-001",
    invoice_status: "created",
  };
}

export function createExecutorClaim(options: {
  grant?: JsonRecord;
  input?: JsonRecord;
  output?: JsonRecord;
  outcome?: "succeeded" | "failed" | "unknown";
  revocationResult?: "verified" | "failed" | "unknown";
  revocationMethod?: "online" | "feed" | "offline";
  revocationCheckedAt?: string;
} = {}): JsonRecord {
  const grant = options.grant ?? syntheticGrant();
  const input = options.input ?? syntheticInput();
  const output = options.output ?? syntheticOutput();
  const outcome = options.outcome ?? "succeeded";

  const assertion: JsonRecord = {
    profile: PROFILE_ID,
    grant: {
      id: grant.grant_id,
      digest: sha256Jcs(grant),
    },
    authority_checks: {
      grant_signature: "verified",
      audience: "verified",
      permission: "verified",
      caps: "verified",
      revocation: {
        method: options.revocationMethod ?? "online",
        checked_at: options.revocationCheckedAt ?? "2026-11-27T20:15:00.000Z",
        result: options.revocationResult ?? "verified",
      },
    },
    input: {
      digest: sha256Jcs(input),
      representation: "rfc8785_jcs",
    },
    outcome,
  };

  if (outcome !== "unknown") {
    assertion.output = {
      digest: sha256Jcs(output),
      representation: "rfc8785_jcs",
    };
  }

  return {
    receipt_version: "0.2",
    receipt_role: "server_attested",
    event_id: outcome === "unknown" ? "grantex-executor-timeout-synthetic-001" : "grantex-executor-synthetic-001",
    timestamp: "2026-11-27T20:15:01.000Z",
    action_type: ACTION_TYPE,
    status: "recorded",
    executor_assertion: assertion,
  };
}

export function createExecutorReceipt(
  claim: JsonRecord,
  privateKeyPem: string,
  publicKeyPem: string,
): JsonRecord {
  return {
    claim,
    signature: signInteropV02Claim(claim, privateKeyPem),
    public_key_id: interopV02PublicKeyId(publicKeyPem),
  };
}

function validateAuthorityChecks(value: unknown): string | null {
  if (!isRecord(value)) return "invalid_authority_checks";

  for (const field of ["grant_signature", "audience", "permission", "caps"]) {
    if (!isEnumValue(value[field], CHECK_RESULTS)) return "invalid_authority_checks";
  }

  const revocation = value.revocation;
  if (!isRecord(revocation)) return "invalid_revocation_check";
  if (!isEnumValue(revocation.method, REVOCATION_METHODS)) return "invalid_revocation_check";
  if (!isTimestamp(revocation.checked_at)) return "invalid_revocation_check";
  if (!isEnumValue(revocation.result, CHECK_RESULTS)) return "invalid_revocation_check";

  return null;
}

export function validateGrantexExecutorReceipt(
  receiptText: string,
  independentlySuppliedPublicKeyPem: string,
  expected: {
    grant: JsonRecord;
    input: JsonRecord;
    output?: JsonRecord;
  },
): GrantexFixtureResult {
  const signature = verifyInteropV02Receipt(receiptText, independentlySuppliedPublicKeyPem);
  if (!signature.ok) return signature;

  let parsed: unknown;
  try {
    parsed = JSON.parse(receiptText);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (!isRecord(parsed) || !isRecord(parsed.claim)) return { ok: false, reason: "invalid_executor_claim" };
  const claim = parsed.claim;

  if (claim.receipt_role !== "server_attested"
    || claim.action_type !== ACTION_TYPE
    || claim.status !== "recorded") {
    return { ok: false, reason: "invalid_executor_claim" };
  }

  const assertion = claim.executor_assertion;
  if (!isRecord(assertion) || assertion.profile !== PROFILE_ID) {
    return { ok: false, reason: "invalid_executor_claim" };
  }

  const grant = assertion.grant;
  if (!isRecord(grant)) return { ok: false, reason: "invalid_grant_reference" };
  if (hasOwn(grant, "token") || hasOwn(grant, "access_token") || hasOwn(grant, "grant_token")) {
    return { ok: false, reason: "grant_reference_must_not_include_token" };
  }
  if (Object.keys(grant).some((key) => key !== "id" && key !== "digest")) {
    return { ok: false, reason: "invalid_grant_reference" };
  }
  if (grant.id !== expected.grant.grant_id || !isDigest(grant.digest)) {
    return { ok: false, reason: "invalid_grant_reference" };
  }
  if (grant.digest !== sha256Jcs(expected.grant)) {
    return { ok: false, reason: "grant_digest_mismatch" };
  }

  const authorityError = validateAuthorityChecks(assertion.authority_checks);
  if (authorityError) return { ok: false, reason: authorityError };

  const input = assertion.input;
  if (!isRecord(input) || input.representation !== "rfc8785_jcs" || !isDigest(input.digest)) {
    return { ok: false, reason: "invalid_input_binding" };
  }
  if (input.digest !== sha256Jcs(expected.input)) {
    return { ok: false, reason: "input_digest_mismatch" };
  }

  if (!isEnumValue(assertion.outcome, OUTCOMES)) {
    return { ok: false, reason: "invalid_outcome" };
  }

  if (assertion.outcome === "succeeded") {
    if (!isRecord(assertion.output) || assertion.output.representation !== "rfc8785_jcs" || !isDigest(assertion.output.digest)) {
      return { ok: false, reason: "invalid_output_binding" };
    }
    if (!expected.output || assertion.output.digest !== sha256Jcs(expected.output)) {
      return { ok: false, reason: "output_digest_mismatch" };
    }
  }

  if (assertion.outcome === "unknown" && hasOwn(assertion, "output")) {
    return { ok: false, reason: "unknown_outcome_must_not_claim_output" };
  }

  return { ok: true };
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function main(): void {
  const privateKey = readFileSync(TEST_PRIVATE_KEY, "utf8");
  const publicKey = readFileSync(TEST_PUBLIC_KEY, "utf8");
  const grant = syntheticGrant();
  const input = syntheticInput();
  const output = syntheticOutput();

  const claim = createExecutorClaim({ grant, input, output });
  const receipt = createExecutorReceipt(claim, privateKey, publicKey);
  const receiptText = JSON.stringify(receipt);

  const valid = validateGrantexExecutorReceipt(receiptText, publicKey, { grant, input, output });
  expect(valid.ok, `valid synthetic executor receipt failed: ${valid.ok ? "" : valid.reason}`);
  console.log("PASS executor-owned v0.2 receipt verifies with independently supplied expected key");
  console.log("PASS grant is referenced by id + RFC 8785/JCS SHA-256 digest without carrying a token");
  console.log("PASS revocation method/time/result and RFC 8785/JCS input/output bindings validate");

  const changedGrant = clone(grant);
  changedGrant.caps = { max_amount_usd: 100 };
  const wrongGrant = validateGrantexExecutorReceipt(receiptText, publicKey, { grant: changedGrant, input, output });
  expect(!wrongGrant.ok && wrongGrant.reason === "grant_digest_mismatch", "changed grant did not fail the digest binding");
  console.log("PASS changed grant artifact is rejected even though the BoundaryAttest signature is still valid");

  const changedInput = clone(input);
  changedInput.amount_usd = 1251;
  const wrongInput = validateGrantexExecutorReceipt(receiptText, publicKey, { grant, input: changedInput, output });
  expect(!wrongInput.ok && wrongInput.reason === "input_digest_mismatch", "changed input did not fail the digest binding");
  console.log("PASS changed canonical input is rejected");

  const changedOutput = clone(output);
  changedOutput.invoice_status = "rejected";
  const wrongOutput = validateGrantexExecutorReceipt(receiptText, publicKey, { grant, input, output: changedOutput });
  expect(!wrongOutput.ok && wrongOutput.reason === "output_digest_mismatch", "changed output did not fail the digest binding");
  console.log("PASS changed canonical output is rejected");

  const tokenClaim = clone(claim);
  const tokenAssertion = tokenClaim.executor_assertion as JsonRecord;
  const tokenGrant = tokenAssertion.grant as JsonRecord;
  tokenGrant.token = "synthetic-secret-that-must-not-travel";
  const tokenReceipt = createExecutorReceipt(tokenClaim, privateKey, publicKey);
  const tokenResult = validateGrantexExecutorReceipt(JSON.stringify(tokenReceipt), publicKey, { grant, input, output });
  expect(!tokenResult.ok && tokenResult.reason === "grant_reference_must_not_include_token", "embedded token was not rejected");
  console.log("PASS correctly signed receipt is still rejected if it carries a grant token");

  const timeoutClaim = createExecutorClaim({ grant, input, outcome: "unknown", revocationResult: "verified" });
  const timeoutReceipt = createExecutorReceipt(timeoutClaim, privateKey, publicKey);
  const timeoutResult = validateGrantexExecutorReceipt(JSON.stringify(timeoutReceipt), publicKey, { grant, input });
  expect(timeoutResult.ok, `unknown timeout outcome should be valid: ${timeoutResult.ok ? "" : timeoutResult.reason}`);
  console.log("PASS timeout-style outcome=unknown is valid without inventing an output/result claim");

  console.log("LIMIT Grantex remains authoritative for grant semantics; this receipt proves only the executor's signed statement and exact profile bindings.");
  console.log(`Fixture profile: ${PROFILE_ID}`);
  console.log(`Fixture directory: ${FIXTURE_DIR}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
