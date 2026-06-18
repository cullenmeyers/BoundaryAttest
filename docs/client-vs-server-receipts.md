# Client-Observed vs Server-Attested Receipts

BoundaryAttest currently supports two receipt roles:

- `client_observed`: the client wraps a tool call and records what it observed sending and receiving.
- `server_attested`: the server wraps the tool handler and records what the server attests happened.

Client-observed receipts are useful when you control the client boundary. They are signed claims about what the client observed sending and receiving.

Server-attested receipts are stronger evidence for third-party review because they are emitted closer to the source of truth for tool execution. They record what the server attests happened, assuming the server key and runtime are trusted.

When the host application supplies caller metadata, a server-attested receipt has a stronger shape: server attests caller X invoked tool Y with args Z. BoundaryAttest records that caller metadata into the signed receipt, but it does not authenticate the caller itself. The host server or runtime remains responsible for authentication.

This server-side receipt work is experimental. It is not a formal receipt standard, MCP standard, production trust model, authorization system, or compliance-grade audit system.
