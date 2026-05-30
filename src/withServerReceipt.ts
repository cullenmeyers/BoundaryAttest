import { latestReceiptHash, sortedReceipts } from "./chain.js";
import { hashValue } from "./hash.js";
import { setupKeys } from "./keys.js";
import {
  createSignedReceipt,
  listReceiptPaths,
  type CallerMetadata,
  type LineageMetadata,
  type Receipt,
  type ReceiptPolicy,
} from "./receipts.js";
import { LocalFileReceiptSink, type ReceiptSink, type ReceiptSinkResult } from "./sinks.js";
import type { AgentReceiptErrorDetails, ErrorWithAgentReceipt } from "./withAgentReceipt.js";

export type ServerReceiptDetails = {
  receipt: Receipt;
  receiptPath: string | null;
  sinkResult: ReceiptSinkResult;
};

export type WithServerReceiptOptions<TArgs extends unknown[], TResult> = {
  agentId: string;
  tool: string;
  toolMetadata?: unknown;
  caller?: CallerMetadata;
  lineage?: LineageMetadata;
  receiptPolicy?: ReceiptPolicy;
  receiptSink?: ReceiptSink;
  getReceiptInput?: (...args: TArgs) => unknown;
  onReceipt?: (details: ServerReceiptDetails) => void | Promise<void>;
  handler: (...args: TArgs) => Promise<TResult>;
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

export function withServerReceipt<TArgs extends unknown[], TResult>(
  options: WithServerReceiptOptions<TArgs, TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const receiptPolicy = options.receiptPolicy ?? { mode: "required", reason: "default" };

    if (receiptPolicy.mode === "off") {
      return options.handler(...args);
    }

    const receiptSink = options.receiptSink ?? new LocalFileReceiptSink();
    const receiptInput = options.getReceiptInput ? options.getReceiptInput(...args) : args[0];
    setupKeys();
    const previousReceiptHash =
      receiptSink instanceof LocalFileReceiptSink ? latestReceiptHash(sortedReceipts(listReceiptPaths())) : null;

    try {
      const result = await options.handler(...args);
      const receipt = createSignedReceipt({
        agentId: options.agentId,
        tool: options.tool,
        actionStatus: "executed",
        input: receiptInput,
        output: result,
        toolMetadata: options.toolMetadata,
        caller: options.caller,
        lineage: options.lineage,
        receiptPolicy,
        receiptRole: "server_attested",
        previousReceiptHash,
      });
      const sinkResult = await receiptSink.write(receipt);
      const details = { receipt, receiptPath: sinkResult.receiptPath ?? null, sinkResult };
      await options.onReceipt?.(details);

      return result;
    } catch (error) {
      const receipt = createSignedReceipt({
        agentId: options.agentId,
        tool: options.tool,
        actionStatus: "failed",
        input: receiptInput,
        error: errorFingerprint(error),
        toolMetadata: options.toolMetadata,
        caller: options.caller,
        lineage: options.lineage,
        receiptPolicy,
        receiptRole: "server_attested",
        previousReceiptHash,
      });
      const sinkResult = await receiptSink.write(receipt);
      const details = { receipt, receiptPath: sinkResult.receiptPath ?? null, sinkResult };
      await options.onReceipt?.(details);

      if (error && typeof error === "object") {
        (error as ErrorWithAgentReceipt).agentReceipt = details as AgentReceiptErrorDetails;
      }

      throw error;
    }
  };
}
