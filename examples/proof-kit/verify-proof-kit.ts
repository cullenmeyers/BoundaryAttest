#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { receiptHash, parseReceipt, type Receipt } from "../../src/receipts.js";
import { verifyReceipt } from "../../src/signing.js";

const DEMO_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  "proof-kit-demo:a41f66563e585bd7de46f36e": `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAC9xrsLpPdgBljRpWPmnpl7qaHgdkrtWrMisRH0BDzv4=
-----END PUBLIC KEY-----
`,
};

type VerificationItem = {
  path: string;
  receipt: Receipt | null;
  signatureValid: boolean;
  signerKnown: boolean;
  chainLinkValid: boolean | null;
  error: string | null;
};

function defaultReceiptPaths(): string[] {
  const receiptDir = resolve("examples/proof-kit/receipts");
  return readdirSync(receiptDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map((fileName) => join(receiptDir, fileName));
}

function verifyPath(path: string, previousHash: string | null, checkChainLink: boolean): VerificationItem {
  try {
    const receipt = parseReceipt(path);
    const publicKey = DEMO_PUBLIC_KEYS[receipt.public_key_id];
    const signerKnown = publicKey !== undefined;
    const signatureValid = signerKnown ? verifyReceipt(receipt, publicKey) : false;
    const chainLinkValid = checkChainLink ? receipt.previous_receipt_hash === previousHash : null;

    return {
      path,
      receipt,
      signatureValid,
      signerKnown,
      chainLinkValid,
      error: null,
    };
  } catch (error) {
    return {
      path,
      receipt: null,
      signatureValid: false,
      signerKnown: false,
      chainLinkValid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printItem(item: VerificationItem): void {
  console.log(`\nReceipt: ${item.path}`);

  if (item.error !== null || item.receipt === null) {
    console.log(`  JSON/required fields: invalid (${item.error})`);
    return;
  }

  console.log(`  Tool: ${item.receipt.tool}`);
  console.log(`  Receipt role: ${item.receipt.receipt_role ?? "<unset>"}`);
  console.log(
    `  Signer: ${item.receipt.public_key_id} (${
      item.signerKnown ? "known demo signer, demo-only trust" : "unknown signer"
    })`,
  );
  console.log(`  Signature: ${item.signatureValid ? "valid" : "invalid"}`);
  console.log(
    `  Chain link: ${
      item.chainLinkValid === null ? "not checked for a single receipt" : item.chainLinkValid ? "valid" : "invalid"
    }`,
  );
  console.log("  Proves: this demo signer signed this exact receipt payload, and the signed fields are unchanged.");
  console.log("  Does not prove: truth, authorization, compliance, signer trustworthiness, runtime integrity, or outcome.");
}

function main(): void {
  const receiptPaths = process.argv.slice(2).map((path) => resolve(path));
  const paths = receiptPaths.length > 0 ? receiptPaths : defaultReceiptPaths();
  const checkChainLinks = receiptPaths.length !== 1;
  let previousHash: string | null = null;
  let ok = true;

  console.log("BoundaryAttest Proof Kit verifier");
  console.log("Demo-only trust root: one pinned public key embedded in this script.");

  for (const path of paths) {
    const item = verifyPath(path, previousHash, checkChainLinks);
    printItem(item);

    if (
      item.receipt === null ||
      !item.signerKnown ||
      !item.signatureValid ||
      item.chainLinkValid === false
    ) {
      ok = false;
    }

    previousHash = item.receipt === null ? null : receiptHash(item.receipt);
  }

  console.log(`\nResult: ${ok ? "all checked receipts verified" : "one or more receipts failed verification"}`);
  if (!ok) {
    process.exitCode = 1;
  }
}

main();
