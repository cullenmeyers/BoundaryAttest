#!/usr/bin/env node

import { resolve } from "node:path";
import { latestReceiptHash, sortedReceipts, verifyRetainedChain, verifyStrictChain, type ChainVerificationResult } from "./chain.js";
import { sha256 } from "./hash.js";
import { loadPublicKey, setupKeys } from "./keys.js";
import {
  createSignedReceipt,
  listReceiptPaths,
  parseReceipt,
  receiptHash,
  writeReceipt,
  type Receipt,
} from "./receipts.js";
import { pruneReceipts } from "./retention.js";
import { verifyReceipt } from "./signing.js";
import { PRIVATE_KEY_PATH, PUBLIC_KEY_PATH } from "./paths.js";

const AGENT_ID = "agentreceipt-demo-agent";

type DemoToolCall = {
  tool: string;
  input: unknown;
  output: unknown;
};

function commandSetup(): void {
  const result = setupKeys();
  console.log(result.created ? "Created local signing key." : "Local signing key already exists.");
  console.log(`Private key: ${PRIVATE_KEY_PATH}`);
  console.log(`Public key:  ${PUBLIC_KEY_PATH}`);
  console.log(`Public key id: ${result.publicKeyId}`);
}

function commandDemo(): void {
  const keyResult = setupKeys();
  const calls: DemoToolCall[] = [
    {
      tool: "email.draft",
      input: { to: "ada@example.com", subject: "Project check-in" },
      output: { draft_id: "draft_local_001", status: "created" },
    },
    {
      tool: "calendar.create_event",
      input: { title: "Project check-in", starts_at: "2026-05-26T10:00:00-10:00" },
      output: { event_id: "event_local_001", status: "created" },
    },
    {
      tool: "file.read",
      input: { path: "./notes/project.txt" },
      output: { bytes: 128, preview_hash: sha256("local demo notes") },
    },
  ];

  let previousHash = latestReceiptHash(sortedReceipts(listReceiptPaths()));
  const created = calls.map((call, index) => {
    const receipt = createSignedReceipt({
      agentId: AGENT_ID,
      tool: call.tool,
      actionStatus: "success",
      input: call.input,
      output: call.output,
      previousReceiptHash: previousHash,
      timestamp: new Date(Date.now() + index).toISOString(),
    });
    const receiptPath = writeReceipt(receipt, index + 1);
    const signatureValid = verifyReceipt(receipt, keyResult.publicKeyPem);
    previousHash = receiptHash(receipt);
    return { receipt, receiptPath, signatureValid, position: index + 1 };
  });

  console.log(keyResult.created ? "Created local signing key." : "Using existing local signing key.");
  console.log("Demo receipts created:");
  for (const item of created) {
    console.log(
      `${item.position}. ${item.receipt.tool} | ${item.receiptPath} | signature ${
        item.signatureValid ? "valid" : "invalid"
      } | chain position ${item.position}/${created.length}`,
    );
  }
}

function commandVerify(receiptPathArg: string | undefined): void {
  if (!receiptPathArg) {
    throw new Error("Usage: npm run verify -- <receiptPath>");
  }

  const receiptPath = resolve(receiptPathArg);
  const receipt = parseReceipt(receiptPath);
  const valid = verifyReceipt(receipt);

  console.log(`Receipt: ${receiptPath}`);
  console.log(`Tool: ${receipt.tool}`);
  console.log(`Signature valid: ${valid ? "yes" : "no"}`);
  console.log(valid ? "Receipt is valid." : "Receipt is NOT valid.");
}

function printChainResult(result: ChainVerificationResult): void {
  result.items.forEach((item, index) => {
    console.log(
      `${index + 1}. ${item.receipt.tool} | ${item.receiptPath} | signature ${
        item.signatureValid ? "valid" : "invalid"
      } | previous link ${item.linkValid ? "valid" : "invalid"}`,
    );
  });
}

function commandChain(): void {
  const publicKeyPem = loadPublicKey();
  const receipts = sortedReceipts(listReceiptPaths());

  if (receipts.length === 0) {
    console.log("No receipts found in ./receipts/.");
    return;
  }

  const result = verifyStrictChain(receipts, publicKeyPem);

  console.log("Receipt chain:");
  printChainResult(result);
  console.log(result.intact ? "Chain is intact." : "Chain is NOT intact.");
  if (!result.intact) {
    process.exitCode = 1;
  }
}

function commandChainRetained(): void {
  const publicKeyPem = loadPublicKey();
  const receipts = sortedReceipts(listReceiptPaths());

  if (receipts.length === 0) {
    console.log("No receipts found in ./receipts/.");
    return;
  }

  const result = verifyRetainedChain(receipts, publicKeyPem);

  console.log("Retained receipt chain segment:");
  printChainResult(result);
  console.log(
    result.intact
      ? "Retained chain segment is intact. Earlier receipts may have been pruned."
      : "Retained chain segment is NOT intact.",
  );
  if (!result.intact) {
    process.exitCode = 1;
  }
}

function commandPrune(): void {
  const result = pruneReceipts();

  console.log("Receipt pruning complete.");
  console.log(`Receipts scanned: ${result.scanned}`);
  console.log(`Receipts deleted by age: ${result.deletedByAge}`);
  console.log(`Receipts deleted by count: ${result.deletedByCount}`);
  console.log(`Receipts retained: ${result.retained}`);
  console.log(`maxAgeDays used: ${result.maxAgeDays}`);
  console.log(`maxCount used: ${result.maxCount}`);
  console.log("WARNING: pruning removes historical chain context. Full historical chain verification may fail.");
}

function main(): void {
  const [command, receiptPath] = process.argv.slice(2);

  try {
    switch (command) {
      case "setup":
        commandSetup();
        break;
      case "demo":
        commandDemo();
        break;
      case "verify":
        commandVerify(receiptPath);
        break;
      case "chain":
        commandChain();
        break;
      case "chain:retained":
        commandChainRetained();
        break;
      case "prune":
        commandPrune();
        break;
      default:
        console.log("BoundaryAttest local CLI");
        console.log("Commands:");
        console.log("  npm run setup");
        console.log("  npm run demo");
        console.log("  npm run verify -- <receiptPath>");
        console.log("  npm run chain");
        console.log("  npm run chain:retained");
        console.log("  npm run prune");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();

export { withAgentReceipt } from "./withAgentReceipt.js";
export type { ErrorWithAgentReceipt, WithAgentReceiptOptions, WithAgentReceiptResult } from "./withAgentReceipt.js";
export { withServerReceipt } from "./withServerReceipt.js";
export type { ServerReceiptDetails, WithServerReceiptOptions } from "./withServerReceipt.js";
export { ConsoleReceiptSink, LocalFileReceiptSink, MemoryReceiptSink } from "./sinks.js";
export type { AgentReceipt, ReceiptSink, ReceiptSinkResult } from "./sinks.js";
export type { CallerMetadata, CallerType, Receipt, ReceiptRole } from "./receipts.js";
