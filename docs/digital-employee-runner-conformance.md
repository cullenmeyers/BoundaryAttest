# Digital Employee Runner cross-language conformance check

This note records an independent Python check of the public Digital Employee Runner protocol vectors. It is an interoperability result, not a BoundaryAttest integration proposal.

## Upstream input

- Repository: `bytefolk/digital-employee`
- Pinned commit: `3679b73f73e1d5e4b1140872b09a847d2e3ecee5`
- Vector directory: `fixtures/runner-protocol-vectors/v1/`
- Protocol version: `digital-employee.runner-protocol.v1`

The check used a small independent Python implementation and did not import Digital Employee code. Ed25519 verification used Python `cryptography`; JSON canonicalization was independently implemented for the Runner envelope value space, including UTF-16 property ordering and the Runner safe-integer restriction.

## Results

The current corpus passed the checks exercised here:

- `canonical_bytes`: **12/12** current accept vectors reproduced byte-for-byte, including the non-ASCII string case and `MAX_SAFE_INTEGER` boundary case.
- The `valid-bundle` task payload decoded and re-canonicalized to the exact signed payload bytes.
- The `valid-bundle` receipt payload decoded and re-canonicalized to the exact signed payload bytes.
- The platform task Ed25519 signature verified using the independently supplied DER/SPKI public key and the `digital-employee.runner-task.v1` domain prefix.
- The Runner receipt Ed25519 signature verified using the independently supplied DER/SPKI public key and the `digital-employee.runner-receipt.v1` domain prefix.
- The single event in the `valid-bundle` recomputed to `sha256:5ded5f44a88c80f68205e10d67d082cfa387e979bada69ea8632c2da1e7f3ef3` using the `digital-employee.runner-event.v1` domain prefix.
- The receipt `eventCount` and `finalEventDigest` matched the recomputed event chain.
- The shared task/receipt identity, attempt/fencing, lease/quote/reservation/seller/runner, engine, and employee id/version/package-digest bindings matched.
- The task carries `nonce`; the receipt does not, confirming that a receipt-only projection would lose that replay binding.
- Changing only the envelope `keyId` did not change the signature-verification bytes when the same public key was independently supplied, confirming the upstream caveat that `keyId` itself is not authenticated by the Ed25519 signature.

Negative sanity checks also behaved as expected: mutating the signed payload, mutating the signature, or verifying the task signature under the receipt domain all failed Ed25519 verification.

## Scope and limits

This is deliberately narrower than a full independent reimplementation of every Runner protocol validator. It tests the current canonical-byte accept corpus plus the cryptographic and digest bindings of the checked-in `valid-bundle` fixture.

It does not validate the private key registry, historical key-validity windows, revocation, platform `UsageVerifier`, production key custody, runtime integrity, or the truth/completeness of Runner claims.

The result supports the upstream maintainer's conclusion that the native Runner execution bundle is already a strong portable evidence object. A BoundaryAttest re-signing wrapper would not improve the checked cryptographic bindings and could weaken evidence if it replaced the complete native task + ordered event chain + receipt bundle with a selective projection.

The remaining portability question is therefore signer trust over time: how an external verifier independently resolves the correct historical public key and its validity/revocation status. That is separate from evidence encoding.
