# Interop v0.1 verification: trust and limitations

BoundaryAttest Interop Profile v0.1 verification is a narrow structural and cryptographic check. It is not a decision about whether an action or signer should be trusted.

## What passing verification establishes

A passing v0.1 verification establishes only that:

- the receipt has the expected envelope shape;
- the claim uses a supported receipt version and includes the required fields;
- the fingerprint of the verifier's expected public key matches `public_key_id`;
- that expected public key verifies the Ed25519 signature over the canonical claim; and
- the signed claim has not changed since it was signed.

The expected public key must come from the verifier or another trusted configuration path. A key distributed with an untrusted receipt does not establish signer trust.

## What passing verification does not establish

Passing verification does not prove that:

- the claim is true;
- the action was authorized;
- the signer was trustworthy;
- the signing key was properly controlled;
- the signer or execution runtime was uncompromised;
- an artifact is safe, correct, or fit for purpose;
- an artifact is still available;
- the action was compliant or legal;
- the intended business outcome succeeded; or
- the available lineage, replay, or reconstruction context is sufficient.

## Checks left to relying-party policy

Interop v0.1 does not define a trust registry or policy engine. A relying party must decide which additional checks its use case requires, including:

- timestamp freshness and acceptable clock skew;
- key revocation and compromise handling;
- key rotation and historical-key retention;
- signer identity and trust;
- authorization, grant, and policy validity at the time of the action;
- artifact availability and hash revalidation; and
- the replay boundary: which inputs, outputs, dependencies, environment details, and lineage are required to reconstruct or assess the action.

These policy checks can reject a cryptographically valid receipt. Passing the v0.1 verifier is necessary only when a relying party chooses to depend on this receipt format; it is never sufficient for a broader trust, safety, legal, compliance, or business decision.
