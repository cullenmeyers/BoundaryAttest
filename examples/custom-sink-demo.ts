import { withAgentReceipt, type AgentReceipt, type ReceiptSink, type ReceiptSinkResult } from "../src/public.js";

const customSink: ReceiptSink = {
  name: "custom-demo",
  async write(receipt: AgentReceipt): Promise<ReceiptSinkResult> {
    console.log(`Custom sink received receipt: ${receipt.receipt_id}`);
    return {
      receiptPath: null,
      receiptId: receipt.receipt_id,
      sinkName: this.name,
    };
  },
};

async function main(): Promise<void> {
  const wrapped = await withAgentReceipt({
    agentId: "demo-agent",
    tool: "custom.route",
    input: {
      message: "route this receipt through a custom sink",
    },
    receiptSink: customSink,
    run: async () => {
      return {
        routed: true,
      };
    },
  });

  console.log(`Receipt exists: ${wrapped.receipt ? "yes" : "no"}`);
  console.log(`Receipt is signed: ${wrapped.receipt?.signature ? "yes" : "no"}`);
  console.log(`Receipt path: ${wrapped.receiptPath ?? "null (custom sink did not write a local file)"}`);
  console.log(`Sink result: ${wrapped.sinkResult?.sinkName ?? "none"}`);
  console.log("Local chain verification only covers LocalFileReceiptSink receipts.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
