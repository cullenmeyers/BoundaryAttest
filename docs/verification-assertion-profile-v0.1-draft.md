# Verification assertion profile v0.1 (draft)

Status: experimental, documentation-only profile. This does not change the BoundaryAttest Interop v0.2 envelope or verifier.

## Purpose

This profile describes the semantics a portable verification or review assertion should carry when one actor evaluates immutable evidence produced by another actor.

The profile exists because three questions are different:

1. **Document authenticity:** who signed this document, and has it changed?
2. **Determination semantics:** what exactly did the evaluator check and conclude?
3. **Claim applicability:** under what evidence state and conditions may a later relying party still use that conclusion?

A signed document can remain authentic forever while the determination it contains becomes stale or inapplicable.

## Selection rule

Do not create a BoundaryAttest object merely because evidence crosses a trust boundary.

Use native signed evidence directly when it already expresses the relevant actor's claim. If an ecosystem already has a suitable signed response envelope, map this profile into that envelope instead of wrapping it.

BoundaryAttest's Interop v0.2 envelope is a fallback container for systems that do not already provide an appropriate signed object.

## Conceptual flow

```text
A produces immutable evidence R
          |
          v
B evaluates R
  + B's verification profile
  + B's trust inputs / authority sources
          |
          v
B produces determination V
          |
          v
C later evaluates whether V is still applicable
```

B's assertion is distinct from A's evidence. B MUST NOT rewrite A's signed object to add the evaluation.

Multiple evaluators may independently assess the same R. Their assertions are plural and append-only.

## Suggested signed semantics

The following shape is illustrative. Adapter profiles MAY rename fields, but should preserve the distinctions.

```yaml
assertion_profile: boundaryattest.verification-assertion.v0.1
subject:
  digest: sha256:...
  representation: raw_bytes | rfc8785_jcs | profile_defined

evaluated_at: 2026-11-28T00:00:00Z

verification_profile:
  id: ...
  version: ...
  digest: sha256:...   # where a stable profile artifact exists

evidence:
  - id: revocation_state
    digest: sha256:...
    as_of: 2026-11-28T00:00:00Z
  - id: authority_record
    digest: sha256:...
    as_of: 2026-11-28T00:00:00Z

checks:
  - id: signature
    result: pass
  - id: authority
    result: pass
  - id: revocation
    result: unknown

determination: inconclusive

unresolved_checks:
  - revocation

applicability:
  valid_until: 2026-11-28T00:05:00Z
  revalidate_on:
    - authority_change
    - revocation_change
    - verification_profile_superseded
```

## Determination semantics

A profile should avoid a positive-sounding determination with unresolved required checks.

Recommended base semantics:

- **supported** — every check REQUIRED by the declared verification profile passed, and no required check remains unresolved.
- **not_supported** — at least one REQUIRED check definitively failed.
- **inconclusive** — missing, unavailable, unknown, conflicting, or stale evidence prevents either of the above determinations.

Domain profiles MAY use a different verdict vocabulary, but MUST define the meaning of each value and how unresolved checks affect it.

## Evidence commitments are not evidence authority

A digest such as `trust_inputs_digest` or an entry in `evidence[]` commits the evaluator to the bytes or representation it used. It does not establish that those inputs were authoritative, complete, current, truthful, or available to a later relying party.

Profiles should therefore identify, where applicable:

- what source or authority each evidence item represents;
- the exact representation or canonicalization used for its digest;
- the time or state the evidence describes;
- whether the relying party can retrieve and independently verify it; and
- what trust decision remains outside BoundaryAttest.

## Applicability is not document expiry

Do not overload document retention or envelope expiry to mean that the determination remains valid.

Useful applicability semantics may include:

- **evaluated_at** — when the evaluator made the determination;
- **evidence as-of times** — the state actually examined;
- **valid_until** — an optional profile-defined upper bound on reliance without re-evaluation;
- **revalidate_on** — named events or state changes that invalidate continued reliance;
- **assumptions** — explicit conditions the determination depends on;
- **supersedes / superseded_by** — where a profile defines replacement semantics.

A later relying party still owns the policy decision about whether an authentic historical determination is acceptable for its current use.

## Native-envelope rule

This profile is about semantics, not ownership of a universal container.

Examples:

- In a Trust Tasks-style ecosystem, these fields may belong inside a task-specific signed `#response`.
- In a system such as an external Grantex executor that can verify authority but has no native executor-signed evidence object, the BoundaryAttest Interop v0.2 envelope can carry the executor's distinct claim.
- If a source system already emits suitable asymmetric evidence for the same actor and assertion, verify that native evidence directly.

## Non-proofs

A passing BoundaryAttest signature over a verification assertion does not by itself prove:

- the underlying evidence is authoritative or complete;
- the evaluator's policy is correct;
- the determination is objectively true;
- unresolved evidence did not exist;
- the determination remains applicable now;
- the signer is trustworthy or independent;
- key custody or runtime integrity.

Those properties require domain-specific verification and relying-party policy.
