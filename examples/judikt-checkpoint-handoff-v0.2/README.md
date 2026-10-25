# Judikt audit checkpoint handoff → BoundaryAttest v0.2 reference PoC

This is a BoundaryAttest-authored synthetic reference PoC against the pinned Judikt audit-checkpoint format, built after the Judikt maintainer identified the checkpoint as the right receipt seam and invited an example in [`gaurav-gs7/Judikt#2`](https://github.com/gaurav-gs7/Judikt/issues/2#issuecomment-6396544950). It is not a merged integration, official Judikt support, Judikt adoption, a partnership, an endorsement, or production interoperability.

The Judikt semantics are pinned to repository `gaurav-gs7/Judikt`, commit `16f6b911ff550d3213605e5e91a2289e0352fb5c`, especially:

- `src/judikt/audit.py`
- `src/judikt/cli.py`

Judikt remains authoritative for the audit chain, checkpoint creation, native HMAC verification, retention, delivery, and operational semantics.

## The bounded experiment

`judikt-native-checkpoint.json` is a synthetic checkpoint rendered in the exact local-file representation used by `judikt audit checkpoint --output ...`: sorted, indented JSON followed by one trailing newline.

The checkpoint contains Judikt's native fields:

- `chain_id`
- `seq`
- `head_hash`
- `created_at`
- `signature`

Its fixture-only native signature reproduces Judikt's current HMAC-SHA256 checkpoint semantics. A separate BoundaryAttest Interop Profile v0.2 `server_attested` claim represents a synthetic export adapter, not the Judikt runtime. It binds:

- the SHA-256 of the exact exported checkpoint bytes;
- the checkpoint `chain_id`;
- the checkpoint `seq`;
- the checkpoint `head_hash`; and
- the pinned Judikt source revision used to model the format.

The BoundaryAttest envelope contains only `claim`, `signature`, and `public_key_id`. Its Ed25519 signature covers RFC 8785/JCS canonical bytes of the claim. The expected public key is supplied independently from `boundaryattest-public-key.pem`.

## Native checkpoint representation

At the pinned Judikt revision, `_sign_checkpoint()` HMAC-signs the compact, key-sorted JSON representation of:

```json
{
  "chain_id": "...",
  "seq": 128,
  "head_hash": "...",
  "created_at": "..."
}
```

`write_checkpoint()` then exports the full signed checkpoint with Python `json.dumps(checkpoint, indent=2, sort_keys=True) + "\\n"`.

This fixture reproduces both representations separately:

- native HMAC input: logical checkpoint fields in Judikt's compact sorted encoding;
- external artifact binding: SHA-256 over the exact bytes written to `judikt-native-checkpoint.json`.

A whitespace change or added newline therefore changes the BoundaryAttest artifact digest even when the parsed JSON values are otherwise equivalent.

**TEST / FIXTURE ONLY — NEVER FOR PRODUCTION USE:** `TEST-ONLY-JUDIKT-AUDIT-HMAC-SECRET-DO-NOT-USE-IN-PRODUCTION` and `test-only-boundaryattest-private-key.pem` are public fixture material for deterministic regeneration only.

## Verify and regenerate

```sh
npm run build
npm test
npm run example:judikt-checkpoint-handoff-v0.2
npm run generate:judikt-checkpoint-handoff-v0.2
git diff --exit-code -- examples/judikt-checkpoint-handoff-v0.2
```

`verify-native.ts` uses the fixture-only shared HMAC secret to reproduce Judikt's native checkpoint verification boundary.

The separate `verify.ts` receives only the BoundaryAttest receipt, frozen checkpoint bytes, and an independently supplied expected Ed25519 public key. It first verifies the strict v0.2 envelope/key ID/JCS signature, then hashes the raw checkpoint bytes and compares `chain_id`, `seq`, and `head_hash` with the frozen checkpoint. It does **not** import, need, or use the Judikt HMAC secret.

## Trust model

| Layer | Establishes | Does not establish |
|---|---|---|
| Judikt native HMAC checkpoint | Integrity/authentication inside a trust domain whose verifiers possess the HMAC secret, plus a reference to one audit-chain head | Which secret-holder created it; independent third-party attribution; truth, authorization, or uncompromised execution |
| BoundaryAttest checkpoint handoff | The independently expected export key signed an unchanged claim binding the exact exported checkpoint bytes and selected checkpoint identifiers | That Judikt produced a truthful checkpoint, that the underlying audit chain is valid, or that the checkpoint was complete |
| Combined fixture | A publicly verifiable handoff statement over evidence that can also be checked natively by a secret-holder | Complete history, absence of pre-checkpoint rewriting, production key custody, adoption, or endorsement |

A valid BoundaryAttest receipt does not prove the underlying Judikt events happened, that Judikt's audit database was uncompromised before checkpointing, that no earlier events were removed, that the HMAC key was well protected, that the operator identity is correct, or that the timestamp was independently witnessed.

## Why the checkpoint, not individual events

The Judikt maintainer identified the checkpoint as the useful portable unit: one checkpoint commits to the chain head at a specific sequence number, so an outer handoff layer does not need to duplicate-sign every individual audit event.

That keeps the composition narrow:

Judikt audit semantics remain authoritative  
→ Judikt produces a checkpoint  
→ freeze the exact exported checkpoint bytes  
→ BoundaryAttest binds those bytes and selected checkpoint identifiers  
→ an external recipient verifies against an independently supplied expected public key

## Future native asymmetric signing

The Judikt maintainer said the preferred long-term direction would be for Judikt itself to sign exported checkpoints asymmetrically, likely Ed25519 with operator-controlled KMS or Vault custody, rather than depend on a BoundaryAttest-specific receipt format.

This fixture is deliberately compatible with that direction. It is not an argument that Judikt should depend on BoundaryAttest. If Judikt later emits a native independently verifiable asymmetric checkpoint signature, an extra BoundaryAttest wrapper may be redundant for simple signature portability and should only be used where it adds a separate handoff claim.

## Negative vectors

Focused tests cover a matching fixture; one-byte and trailing-newline checkpoint changes; signed `chain_id`, `seq`, and `head_hash` mismatches; BoundaryAttest claim tampering; a wrong independently supplied Ed25519 public key; native checkpoint-body tampering; exact regeneration; and confirmation that the external verifier exposes no HMAC-secret parameter.
