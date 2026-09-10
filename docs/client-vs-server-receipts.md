# Client-Observed vs Server-Attested Receipts

BoundaryAttest currently supports two receipt roles:

- `client_observed`: the client wraps a tool call and records what it observed sending and receiving.
- `server_attested`: the server wraps the tool handler and records what the server attests happened.

Client-observed receipts are useful when you control the client boundary. They are signed claims about what a cooperating participating client observed sending and receiving. They do not discover unwrapped activity, automatically detect shadow MCP traffic, prove every tool call passed through that client, or cover a non-cooperating client.

Server-attested receipts can be more directly attributable evidence for third-party review because the executing server signs its own claim. `server_attested` means that this runtime or operator, under the expected key, signed the claim; it does not make the signer independent or the claim objectively true. Its value depends on expected-key distribution, key custody, signer trust, runtime integrity, and relying-party policy.

When the host application supplies caller metadata, a server-attested receipt has a stronger shape: server attests caller X invoked tool Y with args Z. BoundaryAttest records that caller metadata into the signed receipt, but it does not authenticate the caller itself. The host server or runtime remains responsible for authentication.

This server-side receipt work is experimental. It is not a formal receipt standard, MCP standard, production trust model, authorization system, or compliance-grade audit system.

See [When to use BoundaryAttest](when-to-use-boundaryattest.md) for the practical selection test and history limitations.
