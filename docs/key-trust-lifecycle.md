# Key trust and lifecycle

Status: operational guidance for BoundaryAttest deployments. This document does not change the BoundaryAttest Interop Profile v0.2 envelope, signature algorithm, canonicalization rules, or verification semantics.

BoundaryAttest can prove that a receipt validates under an independently expected Ed25519 public key and that the signed claim has not changed. For exact-artifact receipts, it can also prove that the supplied artifact bytes still match the digest and byte length committed to by the signer.

That is different from proving that the signer is currently trusted, authorized, correctly identified, uncompromised, or entitled to make the claim.

## Core rule

Verification answers:

> Does this receipt validate under the independently expected key?

It does not answer:

> Is this signer currently authorized or trusted by my organization?

A relying party therefore needs two separate decisions:

1. **Cryptographic verification** — does the receipt validate under the expected key?
2. **Trust/governance evaluation** — should this key be trusted for this claim, role, profile, and time?

BoundaryAttest implements the first decision. The second belongs to the deployment, operator, relying party, or application-specific profile.

## Expected-key trust

The verifier must receive the expected public key independently from the untrusted receipt and artifact.

A public key delivered only beside the receipt does not establish trust. An attacker able to replace both the receipt and the public key could otherwise substitute its own signing identity.

Possible independently trusted distribution mechanisms include:

- deployment or service configuration controlled by the relying party;
- a pinned public key or fingerprint;
- an organization-managed key directory;
- a separately authenticated configuration channel;
- a managed key or certificate system already trusted by the deployment.

BoundaryAttest does not prescribe one distribution system.

The important property is that the relying party decides which key to expect through a trust path that is independent of the artifact being verified.

## What `public_key_id` means

Interop v0.2 defines `public_key_id` as:

```text
sha256:<lowercase SHA-256 hex of the Ed25519 public key SPKI DER bytes>
```

This identifier is a deterministic fingerprint of a public key.

It is useful for:

- correlating a receipt with the expected public key;
- detecting that a different key was supplied;
- retaining key history across rotations;
- displaying which key was used for a receipt.

It is **not**:

- a human or organization identity;
- proof that the key holder is authorized;
- a certificate;
- a revocation status;
- proof that the key is still trusted;
- proof that the runtime holding the private key was uncompromised.

A matching `public_key_id` means only that the verifier's independently supplied public key has the same fingerprint recorded by the receipt.

## Rotation

A new signing key produces a new `public_key_id`.

BoundaryAttest does not silently reinterpret historical receipts under a replacement key. Historical receipts should continue to be verified against the historical expected public key that was trusted for those receipts.

A simple rotation model is:

```text
period 1
  key A trusted
  receipts reference key-id A

rotation / cutover
  publish or distribute key B through the relying party's trusted channel
  update signing authority according to deployment policy

period 2
  key B trusted
  new receipts reference key-id B

historical verification
  old receipt -> verify with historical expected key A
  new receipt -> verify with expected key B
```

Deployments may choose a short overlap period in which both keys are accepted, or a strict cutover where only the new key is accepted for new receipts. That is a trust-policy decision outside the receipt format.

A production profile should define:

- when the new key becomes valid for new receipts;
- whether an overlap period exists;
- which key IDs are accepted for which signer role or profile;
- how historical keys remain available for later verification.

## Revocation and compromise

BoundaryAttest v0.2 does not provide:

- a revocation service;
- a certificate revocation list;
- an online trust registry;
- a transparency log;
- an independent timestamp authority;
- retroactive invalidation rules.

A receipt can remain cryptographically valid even after its signing key is no longer trusted.

For example, if key A is compromised, an old receipt may still have a valid Ed25519 signature under key A. Cryptographic verification alone cannot determine whether that receipt was created before or after the compromise.

The receipt's `timestamp` is inside the signed claim, so it is protected from later modification. It is still a signer-asserted timestamp unless another trusted system independently anchors time.

A deployment that needs compromise handling should retain external trust metadata such as:

- the key ID;
- the key's accepted role/profile;
- trust start and end dates if policy uses them;
- rotation or revocation records;
- compromise reports or incident references;
- any independent timestamp or transparency evidence the deployment chooses to use.

BoundaryAttest should not invent retroactive trust semantics that the deployment cannot actually prove.

## Private-key custody and signing authority

Possession of a private key allows creation of valid signatures under the corresponding public key. That makes key custody part of the trust model.

The PEM files created by `boundaryattest keygen` are useful for local testing, interoperability checks, development, and small controlled experiments. Owner-only file permissions reduce accidental exposure, but a local PEM file is not by itself a complete production key-management design.

Production deployments may choose mechanisms such as:

- operating-system protected key storage;
- a managed KMS;
- an HSM or hardware-backed key;
- an operator-controlled secret store;
- another deployment-specific signing service.

BoundaryAttest does not require or endorse a particular provider.

The deployment must separately decide:

- who or what is allowed to invoke signing;
- which signer role the key represents;
- which action/profile that key is authorized to sign;
- how access to the private key is controlled and audited.

A valid signature proves possession/use of the key, not that the use was authorized.

## Historical verification and retention

To make later verification reproducible, retain enough information to reconstruct the original trust decision.

At minimum, a relying party should consider retaining:

- the exact artifact bytes;
- the BoundaryAttest receipt;
- the historical expected public key or a durable reference to it;
- the key ID;
- the application/profile version used to interpret the claim;
- any external trust-policy record needed to decide whether that key was accepted for that purpose.

The private key is **not** required for verification and should not be retained merely to verify old receipts.

Deleting historical public-key or trust-policy records can make later verification incomplete or ambiguous even when the artifact and receipt still exist.

Application-specific retention policy may also need to account for privacy, contractual, regulatory, or data-minimization requirements.

## Application-specific profiles

The generic BoundaryAttest protocol should define the cryptographic envelope and its verification limits. Application-specific profiles should define the semantics that cannot be inferred generically.

A profile should consider specifying:

- the exact artifact or canonical payload being handed off;
- the signer role and what that role is allowed to claim;
- the action type and status semantics;
- which key IDs or trust anchors are expected;
- key-rotation expectations;
- sensitive-field minimization before export;
- retention expectations for artifact + receipt + trust metadata;
- whether additional independent timestamp, transparency, or audit evidence is required.

For example, an audit-delivery profile may need different signer authority and data-minimization rules from a software-release profile even though both use the same v0.2 envelope.

## Operational checklist

Before treating a BoundaryAttest handoff as production-ready, answer these questions explicitly:

- What exact artifact or claim is being signed?
- Who or what owns the signing key?
- What signer role does the key represent?
- How does the relying party obtain the expected public key independently?
- What does `public_key_id` identify in this deployment?
- How are key rotations communicated?
- How are historical public keys retained?
- What happens when a key is suspected or confirmed compromised?
- Does the workflow require an independent time source or transparency system?
- Which sensitive fields should be removed before export?
- Which artifact, receipt, and trust-policy records must be retained?
- What does a successful verification explicitly **not** prove?

If those questions are unanswered, the signature may be cryptographically valid while the surrounding trust decision remains underspecified.

## Non-goals

This guidance does not add:

- hosted key management;
- a revocation API;
- a certificate authority;
- a KMS/HSM integration;
- a new receipt field;
- a new receipt version;
- a claim that signatures prove identity, authorization, truth, completeness, compliance, runtime integrity, or current trust.

Those require separate systems or application-specific policy.
