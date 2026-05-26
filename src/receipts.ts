import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashValue, sha256, stableJson } from "./hash.js";
import { ensureDirectories, setupKeys } from "./keys.js";
import { RECEIPT_DIR } from "./paths.js";
import { signReceiptPayload } from "./signing.js";

export type ActionStatus = "success" | "failure" | "executed" | "failed";

export type ReceiptPolicy = {
  mode: "required" | "off";
  reason?: string;
};

export type ReceiptPayload = {
  receipt_id: string;
  agent_id: string;
  tool: string;
  action_status: ActionStatus;
  input_hash: string;
  output_hash: string | null;
  timestamp: string;
  previous_receipt_hash: string | null;
  public_key_id: string;
  error_hash?: string;
  tool_metadata_hash?: string;
  receipt_policy?: ReceiptPolicy;
};

export type Receipt = ReceiptPayload & {
  signature: string;
};

export type CreateReceiptOptions = {
  agentId: string;
  tool: string;
  actionStatus: ActionStatus;
  input: unknown;
  output?: unknown;
  error?: unknown;
  toolMetadata?: unknown;
  receiptPolicy?: ReceiptPolicy;
  previousReceiptHash: string | null;
  timestamp?: string;
};

export function receiptHash(receipt: Receipt): string {
  return sha256(stableJson(receipt));
}

export function createSignedReceipt(options: CreateReceiptOptions): Receipt {
  const { privateKeyPem, publicKeyId } = setupKeys();
  const receiptPolicy = options.receiptPolicy ?? { mode: "required", reason: "default" };
  const payload: ReceiptPayload = {
    receipt_id: randomUUID(),
    agent_id: options.agentId,
    tool: options.tool,
    action_status: options.actionStatus,
    input_hash: hashValue(options.input),
    output_hash: options.output === undefined ? null : hashValue(options.output),
    timestamp: options.timestamp ?? new Date().toISOString(),
    previous_receipt_hash: options.previousReceiptHash,
    public_key_id: publicKeyId,
    receipt_policy: receiptPolicy.reason
      ? { mode: receiptPolicy.mode, reason: receiptPolicy.reason }
      : { mode: receiptPolicy.mode },
  };

  if (options.error !== undefined) {
    payload.error_hash = hashValue(options.error);
  }

  if (options.toolMetadata !== undefined) {
    payload.tool_metadata_hash = hashValue(options.toolMetadata);
  }

  return {
    ...payload,
    signature: signReceiptPayload(payload, privateKeyPem),
  };
}

export function writeReceipt(receipt: Receipt, position?: number): string {
  ensureDirectories();
  const safeTimestamp = receipt.timestamp.replace(/[:.]/g, "-");
  const prefix = String(position ?? listReceiptPaths().length + 1).padStart(2, "0");
  const fileName = `${prefix}-${safeTimestamp}-${receipt.tool.replaceAll(".", "-")}.json`;
  const receiptPath = join(RECEIPT_DIR, fileName);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receiptPath;
}

export function listReceiptPaths(): string[] {
  ensureDirectories();
  return readdirSync(RECEIPT_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => join(RECEIPT_DIR, file));
}

export function parseReceipt(path: string): Receipt {
  const data = JSON.parse(readFileSync(path, "utf8")) as Partial<Receipt>;
  const requiredFields: Array<keyof Receipt> = [
    "receipt_id",
    "agent_id",
    "tool",
    "action_status",
    "input_hash",
    "output_hash",
    "timestamp",
    "previous_receipt_hash",
    "signature",
    "public_key_id",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Receipt is missing required field: ${field}`);
    }
  }

  return data as Receipt;
}
