#!/usr/bin/env node

import { createHash, sign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableJson } from "../../src/hash.js";
import { setupKeys } from "../../src/keys.js";
import {
  interopPublicKeyId,
  verifyInteropReceipt,
} from "../interop-v0.1/verify-receipt.js";

const EXAMPLE_DIR = resolve("examples/faf-mcp-handoff-v0.1");
const VERIFICATION_LIMITS = [
  "Does not prove the file or content is correct.",
  "Does not prove the AI action was wise.",
  "Does not prove authorization.",
  "Does not replace Git.",
  "Does not replace FAF context.",
  "Does not replace MCP traces or logs.",
  "Does not prove a business outcome.",
  "Only proves that a specific signer signed a specific claim and the signed claim was not altered.",
] as const;

type FafSurface = "mcp" | "cli";
type FafAction = "write" | "export" | "sync" | "compile" | "handoff";

type FafClaim = {
  receipt_version: "0.1";
  receipt_role: "client_observed";
  event_id: string;
  timestamp: string;
  action_type: string;
  status: "success";
  faf_surface: FafSurface;
  faf_action: FafAction;
  project_ref: string;
  git_ref: string | null;
  git_commit: string | null;
  path: string | null;
  artifact_ref: string | null;
  input_digest: string;
  output_digest: string;
  artifact_hash: string | null;
  parent_receipt: string | null;
  mcp_tool_name: string | null;
  faf_cli_command: string | null;
  signer: { public_key_id: string };
  verification_limits: readonly string[];
};

type Receipt = {
  claim: FafClaim;
  signature: string;
  public_key_id: string;
};

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function receiptDigest(receipt: Receipt): string {
  return digest(receipt);
}

function main(): void {
  const { privateKeyPem, publicKeyPem } = setupKeys();
  const publicKeyId = interopPublicKeyId(publicKeyPem);

  function createReceipt(claim: Omit<FafClaim, "signer" | "verification_limits">): Receipt {
    const signedClaim: FafClaim = {
      ...claim,
      signer: { public_key_id: publicKeyId },
      verification_limits: VERIFICATION_LIMITS,
    };
    return {
      claim: signedClaim,
      signature: sign(null, Buffer.from(stableJson(signedClaim)), privateKeyPem).toString("base64"),
      public_key_id: publicKeyId,
    };
  }

  const writeInput = {
    project_ref: "faf-project:boundaryattest-review",
    path: ".faf/context/project.faf",
    operation: "update_context",
  };
  const writeOutput = {
    path: ".faf/context/project.faf",
    bytes_written: 842,
    content_hash: digest("synthetic FAF context after MCP write"),
  };
  const writeReceipt = createReceipt({
    receipt_version: "0.1",
    receipt_role: "client_observed",
    event_id: "evt_faf_mcp_write_001",
    timestamp: "2026-07-23T18:00:00.000Z",
    action_type: "faf.mcp.write",
    status: "success",
    faf_surface: "mcp",
    faf_action: "write",
    project_ref: "faf-project:boundaryattest-review",
    git_ref: "refs/heads/example/faf-receipts",
    git_commit: null,
    path: ".faf/context/project.faf",
    artifact_ref: null,
    input_digest: digest(writeInput),
    output_digest: digest(writeOutput),
    artifact_hash: writeOutput.content_hash,
    parent_receipt: null,
    mcp_tool_name: "faf.write",
    faf_cli_command: null,
  });

  const exportInput = {
    project_ref: "faf-project:boundaryattest-review",
    source_path: ".faf/context/project.faf",
    format: "fafm",
  };
  const exportOutput = {
    artifact_ref: "file:///workspace/out/review-handoff.fafm",
    content_hash: digest("synthetic exported FAFM handoff"),
  };
  const exportReceipt = createReceipt({
    receipt_version: "0.1",
    receipt_role: "client_observed",
    event_id: "evt_faf_mcp_handoff_002",
    timestamp: "2026-07-23T18:01:00.000Z",
    action_type: "faf.mcp.export_handoff",
    status: "success",
    faf_surface: "mcp",
    faf_action: "handoff",
    project_ref: "faf-project:boundaryattest-review",
    git_ref: "refs/heads/example/faf-receipts",
    git_commit: null,
    path: ".faf/context/project.faf",
    artifact_ref: exportOutput.artifact_ref,
    input_digest: digest(exportInput),
    output_digest: digest(exportOutput),
    artifact_hash: exportOutput.content_hash,
    parent_receipt: receiptDigest(writeReceipt),
    mcp_tool_name: "faf.export",
    faf_cli_command: null,
  });

  const syncInput = {
    project_ref: "faf-project:boundaryattest-review",
    source_ref: exportOutput.artifact_ref,
    preceding_receipt: receiptDigest(exportReceipt),
  };
  const syncOutput = {
    checkpoint: "sync-complete",
    git_commit: "7f4c09bb12d9c43c47ba7d8a8d06cc2800c79084",
  };
  const syncReceipt = createReceipt({
    receipt_version: "0.1",
    receipt_role: "client_observed",
    event_id: "evt_faf_cli_sync_003",
    timestamp: "2026-07-23T18:02:00.000Z",
    action_type: "faf.cli.sync_checkpoint",
    status: "success",
    faf_surface: "cli",
    faf_action: "sync",
    project_ref: "faf-project:boundaryattest-review",
    git_ref: "refs/heads/example/faf-receipts",
    git_commit: syncOutput.git_commit,
    path: null,
    artifact_ref: exportOutput.artifact_ref,
    input_digest: digest(syncInput),
    output_digest: digest(syncOutput),
    artifact_hash: exportOutput.content_hash,
    parent_receipt: receiptDigest(exportReceipt),
    mcp_tool_name: null,
    faf_cli_command: "faf-cli sync --from out/review-handoff.fafm",
  });

  const examples = [
    ["mcp-write-receipt.json", writeReceipt],
    ["mcp-export-handoff-receipt.json", exportReceipt],
    ["faf-cli-sync-checkpoint-receipt.json", syncReceipt],
  ] as const;

  writeFileSync(resolve(EXAMPLE_DIR, "faf-example-public-key.pem"), publicKeyPem);

  for (const [fileName, receipt] of examples) {
    const receiptText = `${JSON.stringify(receipt, null, 2)}\n`;
    writeFileSync(resolve(EXAMPLE_DIR, fileName), receiptText);
    const verification = verifyInteropReceipt(receiptText, publicKeyPem);
    if (!verification.ok) {
      throw new Error(`${fileName}: ${verification.reason}`);
    }
    console.log(`PASS ${fileName}`);
  }

  console.log(`Signer: ${publicKeyId}`);
  console.log("All experimental FAF mapping receipts are signed and verifier-compatible.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}
