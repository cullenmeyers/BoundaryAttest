# Experimental FAF / BoundaryAttest receipt mapping v0.1 (draft)

Status: discussion draft for external review by the FAF maintainer. This is not an official FAF integration or profile, and it does not change the BoundaryAttest interop profile.

## Placement

BoundaryAttest sits next to FAF context and tooling, not instead of them. It signs selected claims at consequential handoff boundaries; it is not a second version-control system.

The layers remain distinct:

- `.faf` and `.fafm` remain the context and memory layer.
- Git and file history remain the working-tree history layer.
- MCP traces and `faf-cli` logs remain operational evidence.
- BoundaryAttest signs only selected handoff claims that refer to those layers or their artifacts.

A receipt can bind digests and references from these systems, but it does not absorb their contents or replace their history, trace, replay, or inspection functions.

## Hook order

### Primary: MCP tool path

The least invasive first hook is the MCP tool path, where an agent actually crosses a boundary. An opt-in emitter should observe successful or failed write-, export-, and handoff-class calls and construct a claim after the relevant result is available.

Examples include `faf.write`, `faf.export`, and an MCP-mediated artifact handoff. The MCP trace remains the detailed operational record. The receipt is a narrow signed statement about the selected boundary event.

### Secondary: `faf-cli` checkpoint

A second opt-in emitter can run at `faf-cli export`, `sync`, `compile`, or diff-log checkpoints used by a human or CI workflow. It should use the same claim shape as the MCP emitter. This avoids creating two receipt dialects while letting each surface retain its native logs and behavior.

Neither emitter is required for ordinary FAF use. Emission is opt-in and should be limited to checkpoints where signer attribution and claim integrity are useful.

## Shared claim shape

Both emitters use the existing BoundaryAttest interop v0.1 envelope:

```json
{
  "claim": {},
  "signature": "base64 Ed25519 signature over the canonical claim",
  "public_key_id": "sha256 fingerprint supplied and trusted out of band"
}
```

The experimental claim fields are:

| Field | Meaning |
| --- | --- |
| `receipt_version` | Existing envelope-compatible version, currently `"0.1"`. |
| `receipt_role` | Existing supported role, such as `"client_observed"`. |
| `event_id` | Unique identifier for the observed checkpoint. |
| `timestamp` | Time represented by the signer. |
| `action_type` | Namespaced boundary action. |
| `status` | Outcome represented by the claim. |
| `faf_surface` | Emitter surface: `"mcp"` or `"cli"`. |
| `faf_action` | `"write"`, `"export"`, `"sync"`, `"compile"`, or `"handoff"`. |
| `project_ref` | FAF project reference; not necessarily a globally trusted identity. |
| `git_ref` | Optional working-tree ref when available. |
| `git_commit` | Optional commit identity when available. |
| `path` | Optional affected path. |
| `artifact_ref` | Optional exported or handed-off artifact reference. |
| `input_digest` | Digest of selected canonical input material. |
| `output_digest` | Digest of selected canonical output material. |
| `artifact_hash` | Digest of the referenced artifact, when applicable. |
| `parent_receipt` | Optional digest reference to a preceding receipt. |
| `mcp_tool_name` | MCP tool name for an MCP-path event; otherwise `null`. |
| `faf_cli_command` | CLI command for a CLI-path event; otherwise `null`. |
| `signer` | Signer metadata containing the same `public_key_id` used by the envelope. |
| `verification_limits` | Explicit statement of the receipt's narrow meaning. |

Fields that do not apply to a particular surface are retained as `null` in these examples so the two opt-in emitters visibly share one shape. A future official mapping could choose different presence rules; this draft does not define one.

Digest inputs require an emitter-specific canonicalization contract before independent artifact recomputation can be interoperable. The examples use deterministic JSON serialization for synthetic input and output values and SHA-256 for references. They demonstrate binding, not a FAF-owned digest standard.

## Verification limits

Passing the existing verifier proves only that a specific signer signed a specific claim and that the signed claim was not altered.

It does not prove:

- the file or content is correct;
- the AI action was wise;
- the action was authorized;
- the signer is trusted merely because a public key accompanies an example;
- a stated path, command, digest, Git reference, or operational event is truthful;
- the intended business outcome occurred;
- Git history;
- FAF context or memory;
- MCP traces or `faf-cli` logs.

Accordingly, BoundaryAttest does not replace Git, FAF context, or MCP traces/logs. Authorization, key trust, artifact retrieval, digest recomputation, timestamp policy, and correspondence with native FAF/MCP evidence remain relying-party checks.

## Example vectors

The runnable examples in [`examples/faf-mcp-handoff-v0.1/`](../examples/faf-mcp-handoff-v0.1/) cover:

1. an MCP write checkpoint;
2. an MCP export/handoff checkpoint linked to the write receipt; and
3. a `faf-cli sync` checkpoint linked to the handoff receipt.

They are real signed receipts accepted by the existing example interop verifier, but they are examples—not stable interop test vectors. Their synthetic claims do not establish that FAF or MCP performed the represented actions.
