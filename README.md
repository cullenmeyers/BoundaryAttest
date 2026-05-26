# AgentReceipt

AgentReceipt creates tamper-evident receipts for AI agent tool calls.

When an agent calls a tool, AgentReceipt can:

- hash the input
- run the tool
- hash the output or error
- sign a receipt
- chain the receipt to previous receipts
- verify later that the receipt chain is intact

## 30-Second Demo

```sh
npm install
npm run demo:clean
```

Expected output: `demo:clean` preserves your local signing key, removes old demo receipts, builds the TypeScript project, runs the real local MCP SDK proof-of-concept, writes signed receipts to `./receipts/`, and prints `Chain is intact.`

The clean demo creates receipts for two safe local demo tools:

- `echo.message`
- `math.add`

These tools run only inside the local MCP SDK demo. They do not touch real files, email, calendars, credentials, network services, browsers, or user data.

## What This Is

- A local-first developer tool.
- A receipt/provenance layer for agent tool calls.
- A TypeScript CLI and wrapper API.
- A demo that currently supports a real local MCP SDK proof-of-concept, plus fake-tool and MCP-shaped educational examples.

## What This Is Not

- Not a security guarantee.
- Not compliance software.
- Not a real MCP integration yet.
- Not a permission engine.
- Not a hosted dashboard.

## Why This Matters

As AI agents call more tools, developers need a lightweight way to prove what happened without storing private raw inputs or outputs. AgentReceipt records hashes, signatures, timestamps, and chain links so receipts can be checked later.

## Current Status

- MVP
- local-only
- experimental
- receipts-first
- real local MCP proof-of-concept only
- MCP-shaped educational demo only

## Commands

```sh
npm run build
npm run demo:clean
npm run demo
npm run example:wrap
npm run example:mcp
npm run example:mcp-real
npm run verify -- <receiptPath>
npm run chain
npm run chain:retained
npm run prune
npm run reset:demo
npm run reset:all
npm run demo:clean
```

Real local MCP SDK demo:

```sh
npm run example:mcp-real
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

Selective capture reduces I/O and storage bloat. TTL/retention cleanup is not implemented yet.

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

`withMcpReceipt` validates that `method` is exactly `tools/call`, uses `params.name` as the AgentReceipt tool name, and uses `params.arguments` as the recorded input. Real MCP support would come later by wrapping actual MCP client/server tool calls.

AgentReceipt currently records executed and failed tool calls. It does not approve, deny, block, or enforce actions.

## Real Local MCP Proof-Of-Concept

`npm run demo:clean` and `npm run example:mcp-real` use the official MCP TypeScript SDK with an in-memory local transport. The demo creates a tiny local MCP server, registers only safe demo tools, calls them through a real MCP client, and wraps the actual MCP `client.callTool(...)` results with AgentReceipt.

The demo tools are:

- `echo.message`
- `math.add`

This proof-of-concept does not connect to external tools, user data, files, credentials, network services, browsers, email, or calendars. It is experimental and intentionally local-only. Real production MCP support would need more work around deployment, trust boundaries, key handling, and operational security.

## Does This Work With Any MCP Server?

Not automatically yet. AgentReceipt currently works where a developer can wrap or intercept the tool-call boundary. The real MCP proof-of-concept shows AgentReceipt can wrap actual MCP SDK `client.callTool(...)` calls. External MCP server support would require adapter testing for transports, client setups, and production edge cases.

## What It Does Not Prove

AgentReceipt does not prove that an agent made a correct decision, that a tool actually ran, or that the surrounding system was secure. Hashes prove the same input, output, or error fingerprint can be matched later, not that the action was correct.

It is not compliance software, not an audit system, and not a substitute for secure logging, access control, independent timestamping, or production key management.

## Roadmap

- Real MCP wrapper
- Hosted verification page
- SDK integrations
- Receipt search/dashboard
