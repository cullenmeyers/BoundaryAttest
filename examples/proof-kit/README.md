# BoundaryAttest Proof Kit v0.1

BoundaryAttest creates portable signed attestations for consequential agent or tool actions that cross trust boundaries.

This proof kit is intentionally small. It is an example/demo artifact, not a receipt standard, product, SaaS, account system, dashboard, compliance workflow, legal proof system, hosted key manager, or runtime-integrity system. It is a concrete artifact for outreach and validation: three signed example receipts, a tiny verifier, and a short explanation of what those receipts do and do not prove.

## Logs vs BoundaryAttest

Normal logs are useful for local debugging and operational history. They usually live inside one system, can be rewritten by that system, and are not designed to travel as standalone proof artifacts.

BoundaryAttest receipts are portable signed claims. A verifier can check that a specific signing key signed a specific receipt payload and that the signed content has not been altered since signing.

A receipt proves only that:

- a specific signing key signed the receipt payload;
- the signed receipt content has not been altered;
- the receipt fields make a concrete claim about an action, its hashes, status, time, signer, and optional lineage.

A receipt does not prove real-world truth, authorization, compliance, signer trustworthiness, runtime integrity, or business outcome.

## Verify A Receipt

Build the project, then run the proof-kit verifier:

```sh
npm run build
npm run example:proof-kit
```

You can also verify one receipt:

```sh
node dist/examples/proof-kit/verify-proof-kit.js examples/proof-kit/receipts/02-mcp-filesystem-write.json
```

The verifier uses a pinned demo public key for the receipts in this folder. That behavior is demo-only. A production verifier would need a real trust decision for which signers are acceptable.

Try changing any signed field in a copied receipt. The verifier should report an invalid signature.

## Three Example Receipts

### 1. Host-signed boundary event

File: `receipts/01-host-signed-boundary-event.json`

This example is based on the Intergrax EBE-9 pattern. The host signature and the BoundaryAttest client-observed wrapper stay separate.

The host-signed event is the host/runtime claim about a boundary event. The BoundaryAttest receipt is a separate `client_observed` wrapper: it says the BoundaryAttest-side demo signer observed and wrapped a hashed version of that event.

This proof kit does not re-verify a live Intergrax host event. The repository's Intergrax PoC adapter contains the fuller host-attestation path.

### 2. MCP filesystem write

File: `receipts/02-mcp-filesystem-write.json`

This example is based on a `write_file`-style MCP action. The receipt uses hashes and a redacted preview, not raw file contents.

That keeps the receipt shareable while still making tampering with the receipt itself detectable. The receipt does not prove the file truly exists now or that the write was authorized.

### 3. Private data to public/shareable dashboard

File: `receipts/03-private-data-to-public-dashboard.json`

This illustrative example is based on a TableCharts-style boundary: private business data becomes a shareable or public artifact. It is not a claim that a production TableCharts integration exists in this repository.

The receipt records hashes for the private source claim and the published artifact claim. It does not prove the dashboard is accurate, approved, compliant, still available, or safe to share.

## Which Actions Need Receipts?

This is a static judgment table, not a classifier.

| Action | Suggested evidence |
| --- | --- |
| search internal docs | normal logs |
| summarize local file | normal logs |
| list allowed directories | normal logs or lightweight receipt |
| write file through MCP | receipt useful |
| create issue/task | receipt useful |
| publish dashboard | receipt strongly useful |
| send email | approval + receipt |
| update CRM record | receipt strongly useful |
| delete file | approval + receipt |

## Limits / What This Does Not Prove

BoundaryAttest receipts are narrow cryptographic evidence. They do not prove:

- the signer was trustworthy;
- the signer had authority;
- the action was legal, compliant, or approved;
- the real-world event happened exactly as described;
- the runtime, browser, host, MCP server, dashboard, or filesystem was uncompromised;
- the input or output hashes correspond to data you have not independently obtained;
- the business outcome was successful.

Use receipts as one portable evidence layer, not as the whole trust model.
