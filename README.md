# BoundaryAttest

BoundaryAttest creates portable signed attestations for consequential agent actions crossing trust boundaries.

Signed boundary records for agent actions.

Normal logs and OpenTelemetry are usually enough for internal debugging and monitoring. BoundaryAttest is for cases where a portable attestation may need to be checked later: multi-agent workflows, org-to-org workflows, delegated agents, business record changes, document publishing, commerce/dispute scenarios, and high-value or hard-to-reverse actions.

When an agent calls a tool, BoundaryAttest can:

- hash the input
- run the tool
- hash the output or error
- sign a receipt
- chain the receipt to previous receipts
- check later that the receipt chain is intact

## Proof Kit v0.1

The [BoundaryAttest Proof Kit v0.1](examples/proof-kit/) is a small example/demo artifact for understanding BoundaryAttest. It contains three signed demo receipts and a tiny verifier.

```sh
npm run build
npm run example:proof-kit
```

The proof kit uses demo-only signer trust. Receipts prove signature and content integrity only; they do not prove truth, authorization, compliance, runtime integrity, or business outcome.

External adapters can target the minimal, experimental [BoundaryAttest Interop Profile v0.1](docs/interop-profile-v0.1.md); the [dependency-free adapter guide](docs/interop-adapter-guide-v0.1.md) provides the short implementation path. Its [JSON Schema](docs/schemas/interop-receipt-v0.1.schema.json) and [verification trust/limitations note](docs/interop-verification-limits-v0.1.md) define the structural contract and the narrow meaning of a passing check.

## Best Conceptual Demo

```sh
npm install
npm run build
npm run example:trust-boundary
```

The trust-boundary demo uses the official MCP TypeScript SDK with local in-memory transport and fake local data. It shows side-effecting business-style actions where a host signs a claim that caller `X` invoked tool `Y` with args `Z` and returned result `R`.

The `echo.message` and `math.add` demos exercise the plumbing. The trust-boundary demo shows the intended use case.

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

## When This Matters

BoundaryAttest is not a replacement for logs, tracing, Git history, cloud audit trails, provider audit logs, or approval systems. Those systems are still the right source of truth for ordinary debugging, platform operations, access history, and workflow enforcement.

Inside one organization or trust domain, ordinary logs may already be enough. BoundaryAttest matters when a signed claim about a consequential agent action needs to travel outside the original runtime, vendor, app, or logging system. It creates a portable attestation that another party can check later without relying only on the original system's logs.

The value of that attestation depends on who signs it, who holds the signing keys, what claim is signed, who the claim is meant to protect, and what the signature does and does not establish.

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

`client_observed` means BoundaryAttest signs what its client observed sending and receiving. It does not turn that observation into a claim from the executing host.

`server_attested`, or host-side signing, means the executing host or runtime signs what it claims it executed. BoundaryAttest includes only local experimental demos of this mode; production host-side integration and production key custody are not implemented.

Both modes are only as trustworthy as the signer, its key custody, and its runtime. The local demo key in `.agentreceipt` is not production key management.

Real deployments need explicit decisions about key storage, key rotation, custody, and access control. BoundaryAttest does not authenticate callers by itself. Host systems authenticate callers, sessions, services, or agents, then pass caller metadata into BoundaryAttest. BoundaryAttest records that host-supplied metadata and signs it into the receipt.

A valid signature indicates that the corresponding signing key produced the receipt over the included fields. It does not establish the business correctness of the action.

For a future optional model that cryptographically binds caller request intent to server-attested outcomes, see `docs/caller-signed-requests.md`.

## Selective capture

Do not sign every low-value diagnostic call by default. Prefer signing important state-changing or trust-boundary actions: service restarts, config edits, script executions, deploys, ticket/workflow changes, database writes, filesystem writes, browser/form actions, and cloud/infra changes.

Diagnostic and read-only calls can still be signed if the host system needs that level of evidence, but broad capture may create noise.

## Interop and schema direction

BoundaryAttest is currently a TypeScript implementation and local-first proof of concept. The long-term value may be a stable receipt envelope and signing input that other systems can emit, store, or verify.

BoundaryAttest was previously called AgentReceipt during early PoC work. The `agentreceipt` package, CLI command, storage directory, and exported API names remain unchanged in this first-pass branding rename for compatibility.

This is not a standard yet.

## Intergrax PoC

Intergrax is an external open-source agent runtime maintained independently from BoundaryAttest. The PoC supports unsigned v2 tool and harness events and verifies optional EBE-9 host signatures when present in `boundary_events[]`. The adapter creates one separate signed `client_observed` BoundaryAttest receipt per `tool_execution` or `harness_step` event; it does not create a composite run receipt. Per-event identity and correlation come from `boundary_events[]`, while the Intergrax trace endpoint is run/task-level rather than per-event.

This demonstrates that BoundaryAttest can verify an optional Intergrax host/runtime claim and map the observed event into its own distinct receipt format. It is a technical proof of concept with one pinned demo public key, not production key management, a production integration, deployment, paying customer relationship, formal commercial partnership, or endorsement. A valid host signature does not prove truth, authorization, an uncompromised runtime, legal responsibility, or a final business outcome. See the [Intergrax PoC documentation](docs/integrations/intergrax-poc.md) for technical details.

## Current Status

- MVP
- local-only
- experimental
- receipts-first
- real local MCP SDK proof-of-concept only
- trust-boundary demo with fake local data
- MCP-shaped educational demo only

## Current Limitations

BoundaryAttest is experimental and local-first. The current local signing setup is intended for development and proof-of-concept use; production deployments need an explicit key-custody model. Possible future integrations could include operating-system secure storage, managed key services, or hardware-backed keys, but no provider or implementation is committed.

A valid signature indicates that a particular key signed a particular receipt. It does not establish that the claim is true, that the action was authorized, that the human identity is correct, or that the signer's environment was uncompromised.

The current linear `previous_receipt_hash` chain is easiest to use with coordinated sequential writers. Highly concurrent or distributed environments may later need separate chains, coordination, checkpoints, or DAG-style lineage; those are future design possibilities, not promised roadmap items.

Retention and pruning affect what can be verified later. Removing earlier receipts limits what can be checked about omitted history. A retained chain can show consistency from its retained starting point, but it cannot establish that no earlier or omitted receipts existed.

Hash-based evidence helps verify that later-provided input, output, or error evidence matches what was originally receipted. Hashes do not reveal or recover the original input or output. Verification requires access to the original evidence and the same canonicalization rules.

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
npm run example:intergrax-poc
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

Intergrax PoC run:

```sh
npm run example:intergrax-poc
```

See `docs/integrations/intergrax-poc.md` for the public PoC notes, including the `client_observed` trust role, hash matching, lineage, and why this is not server attestation.

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

## Using BoundaryAttest In Your Code

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

BoundaryAttest is not meant to record every low-value tool call. By default, `withAgentReceipt` treats missing policy as:

```ts
{ mode: "required", reason: "default" }
```

Use `receiptPolicy.mode: "required"` for consequential actions where a signed attestation matters.

```ts
await withAgentReceipt({
  agentId: "demo-agent",
  tool: "email.draft",
  input: { to: "client@example.com" },
  receiptPolicy: { mode: "required", reason: "customer-facing draft" },
  run: async () => ({ draftId: "draft_123" })
});
```

Use `receiptPolicy.mode: "off"` for noisy or low-value calls. In this mode BoundaryAttest runs the tool, creates no receipt file, and returns `receipt: null` and `receiptPath: null`. If the tool fails, it rethrows the original error without creating a failed receipt.

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

BoundaryAttest is not meant to force a new logging stack. Local JSON receipts are the default, but developers can provide a custom receipt sink to route signed receipts to their own storage, audit, or observability system.

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

If `receiptSink` is omitted, BoundaryAttest uses `LocalFileReceiptSink` and preserves the existing local file behavior. If `receiptPolicy.mode` is `"off"`, BoundaryAttest does not create a receipt and does not call the sink.

Local chain verification applies only to receipts written by `LocalFileReceiptSink`. `LocalFileReceiptSink` serializes in-process receipt signing and writes to reduce chain races during concurrent tool calls. This is not distributed locking; multi-process or distributed receipt chains need stronger coordination.

Custom sinks are useful for integration, but external durability and verification are the developer's responsibility for now. BoundaryAttest does not yet support cross-sink or global chain verification.

## Retention and pruning

BoundaryAttest writes local JSON receipt files to `./receipts/`. Use `npm run prune` to prevent receipt folders from growing forever.

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

BoundaryAttest includes a minimal MCP-shaped educational adapter demo. It demonstrates the trust boundary the project cares about: a tool-call shaped request.

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

`withMcpReceipt` validates that `method` is exactly `tools/call`, uses `params.name` as the BoundaryAttest tool name, and uses `params.arguments` as the recorded input. It is an educational adapter for MCP-shaped requests; the real local MCP SDK demos show the current client-side and server-side wrapper patterns.

BoundaryAttest currently records executed and failed tool calls. It does not approve, deny, block, or enforce actions.

## Real Local MCP Proof-Of-Concept

`npm run demo:clean` and `npm run example:mcp-real` use the official MCP TypeScript SDK with an in-memory local transport. The demo creates a tiny local MCP server, registers only safe demo tools, calls them through a real MCP client, and wraps the actual MCP `client.callTool(...)` results with BoundaryAttest.

The demo tools are:

- `echo.message`
- `math.add`

This proof-of-concept does not connect to external tools, user data, files, credentials, network services, browsers, email, or calendars. It is experimental and intentionally local-only. Production/external MCP server support would need more work around deployment, trust boundaries, key handling, and operational security.

## Client-Observed vs Server-Attested Receipts

BoundaryAttest receipts can include `receipt_role`.

`client_observed` receipts wrap `client.callTool(...)` or another client-side tool-call boundary. They are signed claims about what the client observed sending and receiving.

`server_attested` receipts wrap the server-side tool handler. They are signed host/runtime claims about what the host says it executed, assuming the host key and runtime are trusted. BoundaryAttest demonstrates this only in local experimental examples; it does not provide a production host-side signing integration.

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

When `caller` is provided, BoundaryAttest records `caller_id`, `caller_type`, and `caller_auth_ref` in the signed receipt. If `caller.type` is missing, BoundaryAttest records `caller_type: "unknown"`. If `caller` is omitted, caller fields are omitted for backward compatibility.

BoundaryAttest does not authenticate callers. Host systems authenticate callers, sessions, services, or agents, then pass that metadata into BoundaryAttest. BoundaryAttest records that host-supplied metadata into the signed receipt so the receipt can say who invoked the tool at a trust boundary.

This is useful when a later reviewer needs evidence shaped like: server `S` attests caller `X` invoked tool `Y` with args `Z`.

## Linking receipts to upstream records

BoundaryAttest can link an execution receipt back to an upstream proposal, ticket, approval, workflow run, or execution record.

BoundaryAttest does not manage that upstream system. Host systems supply the lineage reference, type, optional hash, and optional label:

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

When present, BoundaryAttest records `lineage_ref`, `lineage_type`, `lineage_hash`, and `lineage_label` in the signed receipt. If `lineage.type` is missing, BoundaryAttest records `lineage_type: "other"`. If lineage is omitted, these fields are omitted for backward compatibility.

This helps show continuity: upstream intent/approval record -> signed host/runtime claim -> outcome/review. See `docs/receipt-lineage.md` for the short version.

## Trust-boundary demo

Run:

```sh
npm run example:trust-boundary
```

The demo shows side-effecting business-style actions using fake local data only:

- `business.record_update`
- `documents.publish_record`
- `commerce.create_order_hold`

It demonstrates the shape: a host signs a claim that caller `X` invoked tool `Y` with args `Z`, linked to optional upstream record `P`, and returned result `R`.

BoundaryAttest is not replacing logs or OpenTelemetry. Normal logs and telemetry are usually the right tools for ordinary debugging and internal monitoring. BoundaryAttest is for consequential actions where a portable signed attestation matters across a trust boundary.

## Does This Work With Any MCP Server?

Not automatically yet. BoundaryAttest currently works where a developer can wrap or intercept the tool-call boundary. The real MCP proof-of-concept shows BoundaryAttest can wrap actual MCP SDK `client.callTool(...)` calls. Production/external MCP server support would require adapter testing for transports, client setups, and production edge cases.

## What It Does Not Prove

`client_observed` receipts are signed claims about what the client observed sending and receiving.

`server_attested` receipts are signed claims from the host/runtime about what it says it executed, assuming the host key and runtime are trusted.

BoundaryAttest does not establish that an agent made a correct decision, that an action was authorized, that the surrounding system was secure, or that any workflow is compliant. Hashes let the same input, output, or error fingerprint be matched later; they do not establish that the action was correct.

BoundaryAttest does not verify upstream proposal, ticket, approval, workflow, or execution records by itself. `lineage_ref` and `lineage_hash` are host-supplied metadata.

It is not compliance software, not a compliance-grade audit system, and not a substitute for secure logging, access control, independent timestamping, or production key management.

## Roadmap

- Real MCP wrapper
- Hosted verification page
- SDK integrations
- Receipt search/dashboard
