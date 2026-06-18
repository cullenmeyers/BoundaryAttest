# Limitations

BoundaryAttest is experimental local-first software.

BoundaryAttest receipts are tamper-evident local records, not a security guarantee.

It is not compliance software and should not be used as a legal, regulatory, or compliance-grade audit system.

It does not prove that an agent made a correct decision. It also does not prove that an external tool actually performed the claimed action.

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

BoundaryAttest does not yet support cross-sink or global chain verification.

No vendor integrations are included yet.

Console and memory sinks are for demo/testing, not durable audit storage.

`receiptPolicy` is not a permission system and does not approve or block actions.

BoundaryAttest works where a developer can wrap or intercept the tool-call boundary.

It does not automatically attach to closed agent platforms.

It does not provide production/external MCP server support yet.

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

There is no external MCP server support yet.

No external MCP server support exists for server-attested receipts yet.

There is no Go implementation yet.

There is no formal receipt standard yet.

Server receipts are only as trustworthy as the server key and runtime.

BoundaryAttest does not verify caller identity by itself.

Caller metadata is only as trustworthy as the host system that supplied it.

`caller_id` is only as trustworthy as the host system that supplied it.

BoundaryAttest does not verify upstream proposal, ticket, approval, workflow, or execution records by itself.

`lineage_ref` and `lineage_hash` are only as trustworthy as the host system that supplied them.

No governance engine, DAO integration, blockchain anchoring, or approval system is implemented.

Request signing is not implemented yet.

Human signatures are not implemented yet.

Delegation envelopes are not implemented yet.

There is no hosted receipt storage yet.

`npm run reset:all` removes local keys in `./.agentreceipt/`.

Old receipts may not verify if keys are deleted and public/private key material is not preserved.

This MVP only checks that the receipt file matches the signed action record and that the chain links match the receipt files present locally.
