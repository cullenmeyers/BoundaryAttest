import { latestReceiptHash, sortedReceipts } from "./chain.js";
import { hashValue } from "./hash.js";
import { setupKeys } from "./keys.js";
import { createSignedReceipt, listReceiptPaths, writeReceipt, type Receipt } from "./receipts.js";

export type WithAgentReceiptOptions<T> = {
  agentId: string;
  tool: string;
  input: unknown;
  toolMetadata?: unknown;
  run: () => Promise<T>;
};

export type WithAgentReceiptResult<T> = {
  result: T;
  receipt: Receipt;
  receiptPath: string;
};

export type AgentReceiptErrorDetails = {
  receipt: Receipt;
  receiptPath: string;
};

export type ErrorWithAgentReceipt = Error & {
  agentReceipt?: AgentReceiptErrorDetails;
};

function errorFingerprint(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message_hash: hashValue(error.message),
    };
  }

  return {
    thrown_type: typeof error,
    value_hash: hashValue(error),
  };
}

export async function withAgentReceipt<T>(
  options: WithAgentReceiptOptions<T>,
): Promise<WithAgentReceiptResult<T>> {
  setupKeys();
  const previousReceiptHash = latestReceiptHash(sortedReceipts(listReceiptPaths()));

  try {
    const result = await options.run();
    const receipt = createSignedReceipt({
      agentId: options.agentId,
      tool: options.tool,
      actionStatus: "executed",
      input: options.input,
      output: result,
      toolMetadata: options.toolMetadata,
      previousReceiptHash,
    });
    const receiptPath = writeReceipt(receipt);

    return { result, receipt, receiptPath };
  } catch (error) {
    const receipt = createSignedReceipt({
      agentId: options.agentId,
      tool: options.tool,
      actionStatus: "failed",
      input: options.input,
      error: errorFingerprint(error),
      toolMetadata: options.toolMetadata,
      previousReceiptHash,
    });
    const receiptPath = writeReceipt(receipt);

    if (error && typeof error === "object") {
      (error as ErrorWithAgentReceipt).agentReceipt = { receipt, receiptPath };
    }

    throw error;
  }
}
