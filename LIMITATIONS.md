# Limitations

AgentReceipt is experimental local-first software.

AgentReceipt receipts are tamper-evident local records, not a security guarantee.

It is not compliance software and should not be used as a legal, regulatory, or audit-grade record system.

It does not prove that an agent made a correct decision. It also does not prove that an external tool actually performed the claimed action.

Receipt hashes prove the same input/output can be matched later, not that the action was correct or useful.

Failed receipts store `error_hash` by default, not raw private error content.

Recording every tool call can create I/O and storage bloat.

The MVP supports selective receipt capture with `receiptPolicy`.

TTL/retention cleanup is not implemented yet.

`receiptPolicy` is not a permission system and does not approve or block actions.

AgentReceipt works where a developer can wrap or intercept the tool-call boundary.

It does not automatically attach to closed agent platforms.

It does not automatically wrap arbitrary MCP clients or external MCP servers yet.

The real MCP demo only covers local safe demo tools.

There are no production MCP security guarantees.

There is no permission enforcement yet.

There is no policy engine yet.

Failed receipts are not the same as blocked receipts.

The MCP-shaped demo only demonstrates receipt generation around MCP-shaped tool calls.

There is no external MCP server support yet.

There is no hosted receipt storage yet.

`npm run reset:all` removes local keys in `./.agentreceipt/`.

Old receipts may not verify if keys are deleted and public/private key material is not preserved.

This MVP only proves that the receipt file matches the signed action record and that the chain links match the receipt files present locally.
