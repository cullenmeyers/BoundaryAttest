# Client-Observed vs Server-Attested Receipts

AgentReceipt currently supports two receipt roles:

- `client_observed`: the client wraps a tool call and records what it sent and received.
- `server_attested`: the server wraps the tool handler and records what the server says it actually ran.

Client-observed receipts are useful when you control the client boundary. They can show that a client attempted a tool call with particular arguments and observed a particular result or error.

Server-attested receipts are stronger for third-party proof because they are emitted closer to the source of truth for tool execution. The server handler boundary knows which arguments reached the server, whether the handler ran, and what result or error the handler returned.

This server-side receipt work is experimental. It is not a formal receipt standard, MCP standard, or production trust model.
