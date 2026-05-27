import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { withServerReceipt, type ServerReceiptDetails } from "../src/public.js";

type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

function createLocalMcpServer(receipts: Map<string, ServerReceiptDetails>): McpServer {
  const server = new McpServer({
    name: "agentreceipt-local-mcp-server-receipt-demo",
    version: "0.1.0",
  });

  server.registerTool(
    "echo.message",
    {
      description: "Echo a message back to the caller.",
      inputSchema: {
        message: z.string(),
      },
      outputSchema: {
        echoed: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withServerReceipt({
      agentId: "demo-mcp-server",
      tool: "echo.message",
      onReceipt: (details) => {
        receipts.set("echo.message", details);
      },
      handler: async ({ message }) => {
        const structuredContent = { echoed: message };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
          structuredContent,
        };
      },
    }),
  );

  server.registerTool(
    "math.add",
    {
      description: "Add two numbers locally.",
      inputSchema: {
        a: z.number(),
        b: z.number(),
      },
      outputSchema: {
        sum: z.number(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withServerReceipt({
      agentId: "demo-mcp-server",
      tool: "math.add",
      onReceipt: (details) => {
        receipts.set("math.add", details);
      },
      handler: async ({ a, b }) => {
        const structuredContent = { sum: a + b };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
          structuredContent,
        };
      },
    }),
  );

  return server;
}

async function main(): Promise<void> {
  const receipts = new Map<string, ServerReceiptDetails>();
  const server = createLocalMcpServer(receipts);
  const client = new Client({
    name: "agentreceipt-local-mcp-server-receipt-client",
    version: "0.1.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const calls: ToolCall[] = [
      {
        name: "echo.message",
        arguments: {
          message: "hello from server-attested MCP",
        },
      },
      {
        name: "math.add",
        arguments: {
          a: 2,
          b: 40,
        },
      },
    ];

    for (const call of calls) {
      const result = await client.callTool(call);
      const receipt = receipts.get(call.name);

      console.log(`Tool: ${call.name}`);
      console.log("MCP result:");
      console.log(JSON.stringify(result, null, 2));
      console.log(`Server receipt path: ${receipt?.receiptPath ?? "none"}`);
    }

    console.log("Run npm run chain to verify the local receipt chain.");
  } finally {
    await client.close();
    await server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
