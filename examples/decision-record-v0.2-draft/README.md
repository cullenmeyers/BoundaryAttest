# Experimental decision-record v0.2 fixture

This synthetic, non-normative decision-record draft revision 2 fixture accompanies [`docs/decision-record-draft.md`](../../docs/decision-record-draft.md). It is not Interop Profile v0.3 and does not define a schema or add BoundaryAttest core fields.

After building, verify the v0.2 receipt, its fixture-specific semantics, and signed-field tamper cases:

```sh
npm run example:decision-record-v0.2-draft
```

The test-only expected public key is supplied independently. `evidence-bundle.json` is hashed over its RFC 8785/JCS canonical bytes; the verifier recomputes that digest and requires its subject to equal the signed decision subject. The signing test key reused by semantic negative cases is existing public fixture material under `examples/interop-v0.2/test-vectors/`.

The verifier distinguishes signature tampering from validly signed but semantically inconsistent records. Source decision records and the synthetic evidence bundle remain hypothetical: verification does not prove their truth, completeness, authority, real-world timing, rule applicability, or downstream execution.
