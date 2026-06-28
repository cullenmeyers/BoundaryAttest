#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { interopPublicKeyId, verifyInteropReceipt } from "./verify-receipt.js";

const FIXTURE_DIR = resolve("examples/interop-v0.1/external/code-engine-mcp");

type ExpectedResults = {
  public_key_file: string;
  public_key_id: string;
  receipt_dir: string;
  cases: Array<{ receipt: string; expected: "pass" }>;
};

function main(): void {
  const expected = JSON.parse(readFileSync(resolve(FIXTURE_DIR, "expected.json"), "utf8")) as ExpectedResults;
  const publicKeyPem = readFileSync(resolve(FIXTURE_DIR, expected.public_key_file), "utf8");
  const receiptDir = resolve(FIXTURE_DIR, expected.receipt_dir);
  let allMatched = expected.cases.length > 0;
  const actualPublicKeyId = interopPublicKeyId(publicKeyPem);

  console.log(`Code Engine MCP reverse interop (${expected.public_key_id})`);

  if (actualPublicKeyId !== expected.public_key_id) {
    console.error(`FAIL public key fingerprint: expected ${expected.public_key_id}, got ${actualPublicKeyId}`);
    process.exitCode = 1;
    return;
  }

  for (const testCase of expected.cases) {
    const receiptText = readFileSync(resolve(receiptDir, testCase.receipt), "utf8");
    const result = verifyInteropReceipt(receiptText, publicKeyPem);
    const actual = result.ok ? "pass" : result.reason;
    const matched = actual === testCase.expected;
    allMatched &&= matched;
    console.log(`${matched ? "PASS" : "FAIL"} ${testCase.receipt}: expected ${testCase.expected}, got ${actual}`);
  }

  if (!allMatched) {
    process.exitCode = 1;
  }
}

main();
