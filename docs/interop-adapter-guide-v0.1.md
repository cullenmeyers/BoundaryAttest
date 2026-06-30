# Dependency-Free Interop Adapter Guide v0.1

An external adapter can produce and verify BoundaryAttest Interop Profile v0.1 receipts without importing BoundaryAttest as a runtime dependency. Implementers may copy the profile requirements and implement them locally, or use BoundaryAttest helper code if convenient. The wire format and verification rules are the compatibility boundary.

This guide does not define a new receipt shape. Follow the [Interop Profile v0.1](interop-profile-v0.1.md), its [JSON Schema](schemas/interop-receipt-v0.1.schema.json), and the published test vectors.

## Producing receipts

1. Choose selected boundary events worth making portable. Prefer consequential state changes and trust-boundary actions over routine diagnostic noise.
2. Map each selected local event into a `claim` object containing all required fields: `receipt_version`, `receipt_role`, `event_id`, `timestamp`, `action_type`, and `status`.
3. Add `target_ref`; an `artifact_hash` or another clearly named object/content hash for produced or modified artifacts; and a `trace_ref` or `lineage_ref` when available.
4. Put optional correlation data and all adapter-specific extensions inside `claim`, where the signature covers them. The adapter may keep its own local event shape.
5. Canonicalize exactly the `claim` value using the profile's v0.1 canonicalization rules, then encode the canonical string as UTF-8.
6. Sign those canonical claim bytes with Ed25519.
7. Emit the unchanged v0.1 envelope with `claim`, the base64 `signature`, and `public_key_id` calculated from the signing public key using the profile's key-ID convention.

Use a minimal claim for broad compatibility. Add extended fields when they materially improve reconstruction or correlation. `previous_receipt_hash` is optional and future-facing unless the adapter maintains and verifies a real receipt chain.

## Verifying receipts

Use the profile's required check order and normative failure reason codes. In summary, check JSON parsing and envelope structure first, then required claim fields, supported version and role, the expected public-key identifier, and finally the Ed25519 signature over the canonical claim. Reject missing required fields. After those checks pass, ignore unknown signed claim fields by default.

The verifier must obtain the expected public key from its caller or another trusted configuration. A key supplied beside an untrusted receipt does not establish trust. Use the published vectors to confirm that canonicalization, key identification, check precedence, and failure codes match the profile.

## Evidence and trust boundary

Keep logs, traces, platform audit records, and other operational systems as the source of truth. An interop receipt is a portable signed claim that can correlate with those records; it is not a replacement for them.

Producing or successfully verifying a receipt does not establish that the claim is true, the action was authorized or safe, the signer or runtime was trustworthy, a compliance requirement was met, or the runtime retained its integrity. Those remain policy and trust decisions outside this profile.
