# Code Engine MCP reverse interop fixture

The four receipt JSON files are copied from `provenance-addon/receipts/persisted-key-demo/` in the public Code Engine MCP repository. `public.pem` and `expected.json` come from `provenance-addon/interop-v0.1/ce-reverse-fixtures/`. The public reverse fixtures were published at commit [`79174e97a744d5532bd43b5d7e10e53038d51770`](https://github.com/markusvankempen/code-engine-mcp-server/commit/79174e97a744d5532bd43b5d7e10e53038d51770); `expected.json` is adjusted only so `receipt_dir` points to this vendored directory.

The upstream repository is licensed under Apache-2.0; its [license text](https://github.com/markusvankempen/code-engine-mcp-server/blob/79174e97a744d5532bd43b5d7e10e53038d51770/LICENSE) applies to the copied fixture.

Only the public SPKI key is included. No private key is copied or required.

The same commit also contains `provenance-addon/interop-v0.1/test-vectors/valid-receipt.json` and `public-key.pem` with key ID `sha256:4145925191b02ff60e26109854f74a558e941539a72e1f3bd086eadad1eb1995`. Those files are byte-for-byte copies of BoundaryAttest's own interop vector and public key. They demonstrate that Code Engine's verifier accepts the BoundaryAttest vector, but re-importing them here would only verify BoundaryAttest's own receipt again; it would not test a Code Engine-produced receipt in BoundaryAttest's verifier. That public key therefore must not be used with this reverse fixture, whose key ID is `sha256:6e7a3d1d6208531b1595bbcf6a13bc5c08da3966196d5758b71a449aee75a4cc`.

The published public key has fingerprint `sha256:6e7a3d1d6208531b1595bbcf6a13bc5c08da3966196d5758b71a449aee75a4cc`. Run all four reverse cases offline with:

```sh
npm run build
npm run example:interop-code-engine
```

The runner uses the separately published, pinned public key; it never downloads a key or trusts a key supplied inside a receipt.
