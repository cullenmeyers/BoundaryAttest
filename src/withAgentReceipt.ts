import { latestReceiptHash, sortedReceipts } from "./chain.js";
import { hashValue } from "./hash.js";
import { setupKeys } from "./keys.js";
import {
  createSignedReceipt,
  listReceiptPaths,
  type LineageMetadata,
  type Receipt,
  type ReceiptPolicy,
} from "./receipts.js";
import { LocalFileReceiptSink, type ReceiptSink, type ReceiptSinkResult } from "./sinks.js";

export type WithAgentReceiptOptions<T> = {
  agentId: string;
  tool: string;
  input: unknown;
  toolMetadata?: unknown;
  lineage?: LineageMetadata;
  receiptPolicy?: ReceiptPolicy;
  receiptSink?: ReceiptSink;
  run: () => Promise<T>;
};

export type WithAgentReceiptResult<T> = {
  result: T;
  receipt: Receipt | null;
  receiptPath: string | null;
  sinkResult: ReceiptSinkResult | null;
};

export type AgentReceiptErrorDetails = {
  receipt: Receipt;
  receiptPath: string | null;
  sinkResult: ReceiptSinkResult;
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
  const receiptPolicy = options.receiptPolicy ?? { mode: "required", reason: "default" };

  if (receiptPolicy.mode === "off") {
    const result = await options.run();
    return { result, receipt: null, receiptPath: null, sinkResult: null };
  }

  const receiptSink = options.receiptSink ?? new LocalFileReceiptSink();
  setupKeys();
  const previousReceiptHash =
    receiptSink instanceof LocalFileReceiptSink ? latestReceiptHash(sortedReceipts(listReceiptPaths())) : null;

  try {
    const result = await options.run();
    const receipt = createSignedReceipt({
      agentId: options.agentId,
      tool: options.tool,
      actionStatus: "executed",
      input: options.input,
      output: result,
      toolMetadata: options.toolMetadata,
      lineage: options.lineage,
      receiptPolicy,
      receiptRole: "client_observed",
      previousReceiptHash,
    });
    const sinkResult = await receiptSink.write(receipt);
    const receiptPath = sinkResult.receiptPath ?? null;

    return { result, receipt, receiptPath, sinkResult };
  } catch (error) {
    const receipt = createSignedReceipt({
      agentId: options.agentId,
      tool: options.tool,
      actionStatus: "failed",
      input: options.input,
      error: errorFingerprint(error),
      toolMetadata: options.toolMetadata,
      lineage: options.lineage,
      receiptPolicy,
      receiptRole: "client_observed",
      previousReceiptHash,
    });
    const sinkResult = await receiptSink.write(receipt);
    const receiptPath = sinkResult.receiptPath ?? null;

    if (error && typeof error === "object") {
      (error as ErrorWithAgentReceipt).agentReceipt = { receipt, receiptPath, sinkResult };
    }

    throw error;
  }
}
