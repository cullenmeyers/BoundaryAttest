# Grantex external-executor receipt profile v0.1 (draft)

Status: experimental, documentation-only adapter profile. This does not change BoundaryAttest Interop v0.2 or Grantex.

Runnable synthetic fixture: [`examples/grantex-external-executor-v0.1/`](../examples/grantex-external-executor-v0.1/).

## Why this profile exists

Grantex owns delegated authority evidence. An independently operated executor may be able to verify a Grantex grant without being the Grantex tenant that can write authoritative tenant records back into the evidence package.

In that case the executor has a distinct claim to make:

> I verified this authority under these inputs and conditions, and I observed or performed this action.

That claim belongs to the executor, not to Grantex.

This profile follows the architecture discussion in [mishrasanjeev/grantex#2109](https://github.com/mishrasanjeev/grantex/issues/2109), where the maintainer explicitly distinguished Grantex's authority claim from an external executor's attributable action/effect claim.

## Composition rule

```text
Grantex grant / authority evidence
        |
        | verified by
        v
external executor
        |
        | signs its own claim
        v
BoundaryAttest executor receipt
        |
        | digest may be referenced by
        v
Grantex evidence package / auditor / relying party
```

Do not wrap or restate the Grantex grant as if BoundaryAttest were authoritative for its semantics. Reference the grant and let Grantex remain authoritative.

## Suggested signed extension

A BoundaryAttest Interop v0.2 `server_attested` claim may include an adapter-specific extension like:

```yaml
executor_assertion:
  profile: boundaryattest.grantex-executor.v0.1

  grant:
    id: ...
    digest: sha256:...

  authority_checks:
    grant_signature: verified
    audience: verified
    permission: verified
    caps: verified
    revocation:
      method: online | feed | offline
      checked_at: 2026-11-28T00:00:00Z
      result: verified | unknown | failed

  input:
    digest: sha256:...
    representation: rfc8785_jcs

  output:
    digest: sha256:...
    representation: rfc8785_jcs

  outcome: succeeded | failed | unknown
```

## Grant handling

Reference the grant by stable identifier and digest. Do not embed the grant token in the receipt.

The digest representation MUST be defined by the adapter. Where structured JSON is hashed for interoperability with Grantex tool-call hashes, use SHA-256 over RFC 8785 JCS bytes.

The BoundaryAttest receipt does not prove that the referenced grant was valid. A relying party verifies the grant and grant chain under Grantex's rules.

## Revocation

Record both:

- how revocation was checked: `online`, `feed`, or `offline`; and
- when the check occurred.

An authentic historical receipt only proves what the executor claims it checked at that time. It does not prove the grant remains unrevoked later.

## Outcome

`unknown` is required for cases such as timeout or connection loss where the executor cannot truthfully distinguish success from failure.

Do not map uncertainty to `failed` or `succeeded` merely to produce a terminal-looking result.

## Evidence-package binding

A Grantex evidence package can reference the executor receipt digest as extension data without making Grantex the signer of the executor's statement.

The package signature may establish that Grantex received and retained the reference. The executor's BoundaryAttest signature remains the attribution mechanism for the executor-originated claim.

## Non-proofs

The receipt does not prove:

- that Grantex issued a valid grant unless the grant is separately verified;
- that the executor's runtime was uncompromised;
- that an observed API success equals the intended real-world effect;
- that the executor checked every possible authorization condition;
- that a historically valid grant remains valid now;
- that the action was correct or desirable.
