# AgentReceipt

AgentReceipt creates structured, verifiable action records for AI agent/MCP tool calls that cross trust boundaries.

Normal logs and OpenTelemetry are usually enough for internal debugging and monitoring. AgentReceipt is for cases where a portable, signed action record may need to be verified later: multi-agent workflows, org-to-org workflows, delegated agents, business record changes, document publishing, commerce/dispute scenarios, and high-value or hard-to-reverse actions.

When an agent calls a tool, AgentReceipt can:

- hash the input
- run the tool
- hash the output or error
- sign a receipt
- chain the receipt to previous receipts
- verify later that the receipt chain is intact

## Best Conceptual Demo

```sh
npm install
npm run build
npm run example:trust-boundary
```

The trust-boundary demo uses the official MCP TypeScript SDK with local in-memory transport and fake local data. It shows side-effecting business-style actions where a server attests that caller `X` invoked tool `Y` with args `Z` and returned result `R`.

The `echo.message` and `math.add` demos prove the plumbing. The trust-boundary demo shows the intended use case.

## 30-Second Demo

```sh
npm install
npm run demo:clean
```

`npm run demo:clean` is the quick technical smoke test. It preserves your local signing key, removes old demo receipts, builds the TypeScript project, runs the real local MCP SDK proof-of-concept, writes signed receipts to `./receipts/`, and prints `Chain is intact.`

The clean demo creates receipts for two safe local demo tools:

- `echo.message`
- `math.add`

These tools run only inside the local MCP SDK demo. They do not touch real files, email, calendars, credentials, network services, browsers, or user data. Use `npm run example:trust-boundary` for the best conceptual demo.

## What This Is

- A local-first developer tool.
- A receipt/provenance layer for agent tool calls.
- A TypeScript CLI and wrapper API.
- A set of local demos covering MCP client-side receipts, server-attested receipts, and trust-boundary positioning.

## What This Is Not

- Not a security guarantee.
- Not compliance-grade audit software.
- Not production/external MCP server support yet.
- Not a permission engine.
- Not a hosted dashboard.

## Why This Matters

As AI agents call more tools across boundaries, developers need a lightweight way to prove what happened without storing private raw inputs or outputs. AgentReceipt records hashes, signatures, timestamps, caller metadata when supplied, and chain links so receipts can be checked later.

## Portable execution evidence

AgentReceipt is not a replacement for logs, tracing, Git history, cloud audit trails, provider audit logs, or approval systems. Those systems are still the right source of truth for ordinary debugging, platform operations, access history, and workflow enforcement.

AgentReceipt is a portable signed record for agent/tool actions that may need to be verified outside the original runtime.

Strong use cases include:

- state-changing tool calls
- external MCP servers or third-party tools
- multi-agent or multi-user attribution
- actions that need to attach to a PR, task, workflow run, audit packet, ticket, or downstream system
- cross-team, cross-vendor, or cross-runtime workflows

Weak use cases include:

- low-value diagnostic calls
- internal debugging where logs are enough
- clean GitOps paths where Git history and platform audit logs already answer who did what

## Key custody and trust model

`server_attested` receipts are only as trustworthy as the server key and runtime. The local demo key in `.agentreceipt` is not production key management.

Real deployments need explicit decisions about key storage, key rotation, custody, and access control. AgentReceipt does not authenticate callers by itself. Host systems authenticate callers, sessions, services, or agents, then pass caller metadata into AgentReceipt. AgentReceipt records that host-supplied metadata and signs it into the receipt.

A receipt proves that the holder of the signing key produced the receipt over the included fields. It does not prove the business correctness of the action.

## Selective capture

Do not sign every low-value diagnostic call by default. Prefer signing important state-changing or trust-boundary actions: service restarts, config edits, script executions, deploys, ticket/workflow changes, database writes, filesystem writes, browser/form actions, and cloud/infra changes.

Diagnostic and read-only calls can still be signed if the host system needs that level of evidence, but broad capture may create noise.

## Interop and schema direction

AgentReceipt is currently a TypeScript implementation and local-first proof of concept. The long-term value may be a stable receipt envelope and signing input that other systems can emit, store, or verify.

This is not a standard yet.

## Current Status

- MVP
- local-only
- experimental
- receipts-first
- real local MCP SDK proof-of-concept only
- trust-boundary demo with fake local data
- MCP-shaped educational demo only

## Commands

Most useful commands:

```sh
npm run build
npm test
npm run example:trust-boundary
npm run demo:clean
npm run chain
```

Additional examples and maintenance commands:

```sh
npm run demo
npm run example:wrap
npm run example:sink
npm run example:mcp
npm run example:mcp-real
npm run example:mcp-server
npm run verify -- <receiptPath>
npm run chain:retained
npm run prune
npm run reset:demo
npm run reset:all
```

## Testing

```sh
npm test
npm run build
npm run demo:clean
```

`npm test` uses Node's built-in test runner. The tests create isolated temporary receipt/key folders under `.tmp-tests/` and do not rely on existing user receipts.

Real local MCP SDK demo:

```sh
npm run example:mcp-real
```

Server-side MCP receipt demo:

```sh
npm run example:mcp-server
```

Trust-boundary demo:

```sh
npm run example:trust-boundary
```

MCP-shaped educational demo:

```sh
npm run example:mcp
```

## Reset Commands

`npm run reset:demo` removes only `./receipts/`. It preserves `./.agentreceipt/` and your local signing keys.

`npm run reset:all` removes both `./receipts/` and `./.agentreceipt/`. This deletes local signing keys and prints:

```text
WARNING: reset:all removes local signing keys. Old receipts may no longer verify with the same key.
```

Because `reset:all` deletes the local key material, old local receipts may become unverifiable with the previous local key unless you preserved the public/private key files elsewhere.

## Example Receipt

```json
{
  "receipt_id": "6ba40b7b-01f6-40cf-98f8-75d037d0563a",
  "agent_id": "agentreceipt-demo-agent",
  "tool": "email.draft",
  "action_status": "executed",
  "input_hash": "802f6d4b8f9ce...",
  "output_hash": "fbb5905d5cf1...",
  "timestamp": "2026-05-25T20:14:33.100Z",
  "previous_receipt_hash": null,
  "receipt_role": "client_observed",
  "receipt_policy": {
    "mode": "required",
    "reason": "default"
  },
  "signature": "base64-ed25519-signature",
  "public_key_id": "sha256:abc123..."
}
```

Failed receipts keep the same core shape, set `action_status` to `failed`, set `output_hash` to `null`, and add `error_hash`.

## Using AgentReceipt In Your Code

Use `withAgentReceipt` to wrap any async local tool call. It creates keys if needed, hashes the input, runs your function, signs the receipt, chains it to the previous local receipt, and writes the receipt JSON to `./receipts/`.

```ts
import { withAgentReceipt } from "agentreceipt";

const { result, receipt, receiptPath } = await withAgentReceipt({
  agentId: "demo-agent",
  tool: "email.draft",
  input: {
    to: "client@example.com",
    subject: "Follow up"
  },
  run: async () => {
    return {
      draftId: "draft_123",
      status: "created"
    };
  }
});
```

Successful receipts record `action_status: "executed"`, `input_hash`, `output_hash`, `previous_receipt_hash`, `signature`, and `public_key_id`.

Failed receipts record `action_status: "failed"`, `input_hash`, `output_hash: null`, `error_hash`, `previous_receipt_hash`, `signature`, and `public_key_id`. Failed receipts do not store the full raw error message by default.

## Selective Receipt Capture

AgentReceipt is not meant to record every low-value tool call. By default, `withAgentReceipt` treats missing policy as:

```ts
{ mode: "required", reason: "default" }
```

Use `receiptPolicy.mode: "required"` for actions where proof matters.

```ts
await withAgentReceipt({
  agentId: "demo-agent",
  tool: "email.draft",
  input: { to: "client@example.com" },
  receiptPolicy: { mode: "required", reason: "customer-facing draft" },
  run: async () => ({ draftId: "draft_123" })
});
```

Use `receiptPolicy.mode: "off"` for noisy or low-value calls. In this mode AgentReceipt runs the tool, creates no receipt file, and returns `receipt: null` and `receiptPath: null`. If the tool fails, it rethrows the original error without creating a failed receipt.

```ts
await withAgentReceipt({
  agentId: "demo-agent",
  tool: "debug.token_count",
  input: { text: "short local demo string" },
  receiptPolicy: { mode: "off", reason: "noisy diagnostic call" },
  run: async () => ({ tokens: 4 })
});
```

Selective capture reduces I/O and storage bloat. Retention pruning can also delete older local receipt files when you no longer need full local history.

## Pluggable receipt sinks

AgentReceipt is not meant to force a new logging stack. Local JSON receipts are the default, but developers can provide a custom receipt sink to route signed receipts to their own storage, audit, or observability system.

Built-in sinks:

- `LocalFileReceiptSink`: the default. Writes receipt JSON to `./receipts/` and is the only sink covered by local chain verification.
- `ConsoleReceiptSink`: prints a short receipt summary to the console. Demo/debug only; it does not write local receipt files.
- `MemoryReceiptSink`: stores receipts in memory for tests/examples. It does not write local receipt files.

```ts
import { withAgentReceipt, type ReceiptSink } from "agentreceipt";

const receiptSink: ReceiptSink = {
  name: "custom-demo",
  async write(receipt) {
    console.log(`Custom sink received receipt: ${receipt.receipt_id}`);
    return {
      receiptPath: null,
      receiptId: receipt.receipt_id,
      sinkName: this.name
    };
  }
};

const wrapped = await withAgentReceipt({
  agentId: "demo-agent",
  tool: "custom.route",
  input: { message: "route this receipt" },
  receiptSink,
  run: async () => ({ routed: true })
});
```

If `receiptSink` is omitted, AgentReceipt uses `LocalFileReceiptSink` and preserves the existing local file behavior. If `receiptPolicy.mode` is `"off"`, AgentReceipt does not create a receipt and does not call the sink.

Local chain verification applies only to receipts written by `LocalFileReceiptSink`. `LocalFileReceiptSink` serializes in-process receipt signing and writes to reduce chain races during concurrent tool calls. This is not distributed locking; multi-process or distributed receipt chains need stronger coordination.

Custom sinks are useful for integration, but external durability and verification are the developer's responsibility for now. AgentReceipt does not yet support cross-sink or global chain verification.

## Retention and pruning

AgentReceipt writes local JSON receipt files to `./receipts/`. Use `npm run prune` to prevent receipt folders from growing forever.

By default, pruning keeps receipts from the last 30 days and keeps at most 1000 receipts. You can override those values with `.agentreceipt/config.json`:

```json
{
  "retention": {
    "maxAgeDays": 30,
    "maxCount": 1000
  }
}
```

Pruning deletes local receipt history. It never deletes `.agentreceipt/keys`, but it can remove historical chain context because later retained receipts may point to earlier receipts that no longer exist.

After pruning, full historical chain verification with `npm run chain` may fail. Use `npm run chain:retained` to verify the remaining segment. Retained-chain verification checks every retained receipt signature and checks that every retained receipt after the first links correctly, while allowing the first retained receipt to point to a pruned earlier receipt.

## MCP-Shaped Usage

AgentReceipt includes a minimal MCP-shaped educational adapter demo. It demonstrates the boundary AgentReceipt cares about: a tool-call shaped request.

```ts
import { withMcpReceipt } from "agentreceipt";

const { mcpResult, receipt, receiptPath } = await withMcpReceipt({
  request: {
    agentId: "demo-agent",
    method: "tools/call",
    params: {
      name: "email.draft",
      arguments: {
        to: "client@example.com",
        subject: "Follow up"
      }
    }
  },
  run: async () => {
    return {
      draftId: "draft_mcp_123",
      status: "created"
    };
  }
});
```

`withMcpReceipt` validates that `method` is exactly `tools/call`, uses `params.name` as the AgentReceipt tool name, and uses `params.arguments` as the recorded input. It is an educational adapter for MCP-shaped requests; the real local MCP SDK demos show the current client-side and server-side wrapper patterns.

AgentReceipt currently records executed and failed tool calls. It does not approve, deny, block, or enforce actions.

## Real Local MCP Proof-Of-Concept

`npm run demo:clean` and `npm run example:mcp-real` use the official MCP TypeScript SDK with an in-memory local transport. The demo creates a tiny local MCP server, registers only safe demo tools, calls them through a real MCP client, and wraps the actual MCP `client.callTool(...)` results with AgentReceipt.

The demo tools are:

- `echo.message`
- `math.add`

This proof-of-concept does not connect to external tools, user data, files, credentials, network services, browsers, email, or calendars. It is experimental and intentionally local-only. Production/external MCP server support would need more work around deployment, trust boundaries, key handling, and operational security.

## Client-Observed vs Server-Attested Receipts

AgentReceipt receipts can include `receipt_role`.

`client_observed` receipts wrap `client.callTool(...)` or another client-side tool-call boundary. They prove what the client observed sending and receiving.

`server_attested` receipts wrap the server-side tool handler. They prove what the server attests happened, assuming the server key and runtime are trusted. This is closer to the source of truth for tool execution and is stronger for third-party proof.

`npm run example:mcp-server` is a local experimental demo using the official MCP TypeScript SDK, in-memory transport, and the safe demo tools `echo.message` and `math.add`. It is not a formal standard or production trust model. See `docs/client-vs-server-receipts.md` for the short version.

The trust-boundary demo uses server-attested receipts because that is the clearer shape for actions that may need later verification across a boundary.

## Caller identity metadata

Server-attested receipts can optionally include caller identity metadata:

```ts
const handler = withServerReceipt({
  agentId: "demo-mcp-server",
  tool: "email.draft",
  caller: {
    id: "agent:demo-client",
    type: "agent",
    authRef: "local-demo-session"
  },
  handler: async (input) => ({ draftId: "draft_123" })
});
```

When `caller` is provided, AgentReceipt records `caller_id`, `caller_type`, and `caller_auth_ref` in the signed receipt. If `caller.type` is missing, AgentReceipt records `caller_type: "unknown"`. If `caller` is omitted, caller fields are omitted for backward compatibility.

AgentReceipt does not authenticate callers. Host systems authenticate callers, sessions, services, or agents, then pass that metadata into AgentReceipt. AgentReceipt records that host-supplied metadata into the signed receipt so the receipt can say who invoked the tool at a trust boundary.

This is useful when a later reviewer needs evidence shaped like: server `S` attests caller `X` invoked tool `Y` with args `Z`.

## Linking receipts to upstream records

AgentReceipt can link an execution receipt back to an upstream proposal, ticket, approval, workflow run, or execution record.

AgentReceipt does not manage that upstream system. Host systems supply the lineage reference, type, optional hash, and optional label:

```ts
await withServerReceipt({
  agentId: "demo-server",
  tool: "business.record_update",
  caller: { id: "agent:demo-client", type: "agent" },
  lineage: {
    ref: "proposal:demo-001",
    type: "proposal",
    hash: "sha256:host-supplied-fingerprint",
    label: "Approve fake business record update"
  },
  handler: async (input) => ({ updated: true })
});
```

When present, AgentReceipt records `lineage_ref`, `lineage_type`, `lineage_hash`, and `lineage_label` in the signed receipt. If `lineage.type` is missing, AgentReceipt records `lineage_type: "other"`. If lineage is omitted, these fields are omitted for backward compatibility.

This helps show continuity: upstream intent/approval record -> server-attested execution receipt -> outcome/review. See `docs/receipt-lineage.md` for the short version.

## Trust-boundary demo

Run:

```sh
npm run example:trust-boundary
```

The demo shows side-effecting business-style actions using fake local data only:

- `business.record_update`
- `documents.publish_record`
- `commerce.create_order_hold`

It demonstrates the shape: server attests caller `X` invoked tool `Y` with args `Z`, linked to optional upstream record `P`, and returned result `R`.

AgentReceipt is not replacing logs or OpenTelemetry. Normal logs and telemetry are usually the right tools for ordinary debugging and internal monitoring. AgentReceipt is for cases where a portable, verifiable action record matters across a trust boundary.

## Does This Work With Any MCP Server?

Not automatically yet. AgentReceipt currently works where a developer can wrap or intercept the tool-call boundary. The real MCP proof-of-concept shows AgentReceipt can wrap actual MCP SDK `client.callTool(...)` calls. Production/external MCP server support would require adapter testing for transports, client setups, and production edge cases.

## What It Does Not Prove

`client_observed` receipts prove what the client observed sending and receiving.

`server_attested` receipts prove what the server attests happened, assuming the server key and runtime are trusted.

AgentReceipt still does not prove that an agent made a correct decision, that an action was authorized, that the surrounding system was secure, or that any workflow is compliant. Hashes prove the same input, output, or error fingerprint can be matched later, not that the action was correct.

AgentReceipt does not verify upstream proposal, ticket, approval, workflow, or execution records by itself. `lineage_ref` and `lineage_hash` are host-supplied metadata.

It is not compliance software, not a compliance-grade audit system, and not a substitute for secure logging, access control, independent timestamping, or production key management.

## Roadmap

- Real MCP wrapper
- Hosted verification page
- SDK integrations
- Receipt search/dashboard
