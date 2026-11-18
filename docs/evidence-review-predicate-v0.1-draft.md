# Evidence Review Predicate v0.1 (draft)

Status: experimental, envelope-independent semantic profile.

This draft defines a narrow downstream claim:

> an independently expected reviewer committed to a decision about an exact evidence artifact after running a named native verifier under a recorded verification context.

It does **not** define a new signature envelope. The same predicate semantics may be carried by BoundaryAttest Interop Profile v0.2, an in-toto Statement in DSSE, a Sigstore bundle, or another signed container that preserves the predicate bytes and expected-signer trust model.

The draft was motivated by interoperability discussion with Obsign. It intentionally keeps the source system authoritative for its own evidence and verifier semantics.

## Why this exists

A statement such as:

> “organisation B reviewed this evidence pack and accepted it for case X”

is ambiguous unless it also records what exact artifact B reviewed and how B verified it.

A useful downstream review claim therefore needs to bind:

- the exact received artifact bytes;
- the native verifier implementation actually run;
- the trust anchors supplied to that verifier;
- effective verification options;
- the native verifier outcome and stable findings;
- any material out-of-band checks the verifier cannot perform itself;
- the downstream review purpose and decision; and
- the independently expected downstream signer.

The predicate must not upgrade native evidence into a stronger claim than the native verifier made.

## Core model

```text
source system
  -> produces native evidence artifact

reviewer
  -> receives exact artifact bytes
  -> runs the native verifier
  -> records verification context and outcome
  -> performs any required out-of-band checks
  -> makes a downstream review / reliance decision

signed envelope
  -> carries this predicate
  -> proves only that the expected downstream signer committed to it
```

Native verification remains authoritative for the source evidence.

## Predicate shape

The following JSON shape is illustrative. Field names are draft and may change.

```json
{
  "predicate_type": "evidence_review/v0.1-draft",

  "subject": {
    "artifact_type": "obsign-evidence/1",
    "sha256": "sha256:<hex>",
    "byte_length": 12345
  },

  "native_verification": {
    "verifier": "obsign",

    "implementation": {
      "source_revision": "<git commit or equivalent immutable revision>",
      "binary_sha256": "sha256:<hex>"
    },

    "effective_options": {
      "strict": true,
      "require_origin": true,
      "require_attestation": false
    },

    "trusted_keys": {
      "input_sha256": "sha256:<hex>",
      "self_referential": false,
      "keys": [
        {
          "key_id": "seal-2026-01",
          "algo": "ed25519",
          "public_key": "<32-byte-ed25519-public-key-hex>",
          "role": "seal"
        }
      ]
    },

    "deployment_bundle": {
      "source": "embedded",
      "sha256": "sha256:<hex>"
    },

    "exit_code": 0,
    "outcome": "proven",

    "findings": [
      {
        "severity": "caveat",
        "code": "anchor_not_validated",
        "count": 1
      }
    ],

    "out_of_band_checks": [
      {
        "code": "anchor_not_validated",
        "performed": true,
        "evidence_ref": "sha256:<digest-of-retained-check-evidence>"
      }
    ],

    "verification_report": {
      "sha256": "sha256:<exact-stdout-bytes>",
      "archived": true
    }
  },

  "review": {
    "case_ref": "case-X",
    "purpose": "release-review",
    "decision": "accepted"
  },

  "not_proven": [
    "the underlying source records are objectively true",
    "the reviewer was authorized by organizational policy",
    "the evidence is complete beyond the native verifier's guarantees",
    "the downstream decision was correct"
  ]
}
```

## Subject binding

`subject.sha256` is over the exact bytes received by the reviewer.

For JSON artifacts, do not parse and re-serialize before hashing unless the source system explicitly defines that canonical representation. Semantically equivalent JSON can have different bytes.

`byte_length` is included to make accidental representation changes easier to detect and diagnose.

A downstream review predicate should remain detached from the native artifact unless the source format explicitly supports that extension. Injecting fields into a strict native format can invalidate native verification.

## Native verifier identity

A downstream claim should identify the verifier actually run, not merely the product name.

Where the verifier emits a stable self-identifying version, record that version. Where it does not, bind an immutable source revision plus the digest of the exact binary that executed.

For the current Obsign verifier, the honest binding is:

- the source revision the reviewer built from; and
- SHA-256 of the exact `obsign` binary used.

This matters because verifier behavior can legitimately change across revisions. Obsign currently has at least two concrete examples: PR #10 changed how strict mode treats verifier caveats, and a verifier built before a payload type existed can raise `unknown_payload_type` for a pack that a newer verifier accepts. For Obsign today, source revision plus exact binary digest is therefore the strongest available verifier identity binding.

## Effective options, not command spelling

Record the effective semantic options rather than every command-line flag as typed.

For current Obsign behavior:

- `strict`
- `require_origin`
- `require_attestation`

are meaningful effective options.

`--allow-unsigned-legacy-chains` changes `require_origin`; `--require-origin` is compatibility spelling for the default. Recording both would duplicate one semantic choice.

## Trust-anchor binding

If native verification depends on an out-of-band trusted-key file, bind all of:

1. SHA-256 of the exact trusted-key input bytes;
2. whether the verifier treated the run as `self_referential`; and
3. a semantic list of the effective trusted keys, including `key_id`, algorithm, public-key material, and effective role.

For current Obsign Ed25519 entries, `public_key` is the 32-byte public key encoded as hex. A `key_id` alone is not an identity: two different key files can reuse the same label while carrying different key material.

For Obsign, an omitted role in the trusted-key input means the effective role is `seal`; the predicate should record that effective role explicitly.

The raw-byte digest preserves the exact verifier input. The inline key material lets another relying party compare the actual anchors semantically even if its equivalent key file uses different whitespace or formatting.

`self_referential` must be recorded explicitly. Obsign derives it from whether the parsed trusted-key list is empty, not merely from whether `--trusted-keys` was present. A supplied file containing `[]` therefore remains self-referential.

The predicate does not assert that those keys were authorized by organizational policy. That remains an external trust decision.

## Deployment/configuration inputs

When a verifier can obtain configuration from either the artifact itself or an externally supplied file, the predicate must record which source actually governed verification.

For the current Obsign verifier:

```json
{
  "deployment_bundle": {
    "source": "embedded | supplied | none",
    "sha256": "sha256:<hex-or-null>"
  }
}
```

If the pack embeds its own deployment bundle, an additionally supplied `--deployment-bundle` is ignored. The predicate must not imply that an ignored input affected the verdict.

## Native outcome

For the current Obsign CLI, exit codes mean:

| Exit code | Meaning |
| --- | --- |
| 0 | proven |
| 1 | invalid |
| 2 | execution error; verification did not produce a verdict |
| 3 | consistent but unproven |

The predicate should record both the numeric exit code and a stable semantic outcome.

There are important interactions:

- A self-referential run raises `keys_not_anchored` as a warning. With `strict: true`, that warning is promoted to failure, so the run exits 1 rather than 3. Exit 3 is reachable for a self-referential run only when strict mode is off.
- Exit 1 can mean tampering, a warning promoted under strict mode, or an unmet verification requirement promoted to an error. Current examples include `origin_unverified` when origin is required, `identity_not_attested` when attestation is required, and `session_cert_unverified`. The same finding code can have different severity depending on effective options, which is why the predicate records both severity and code.
- Exit 2 means the pack, trusted-key file, or deployment bundle could not be read or parsed. No verification report/findings verdict is produced. A downstream review predicate must not pair exit 2 with a decision such as `accepted`, because native verification did not complete.

Exit code alone is therefore not enough. Stable finding severity/code pairs distinguish materially different outcomes.

## Findings

Record stable native finding identifiers as a deterministic, deduplicated set of severity/code pairs, optionally carrying a count:

```json
{ "severity": "error | warning | caveat", "code": "<stable-code>", "count": 1 }
```

The same code may be raised multiple times in one run. For example, `unknown_payload_type` may be raised once per affected record. To keep equivalent verifier runs comparable, the predicate should collapse repeated identical `(severity, code)` pairs into one entry and record the multiplicity in `count`.

Do not treat human-readable finding messages as stable protocol fields unless the native verifier explicitly guarantees them.

For current Obsign behavior, finding codes are intended for scripts/CI and are the appropriate semantic identifiers. Severity is also material: some codes can be warnings or errors depending on the effective verification options.

A digest of the full JSON verification report may be included as an optional archival reference, but it is not sufficient on its own if that report format is not versioned and self-describing.

If `verification_report.sha256` is present, it should cover the exact retained report bytes and the report should actually be archived.

## Caveats and out-of-band checks

A native verifier may deliberately surface checks it cannot perform itself.

For example, current Obsign can report caveats such as:

- `anchor_not_validated`: the RFC 3161 token is structurally bound to the checkpoint, but TSA CMS signature validation remains out of band;
- `attestation_not_rooted`: the attestation is structurally consistent, but the TPM EK vendor-root chain remains out of band.

A native exit code of 0 does not silently upgrade those caveats into completed checks.

For each material caveat, the predicate should state whether the reviewer actually performed the required out-of-band check. If not performed, the limitation should remain visible in `not_proven`.

`evidence_ref` is required whenever `performed: true`. Otherwise `performed` would be an unbound assertion inside a predicate whose other material verification inputs are bound. The reference may identify retained evidence without prescribing its format.

## Review semantics

The review object describes the new downstream claim, not the source system's original evidence.

Typical fields:

- `case_ref`: downstream case, assessment, release, or incident identifier;
- `purpose`: why the reviewer evaluated the evidence;
- `decision`: the downstream result, such as `accepted`, `rejected`, `needs_changes`, or an application-defined value.

These values require an application/profile contract. A generic verifier cannot infer their organizational meaning.

## Signer trust

The signed envelope must be verified against a downstream signer key obtained independently from the predicate and subject artifact.

A valid signature establishes only that the expected key committed to the predicate.

It does not prove:

- human or organizational identity by itself;
- authorization to make the review decision;
- secure private-key custody;
- current trust or non-revocation; or
- correctness of the review.

Those remain relying-party governance decisions.

## Required non-claims

A review predicate should make its limits visible in the signed semantics rather than relying only on external documentation.

At minimum, an Obsign-oriented profile should not claim that the downstream signature independently proves:

- the truth of the underlying Obsign records;
- Obsign policy correctness;
- identity correctness beyond Obsign's native verifier result;
- timestamp validity beyond checks actually performed;
- chain completeness beyond Obsign's native guarantees;
- successful real-world effects;
- reviewer organizational authorization; or
- correctness of the downstream decision.

## Envelope mappings

### BoundaryAttest v0.2

A BoundaryAttest carrier can place the predicate inside signed extension fields of a v0.2 claim while retaining the normal required fields and expected-key verification rules.

BoundaryAttest remains responsible only for its own envelope, JCS canonicalization, Ed25519 signature, expected-key fingerprint check, and claim integrity.

The native evidence-review semantics remain profile-owned.

### in-toto Statement + DSSE

The same semantics can be represented as an in-toto-style predicate whose subject identifies the exact evidence artifact digest, with DSSE providing the signed envelope.

The value of this draft is therefore not dependent on requiring BoundaryAttest as the outer wrapper.

A future interoperability test should compare both carriers rather than assume one is inherently superior.

## Selection rule

Use this predicate only when a **new downstream party is making a genuinely new review/reliance claim** about already-existing evidence.

Do not use it merely to re-sign evidence that already has adequate native provenance.

```text
native evidence
  -> native verification
  -> no new downstream claim
     => stop; do not add a receipt

native evidence
  -> native verification
  -> new relying party makes a distinct review/acceptance/release claim
     => evidence-review predicate may fit
```

## Open questions

This draft intentionally leaves several questions open for external review:

1. Which fields belong in a reusable cross-system predicate versus a source-specific profile?
2. Which evidence-reference formats should be accepted for performed out-of-band checks? This draft now requires an `evidence_ref` whenever `performed: true`.
3. How should application profiles define their own review-decision vocabulary? This draft keeps `decision` application-defined.
4. Beyond source revision + binary digest, is any additional verifier identity needed when no stable version is emitted?
5. Does an existing envelope such as DSSE/in-toto make BoundaryAttest's own envelope unnecessary for this use case?
6. Which fields must be mandatory before a downstream claim is safe to automate against?

No answer to these questions changes BoundaryAttest Interop Profile v0.2. This document is a design experiment, not a protocol revision or release commitment.
