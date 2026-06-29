#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyInteropReceipt, type FailureReason } from "./verify-receipt.js";

const VECTOR_DIR = resolve("examples/interop-v0.1/test-vectors");

type VectorCase = {
  name: string;
  receiptFile: string;
  publicKeyFile: string;
  expected: "pass" | FailureReason;
};

const CASES: VectorCase[] = [
  {
    name: "valid receipt + public key",
    receiptFile: "valid-receipt.json",
    publicKeyFile: "public-key.pem",
    expected: "pass",
  },
  {
    name: "tampered claim",
    receiptFile: "tampered-claim.json",
    publicKeyFile: "public-key.pem",
    expected: "invalid_signature",
  },
  {
    name: "wrong public key",
    receiptFile: "valid-receipt.json",
    publicKeyFile: "wrong-public-key.pem",
    expected: "public_key_id_mismatch",
  },
  {
    name: "unsupported version",
    receiptFile: "unsupported-version.json",
    publicKeyFile: "public-key.pem",
    expected: "unsupported_version",
  },
  {
    name: "unsupported receipt role",
    receiptFile: "unsupported-receipt-role.json",
    publicKeyFile: "public-key.pem",
    expected: "unsupported_receipt_role",
  },
  {
    name: "missing required field",
    receiptFile: "missing-required-field.json",
    publicKeyFile: "public-key.pem",
    expected: "missing_claim_field:status",
  },
];

function main(): void {
  let allMatched = true;
  console.log("BoundaryAttest Interop Profile v0.1 test vectors");

  for (const vector of CASES) {
    const receiptText = readFileSync(resolve(VECTOR_DIR, vector.receiptFile), "utf8");
    const publicKeyPem = readFileSync(resolve(VECTOR_DIR, vector.publicKeyFile), "utf8");
    const result = verifyInteropReceipt(receiptText, publicKeyPem);
    const actual = result.ok ? "pass" : result.reason;
    const matched = actual === vector.expected;
    allMatched &&= matched;
    console.log(`${matched ? "PASS" : "FAIL"} ${vector.name}: expected ${vector.expected}, got ${actual}`);
  }

  if (!allMatched) {
    process.exitCode = 1;
  }
}

main();
