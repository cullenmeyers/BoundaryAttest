import { withAgentReceipt } from "./withAgentReceipt.js";
import type { Receipt } from "./receipts.js";

export type McpToolsCallMethod = "tools/call";

export type McpToolsCallRequest = {
  agentId: string;
  method: McpToolsCallMethod;
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type WithMcpReceiptOptions<T> = {
  request: McpToolsCallRequest;
  run: () => Promise<T>;
};

export type WithMcpReceiptResult<T> = {
  mcpResult: T;
  receipt: Receipt;
  receiptPath: string;
};

export async function withMcpReceipt<T>(
  options: WithMcpReceiptOptions<T>,
): Promise<WithMcpReceiptResult<T>> {
  if (options.request.method !== "tools/call") {
    throw new Error(`Unsupported MCP method: ${String(options.request.method)}`);
  }

  const wrapped = await withAgentReceipt({
    agentId: options.request.agentId,
    tool: options.request.params.name,
    input: options.request.params.arguments,
    run: options.run,
  });

  if (!wrapped.receipt || !wrapped.receiptPath) {
    throw new Error("MCP receipt was unexpectedly disabled.");
  }

  return {
    mcpResult: wrapped.result,
    receipt: wrapped.receipt,
    receiptPath: wrapped.receiptPath,
  };
}
