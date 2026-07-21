# Experimental TrustMCP post-scan receipt

This examples-only prototype shows a separate post-scan receipt layer. TrustMCP remains the scanner and the source of its JSON, SARIF, baseline, and GitHub Action artifacts. After TrustMCP has produced those artifacts, this example canonicalizes three synthetic JSON artifacts, hashes them, records the scan gate decision in a BoundaryAttest claim, signs the claim, and verifies the receipt with BoundaryAttest's existing interop verifier.

This is experimental and is not an official TrustMCP integration. It is not a TrustMCP dependency, scanner plugin, or CI integration.

## Run it

From the repository root:

```sh
npm run build
npm run example:trustmcp-post-scan
```

The example reads:

- `sample-trustmcp-report.json`, shaped around TrustMCP's documented machine-readable JSON fields
- `sample-trustmcp-config.json`, representing the effective scan and gate configuration
- `sample-trustmcp-baseline.json`, representing the baseline applied to the scan

Each parsed JSON value is serialized with BoundaryAttest's deterministic, recursively key-sorted JSON representation before SHA-256 hashing. The receipt binds the resulting report, effective-config, and baseline hashes to the post-scan gate decision and target identity. It also binds a hash of the example rule metadata.

The example uses BoundaryAttest's existing local example key setup and interop v0.1 envelope and verifier. It prints the gate result, all three artifact hashes, and explicit signing and verification results. The synthetic fixture passes because its only new finding is below the configured `high` failure threshold.

## What the receipt means

The receipt proves only that a specific signer signed a specific post-scan claim and that the signed claim has not been altered.

It does **not** prove:

- that the scanned MCP server is safe
- that the scanner was complete
- that the effective configuration was wise
- that the baseline was appropriate
- that the gate threshold or decision was wise

TrustMCP's portable scan artifacts remain the evidence being referenced. BoundaryAttest adds integrity and signer attribution to this particular post-scan claim; it does not reinterpret or strengthen the scanner's security conclusions.
