import { withMcpReceipt, type ErrorWithAgentReceipt, type McpToolsCallRequest } from "../src/public.js";

type SimulatedMcpCall = {
  request: McpToolsCallRequest;
  run: () => Promise<unknown>;
};

const calls: SimulatedMcpCall[] = [
  {
    request: {
      agentId: "demo-agent",
      method: "tools/call",
      params: {
        name: "email.draft",
        arguments: {
          to: "client@example.com",
          subject: "Follow up",
        },
      },
    },
    run: async () => ({
      draftId: "draft_mcp_123",
      status: "created",
    }),
  },
  {
    request: {
      agentId: "demo-agent",
      method: "tools/call",
      params: {
        name: "calendar.create_event",
        arguments: {
          title: "Follow-up call",
          startsAt: "2026-05-26T10:00:00-10:00",
        },
      },
    },
    run: async () => ({
      eventId: "event_mcp_123",
      status: "created",
    }),
  },
  {
    request: {
      agentId: "demo-agent",
      method: "tools/call",
      params: {
        name: "file.delete",
        arguments: {
          path: "./local-demo.txt",
        },
      },
    },
    run: async () => {
      throw new Error("Simulated local file delete failure.");
    },
  },
];

async function main(): Promise<void> {
  for (const call of calls) {
    try {
      const wrapped = await withMcpReceipt({
        request: call.request,
        run: call.run,
      });

      console.log(`${call.request.params.name} succeeded`);
      console.log(JSON.stringify(wrapped.mcpResult, null, 2));
      console.log(`Receipt path: ${wrapped.receiptPath}`);
    } catch (error) {
      const failed = error as ErrorWithAgentReceipt;
      console.log(`${call.request.params.name} failed`);
      console.log(`Failed receipt path: ${failed.agentReceipt?.receiptPath ?? "unavailable; check ./receipts/"}`);
    }
  }

  console.log("Run npm run chain to verify the local receipt chain.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
