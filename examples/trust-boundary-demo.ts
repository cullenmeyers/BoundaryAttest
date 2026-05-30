import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { hashValue } from "../src/hash.js";
import { withServerReceipt, type CallerMetadata, type LineageMetadata, type ServerReceiptDetails } from "../src/public.js";

type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

type CallToolResultWithStructuredContent = {
  structuredContent?: unknown;
};

const demoCaller: CallerMetadata = {
  id: "agent:demo-client",
  type: "agent",
  authRef: "local-demo-session",
};

const demoReceiptPolicy = {
  mode: "required" as const,
  reason: "trust-boundary demo action",
};

const fakeProposal = {
  id: "proposal:demo-001",
  title: "Approve fake business record update",
  requestedAction: "business.record_update",
  proposedBy: "agent:demo-client",
  targetRecord: "customer:acme",
};

const demoLineage: LineageMetadata = {
  ref: fakeProposal.id,
  type: "proposal",
  label: fakeProposal.title,
  hash: hashValue(fakeProposal),
};

function createLocalMcpServer(receipts: Map<string, ServerReceiptDetails>): McpServer {
  const server = new McpServer({
    name: "agentreceipt-trust-boundary-demo",
    version: "0.1.0",
  });

  const businessRecords = new Map<string, { status: string; owner: string }>([
    ["customer:acme", { status: "review_needed", owner: "ops-demo" }],
  ]);
  const publishedDocuments = new Map<string, { version: number; title: string }>([
    ["record:policy-brief", { version: 2, title: "Demo Policy Brief" }],
  ]);
  const orderHolds = new Map<string, { orderId: string; reason: string; heldBy: string }>();

  server.registerTool(
    "business.record_update",
    {
      description: "Update a fake in-memory business record.",
      inputSchema: {
        recordId: z.string(),
        status: z.string(),
        note: z.string(),
      },
      outputSchema: {
        recordId: z.string(),
        previousStatus: z.string(),
        newStatus: z.string(),
        changeId: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    withServerReceipt({
      agentId: "demo-trust-boundary-server",
      tool: "business.record_update",
      caller: demoCaller,
      lineage: demoLineage,
      receiptPolicy: demoReceiptPolicy,
      onReceipt: (details) => {
        receipts.set("business.record_update", details);
      },
      handler: async ({ recordId, status }) => {
        const existing = businessRecords.get(recordId) ?? { status: "unknown", owner: "ops-demo" };
        businessRecords.set(recordId, { ...existing, status });
        const structuredContent = {
          recordId,
          previousStatus: existing.status,
          newStatus: status,
          changeId: `fake-change-${businessRecords.size}`,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
          structuredContent,
        };
      },
    }),
  );

  server.registerTool(
    "documents.publish_record",
    {
      description: "Publish a fake in-memory document record.",
      inputSchema: {
        documentId: z.string(),
        audience: z.string(),
        summary: z.string(),
      },
      outputSchema: {
        documentId: z.string(),
        title: z.string(),
        publishedVersion: z.number(),
        publicationId: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    withServerReceipt({
      agentId: "demo-trust-boundary-server",
      tool: "documents.publish_record",
      caller: demoCaller,
      receiptPolicy: demoReceiptPolicy,
      onReceipt: (details) => {
        receipts.set("documents.publish_record", details);
      },
      handler: async ({ documentId }) => {
        const document = publishedDocuments.get(documentId) ?? { version: 0, title: "Untitled Demo Record" };
        const nextVersion = document.version + 1;
        publishedDocuments.set(documentId, { ...document, version: nextVersion });
        const structuredContent = {
          documentId,
          title: document.title,
          publishedVersion: nextVersion,
          publicationId: `fake-publication-${nextVersion}`,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
          structuredContent,
        };
      },
    }),
  );

  server.registerTool(
    "commerce.create_order_hold",
    {
      description: "Create a fake in-memory order hold.",
      inputSchema: {
        orderId: z.string(),
        reason: z.string(),
        requestedBy: z.string(),
      },
      outputSchema: {
        holdId: z.string(),
        orderId: z.string(),
        status: z.string(),
        reason: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    withServerReceipt({
      agentId: "demo-trust-boundary-server",
      tool: "commerce.create_order_hold",
      caller: demoCaller,
      receiptPolicy: demoReceiptPolicy,
      onReceipt: (details) => {
        receipts.set("commerce.create_order_hold", details);
      },
      handler: async ({ orderId, reason, requestedBy }) => {
        const holdId = `fake-hold-${orderHolds.size + 1}`;
        orderHolds.set(holdId, { orderId, reason, heldBy: requestedBy });
        const structuredContent = {
          holdId,
          orderId,
          status: "held",
          reason,
        };

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
    name: "agentreceipt-trust-boundary-demo-client",
    version: "0.1.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    console.log("Normal logs can show what happened inside one system.");
    console.log("AgentReceipt creates a signed, portable receipt for actions that may need to be verified later.");

    const calls: ToolCall[] = [
      {
        name: "business.record_update",
        arguments: {
          recordId: "customer:acme",
          status: "approved_for_followup",
          note: "Fake local update for trust-boundary positioning.",
        },
      },
      {
        name: "documents.publish_record",
        arguments: {
          documentId: "record:policy-brief",
          audience: "internal-demo",
          summary: "Fake local publication event.",
        },
      },
      {
        name: "commerce.create_order_hold",
        arguments: {
          orderId: "order:demo-1001",
          reason: "Fake local dispute review hold.",
          requestedBy: "agent:demo-client",
        },
      },
    ];

    for (const call of calls) {
      const result = (await client.callTool(call)) as CallToolResultWithStructuredContent;
      const receipt = receipts.get(call.name);

      console.log("");
      console.log(`Tool: ${call.name}`);
      console.log("Fake result:");
      console.log(JSON.stringify(result.structuredContent ?? result, null, 2));
      console.log(`caller_id: ${receipt?.receipt.caller_id ?? "none"}`);
      console.log(`receipt role: ${receipt?.receipt.receipt_role ?? "none"}`);
      console.log(`receipt policy reason: ${receipt?.receipt.receipt_policy?.reason ?? "none"}`);
      console.log(`lineage_ref: ${receipt?.receipt.lineage_ref ?? "none"}`);
      console.log(`lineage_type: ${receipt?.receipt.lineage_type ?? "none"}`);
      console.log(`receipt path: ${receipt?.receiptPath ?? "none"}`);
    }

    console.log("");
    console.log("This demo uses fake local data only.");
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
