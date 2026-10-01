# SLICC transcript-export handoff → BoundaryAttest v0.2 fixture

This is a BoundaryAttest-authored synthetic interoperability fixture for the narrow SLICC transcript-export handoff boundary. It was created after the SLICC maintainer agreed the synthetic experiment sounded useful for review in [`ai-ecoverse/slicc#3603`](https://github.com/ai-ecoverse/slicc/issues/3603). It makes no SLICC code changes and is not a SLICC feature, adoption, endorsement, partnership, production integration, or statement of production support.

The upstream semantics are pinned to repository `ai-ecoverse/slicc`, commit `59672ceaad7701cd56ec32b805bdd0b9d15ac1c4`, with `docs/transcript-export.md` as the authoritative export reference and `docs/approvals.md` as the approval reference. At that commit, a transcript export is a portable ZIP containing a `schemaVersion: 1` `transcript.json`; `export.format` is `slicc-transcript`; each document has an `export.id`; the transfer checks byte length and SHA-256; and SLICC explicitly says the bundle is not digitally signed. Follower and Cherry export paths are approval-gated before transfer, with a one-time **Allow once** decision unless a SLICC `NOPASSWD Export` policy applies. Native SLICC behavior remains authoritative.

## Synthetic input and signed claim

The ZIP in `artifact/` contains only `transcript.json`. It is generated deterministically by this fixture from the documented v1 shape, uses fixed timestamps and obviously synthetic identifiers/content, excludes reasoning, and contains no real user or private data. It was **not produced by an actual SLICC runtime**, and this experiment does not run or claim SLICC schema validation.

The strict Interop Profile v0.2 envelope contains only `claim`, `signature`, and `public_key_id`. Its required claim fields are unchanged, and the `slicc_export` extension contains:

- `source`: pinned repository, commit, transcript-export doc, and approvals doc;
- `artifact`: filename, `application/zip`, `raw_bytes`, exact byte length, and SHA-256;
- `export_context`: native transcript `export_id`, synthetic session reference, format, and schema version;
- `approval_context`: export gate, synthetic `allow_once` scenario decision, `portable_native_approval_reference: "unavailable"`, and explicit synthetic provenance; and
- `adapter`: the identity and narrow scope of the BoundaryAttest synthetic export adapter.

SLICC's documented transcript format exposes the export ID, but these pinned docs do not expose a durable portable native approval receipt/reference at this boundary. The fixture therefore does not invent one. The approval fields are signed synthetic scenario context, not cryptographic evidence of a real SLICC approval.

The fixture uses Ed25519 over RFC 8785/JCS canonical claim bytes. Verification receives the expected public key independently from `boundaryattest-public-key.pem`; it never trusts a key embedded in the receipt and does not require the test-only private key or a SLICC runtime.

## What successful verification means

Successful verification establishes only that the independently expected synthetic export signer signed an unchanged claim binding this exact transcript-export ZIP byte sequence and this selected export context.

It does **not** establish that a real SLICC runtime created the ZIP; that the transcript is complete, truthful, correct, or contains every relevant event; that a human approval occurred in a real deployment; approver identity beyond SLICC's own model; runtime integrity; authorization correctness; execution correctness; safe production key custody; SLICC adoption or endorsement; or production interoperability.

SLICC already provides SHA-256 transfer integrity: exact received bytes match the transfer digest. This fixture explores a distinct external-verifier property: an expected public-key signer committed to the exact exported bytes after the originating runtime or session may be unavailable. If a recipient already trusts and can reach the originating SLICC runtime and does not need independent later verification, BoundaryAttest may be redundant.

`test-only-boundaryattest-private-key.pem` is public fixture material for deterministic regeneration only. It is unsafe for production and demonstrates no production key-custody design.

## Verify and regenerate

```sh
npm run build
npm run example:slicc-transcript-export-v0.2
npm run generate:slicc-transcript-export-v0.2
git diff --exit-code -- examples/slicc-transcript-export-v0.2
```

The verifier checks the strict v0.2 envelope, expected key ID, Ed25519/JCS signature, `raw_bytes` representation, exact ZIP digest and byte length, and required narrow SLICC fixture context. Focused tests cover the valid fixture, ZIP tampering, a wrong independent key, unsigned claim tampering, correctly signed wrong digest and byte length, and missing or malformed `slicc_export` fields. Cryptographic failures are reported separately from semantic and artifact-binding failures.
