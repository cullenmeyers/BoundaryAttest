# Grantex external-executor receipt v0.1 synthetic fixture

This runnable fixture implements the narrow executor-owned claim discussed in [mishrasanjeev/grantex#2109](https://github.com/mishrasanjeev/grantex/issues/2109).

It is **not** a Grantex implementation, integration, endorsement, partnership, or production deployment. The grant, input, output, identities, timestamps, and executor are synthetic.

## Boundary being tested

Grantex owns the authority evidence. The independently operated executor owns only its separate statement:

> I checked this grant under these conditions and observed/performed this action.

The fixture therefore does not wrap or reinterpret Grantex authority evidence.

```text
synthetic Grantex-style grant
        |
        | referenced by id + digest
        v
synthetic external executor
        |
        | signs its own claim
        v
BoundaryAttest Interop v0.2 receipt
```

## What the signed executor claim carries

- grant id;
- SHA-256 over RFC 8785/JCS canonical grant bytes;
- authority-check results;
- revocation check method, timestamp, and result;
- SHA-256 over RFC 8785/JCS canonical input;
- SHA-256 over RFC 8785/JCS canonical output when one is known; and
- outcome: `succeeded`, `failed`, or `unknown`.

The grant token itself is forbidden from the receipt.

## What the runnable checks prove

The example checks:

1. a valid executor-owned BoundaryAttest v0.2 receipt;
2. a changed grant artifact fails the grant digest binding;
3. changed canonical input fails;
4. changed canonical output fails;
5. a correctly signed receipt that embeds a grant token still fails semantic validation; and
6. a timeout-style `outcome: unknown` succeeds without inventing an output claim.

This intentionally separates cryptographic verification from profile semantics. A valid BoundaryAttest signature is necessary but not sufficient.

## Run

```sh
npm run build
npm run example:grantex-external-executor-v0.1
npm test
```

The fixture reuses the repository's public test-only Interop v0.2 key material. Those keys are unsafe for production and establish no real identity or key-custody model.

See [the draft profile](../../docs/grantex-external-executor-receipt-profile-v0.1-draft.md) for the architecture and non-proofs.
