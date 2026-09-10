# Limitations

BoundaryAttest is experimental local-first software.

BoundaryAttest receipts are tamper-evident local records, not a security guarantee.

See [When to use BoundaryAttest](docs/when-to-use-boundaryattest.md) for the fuller selection test and assurance hierarchy.

It is not compliance software and should not be used as a legal, regulatory, or compliance-grade audit system.

A valid signature shows that the corresponding key signed the included claim. It does not prove:

- that the claim is true
- that the action was authorized
- the identity of a human
- that the signing or executing runtime was uncompromised
- that the event stream is complete
- the final business outcome
- who bears legal responsibility

It does not prove that an agent made a correct decision. It also does not prove that an external tool actually performed the claimed action.

`server_attested` means that the expected runtime/operator key signed the claim. It does not establish signer independence, secure key custody, an uncompromised runtime, or objective truth. Expected-key distribution and signer trust remain relying-party responsibilities.

`client_observed` covers only what a cooperating participating client signs that it observed. It does not discover unwrapped or shadow MCP activity, prove all calls passed through that client, or solve non-cooperating client behavior.

One receipt proves only its own signed claim. It does not prove completeness, absence of omitted or deleted events, a complete session, or authoritative ordering across unrelated receipts.

Receipt hashes let the same input/output be matched later; they do not establish that the action was correct or useful.

Failed receipts store `error_hash` by default, not raw private error content.

Recording every tool call can create I/O and storage bloat.

The MVP supports selective receipt capture with `receiptPolicy`.

Pruning deletes local receipt files.

Pruning can remove historical chain context.

BoundaryAttest does not yet support permanent archival/checkpointing.

Retained-chain verification only checks that the remaining receipt segment is intact.

Hosted/archival storage is not implemented.

Custom sinks are responsible for their own storage durability.

Local chain verification only covers local file receipts.

In-process chain serialization is supported for `LocalFileReceiptSink`.

Multi-process/distributed chain consistency is not solved yet.

Production systems with multiple writers should use a durable coordinated sink.

The simple linear `previous_receipt_hash` model assumes coordinated sequential ordering. It is not a general full-history solution for active/active systems, concurrent writers, independent replicas, or differing allocation and commit order.

BoundaryAttest does not yet support cross-sink or global chain verification.

The BoundaryAttest core package does not include a general vendor integration layer. External integrations are selective and host-specific.

Console and memory sinks are for demo/testing, not durable audit storage.

`receiptPolicy` is not a permission system and does not approve or block actions.

Signature verification does not prove that a policy or authorization decision was correct, that execution occurred, or that the result was correct.

BoundaryAttest works where a developer can wrap or intercept the tool-call boundary.

It does not automatically attach to closed agent platforms.

BoundaryAttest has an experimental external server-attested integration, but it does not provide a general production MCP server integration layer.

The real MCP demo only covers local safe demo tools.

The server-side MCP receipt demo only covers local safe demo tools.

The trust-boundary demo uses fake data only.

It is not financial, legal, payment, accounting, commerce, or compliance software.

It does not prove real-world authorization, correctness, or regulatory compliance.

It only demonstrates receipt shape for higher-trust-boundary tool calls.

There are no production MCP security guarantees.

Production key management is not implemented.

There is no permission enforcement yet.

There is no policy engine yet.

Failed receipts are not the same as blocked receipts.

The MCP-shaped demo only demonstrates receipt generation around MCP-shaped tool calls.

External MCP server integration is not universal; the current upstream integration covers selected host workflows only.

Production key management, including KMS/HSM custody, rotation, revocation, and a trust registry, is not implemented.

There is no Go implementation yet.

There is no formal receipt standard yet.

Server receipts are only as trustworthy as the server key and runtime.

BoundaryAttest does not verify caller identity by itself.

Caller metadata is only as trustworthy as the host system that supplied it.

`caller_id` is only as trustworthy as the host system that supplied it.

BoundaryAttest does not verify upstream proposal, ticket, approval, workflow, or execution records by itself.

`lineage_ref` and `lineage_hash` are only as trustworthy as the host system that supplied them.

No governance engine, DAO integration, blockchain anchoring, or approval system is implemented.

Where a durable authoritative source already exposes equivalent evidence, or a receiver can fetch authoritative inputs and deterministically recompute the result, an additional receipt may be unnecessary.

Request signing is not implemented yet.

Human signatures are not implemented yet.

Delegation envelopes are not implemented yet.

There is no hosted receipt storage yet.

`npm run reset:all` removes local keys in `./.agentreceipt/`.

Old receipts may not verify if keys are deleted and public/private key material is not preserved.

This MVP only checks that the receipt file matches the signed action record and that the chain links match the receipt files present locally.
