# ShipFrame-style release-evidence handoff → BoundaryAttest v0.2 fixture

This is a BoundaryAttest-authored synthetic interoperability experiment for the narrow release-evidence handoff boundary discussed in [`juanitourquiza/shipframe#27`](https://github.com/juanitourquiza/shipframe/issues/27), following the maintainer's [approval to build the synthetic experiment outside ShipFrame](https://github.com/juanitourquiza/shipframe/issues/27#issuecomment-6173503116). It changes no ShipFrame code and makes no claim of ShipFrame adoption, integration, endorsement, partnership, or production support.

The native references are pinned to repository `juanitourquiza/shipframe`, commit `1cd40df17baacb164ed693acf640bf7e372d194c`:

- `skills/deploy-evidence/SKILL.md`
- `skills/evidence-audit/SKILL.md`
- `skills/proof-runner/SKILL.md`

ShipFrame remains authoritative for whether release or deployment evidence is valid. This fixture neither reinterprets nor replaces its evidence semantics, including the evidence-audit distinction among Verified, Partially verified, and Unverified.

## Exact synthetic package

`package/shipframe-release-package.zip` is deterministic and contains exactly, in fixed order:

1. `release-report.md`
2. `evidence-manifest.json`

Both files use fixed, obviously synthetic data. The report resembles the native deploy-evidence report shape (environment, commit/version, timestamp, collected evidence, smoke checks, gaps, and verdict), but **no commands ran and ShipFrame did not generate it**. It is only a native-style synthetic artifact. The manifest contains two synthetic selected-evidence references and deterministic placeholder digests under `provenance: "synthetic_fixture_context"`; it records no real CI, deployment, or provider observation.

The ZIP uses stored entries, fixed DOS-epoch timestamps, fixed UTF-8 metadata, and no variable comments or extras. SHA-256 and byte length are computed over the final raw ZIP bytes, and those exact values are signed in the receipt.

## Receipt and expected-key model

`boundaryattest-receipt.json` uses the strict Interop Profile v0.2 envelope containing only `claim`, `signature`, and `public_key_id`. The claim uses Ed25519 over RFC 8785/JCS canonical bytes and binds the exact package plus pinned source references, synthetic export context, signer-asserted time semantics, and the narrow adapter scope.

The verifier must receive the expected public key independently. The checked-in `boundaryattest-public-key.pem` represents that out-of-band input for this fixture; a key bundled with, embedded in, or merely supplied alongside an untrusted receipt cannot establish trust by itself. Verification requires neither the private key nor ShipFrame runtime, original CI, deployment, or provider access.

The timestamp is **signer-asserted only**. It is not independently witnessed.

## What successful verification means

Successful verification means only:

> The independently expected exporter signed this exact package, and the package has not changed.

It does **not** establish release correctness, evidence completeness, runtime integrity, deployment truth, independently witnessed time, production key custody, or ShipFrame adoption/integration/endorsement. It also does not establish that ShipFrame generated the package or that any synthetic evidence statement corresponds to a real command or external system.

`test-only-boundaryattest-private-key.pem` is intentionally public fixture material used only for deterministic regeneration and negative tests. It is unsafe for production and demonstrates no production key-custody design.

## Verify and regenerate

```sh
npm run build
npm test
npm run example:shipframe-release-handoff-v0.2
npm run generate:shipframe-release-handoff-v0.2
git diff --exit-code -- examples/shipframe-release-handoff-v0.2
```

Focused tests cover a valid fixture; one-byte package tampering; rebuilding after changing either package member; a wrong independently supplied key; unsigned claim tampering; correctly signed wrong digest and length; missing or malformed extension fields; and rejection of an attacker-supplied bundled key. Cryptographic, semantic, and artifact-binding failures remain distinguishable.
