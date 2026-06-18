# Optional Caller-Signed Requests

BoundaryAttest currently keeps caller identity simple: the host system authenticates the caller, session, service, or agent, then passes caller metadata into BoundaryAttest. For server-side tool execution, the server signs a `server_attested` receipt over the tool/action fields and any supplied caller metadata.

That means BoundaryAttest can record caller metadata, but it does not verify caller identity by itself.

## Current model

The current model is intentionally narrow:

- The host system authenticates the caller, session, or agent.
- The host passes caller metadata into BoundaryAttest.
- The server executes the tool.
- The server signs a `server_attested` receipt over the tool/action fields.

This is useful when the host runtime is trusted. The limitation is that BoundaryAttest records the caller metadata the host supplied; it does not independently verify that the named caller controlled a caller key or authenticated directly to BoundaryAttest.

## Problem

If caller metadata is weak, unauthenticated, or copied from an untrusted source, the receipt may only attest that the server was told "agent X requested this."

That can be misleading in third-party verification scenarios. A later reviewer may see caller metadata inside a signed server receipt and assume the caller identity was cryptographically bound to the request, when the current model only says the server included the host-supplied metadata in its signed receipt.

## Optional future model

A future optional feature could let the caller sign request intent before execution. The caller would sign either a request payload or a canonical request hash.

Signed fields may include:

- tool name
- args hash
- timestamp
- nonce or request_id
- caller public key id
- optional lineage reference

The flow would be:

1. Caller signs a request payload or canonical request hash before execution.
2. Server verifies the caller signature or preserves it as submitted evidence.
3. Server executes the tool.
4. Server signs a receipt containing the caller-signed request hash or signature, output hash or error hash, lineage, timestamp, and server attestation.

This keeps BoundaryAttest in the receipt/provenance layer. It does not turn BoundaryAttest into an authentication, authorization, or permission system.

## What this attests

Caller-signed requests could show that the holder of the caller key signed the request intent. Server-attested receipts could show that the holder of the server key attested to the execution result.

Together, the receipt can bind request intent to a server-attested outcome.

## What this still does not prove

This model would still have important limits:

- It does not prove the action was authorized unless an authorization system says so.
- It does not prove the business correctness of the action.
- It does not replace access control, platform logs, or approval systems.
- It does not solve key custody by itself.

The signature can show that a key signed a request. It cannot, by itself, prove who should have been allowed to sign, whether the signed request was wise, or whether the surrounding business workflow was correct.

## Trust and custody questions

Before adding caller-signed requests, BoundaryAttest would need explicit answers to several trust and custody questions:

- Where caller keys live.
- How caller keys rotate.
- Whether caller keys belong to users, agents, services, or organizations.
- Whether the server verifies the signature or only preserves it.
- How clock skew, replay protection, and nonce/request_id uniqueness should work.

These decisions belong to the host deployment and surrounding security model. BoundaryAttest can preserve and sign evidence, but it should not imply that evidence is automatically sufficient for authentication or authorization.

## Example flow

```text
caller signs: tool + args hash + timestamp + request_id
server verifies or records caller signature
server runs tool
server creates server_attested receipt:
  caller signature/hash
  output hash or error hash
  lineage
  timestamp
  server attestation
later reviewer verifies both caller signature and server signature
```

The reviewer can check that the caller key signed the request intent and that the server key signed the reported execution outcome.

## Recommendation

Treat caller-signed requests as a future optional feature. Keep the MVP host-supplied caller metadata simple for now, and continue to state clearly that BoundaryAttest does not solve authentication.
