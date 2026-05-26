import { withAgentReceipt, type ErrorWithAgentReceipt } from "../src/public.js";

async function main(): Promise<void> {
  const success = await withAgentReceipt({
    agentId: "demo-agent",
    tool: "email.draft",
    input: {
      to: "client@example.com",
      subject: "Follow up",
    },
    run: async () => {
      return {
        draftId: "draft_123",
        status: "created",
      };
    },
  });

  console.log("Successful result:");
  console.log(JSON.stringify(success.result, null, 2));
  console.log(`Successful receipt path: ${success.receiptPath}`);

  const noisy = await withAgentReceipt({
    agentId: "demo-agent",
    tool: "debug.token_count",
    input: {
      text: "short local demo string",
    },
    receiptPolicy: {
      mode: "off",
      reason: "noisy low-value diagnostic call",
    },
    run: async () => {
      return {
        tokens: 4,
      };
    },
  });

  console.log("Noisy result:");
  console.log(JSON.stringify(noisy.result, null, 2));
  console.log(`Noisy receipt path: ${noisy.receiptPath ?? "none (receiptPolicy.mode off)"}`);

  try {
    await withAgentReceipt({
      agentId: "demo-agent",
      tool: "calendar.create_event",
      input: {
        title: "Follow-up call",
        startsAt: "2026-05-26T10:00:00-10:00",
      },
      run: async () => {
        throw new Error("Calendar provider rejected the local demo event.");
      },
    });
  } catch (error) {
    const failed = error as ErrorWithAgentReceipt;
    console.log(`Failed receipt path: ${failed.agentReceipt?.receiptPath ?? "unavailable"}`);
  }

  console.log("Run npm run chain to verify the local receipt chain.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
