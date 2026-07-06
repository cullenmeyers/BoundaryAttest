# Decision/Action Profile v0.1 Draft

Status: experimental design draft. This document is not a standard, does not define a schema, and is not part of the stable BoundaryAttest Interop Profile v0.1.

## Purpose

A decision/action profile binds a policy, ruleset, or approval decision to the action, block, escalation, handoff, or other effect that followed. Its purpose is to make the relationship between a decision and its subsequent handling portable as a signed claim.

## Non-goals

A decision/action receipt does not prove that:

- the policy was correct
- the policy was wise
- the evaluation engine behaved correctly
- the authorization was legally valid
- the action was correct
- the action succeeded
- the raw evidence is complete
- the runtime was uncompromised

These remain trust, governance, implementation, evidence, and outcome questions outside signature verification.

## Relationship to the base receipt

This draft describes a profile carried inside the existing BoundaryAttest receipt envelope. It is not a new core envelope. Profile content would live in the signed claim so that the existing envelope can protect its integrity.

This draft does not change the base receipt, Interop Profile v0.1 semantics, canonicalization, signing, key handling, or verifier behavior. A future profile specification would need to define how its fields fit into the signed claim without changing what a base receipt verification result means.

## Minimal candidate sections

The following are draft profile sections, not finalized required fields:

- `subject`: the actor, request, resource, operation, or other thing evaluated
- `decision`: the normalized verdict, domain-specific reason codes, evaluation time, and decision identifier
- `policy`: the policy or ruleset identity, version, digest, engine, and digest semantics
- `authority`: the asserted approver, grant, mandate, or authority context under which the decision was made
- `action_binding`: the action, block, escalation, handoff, or effect associated with the decision, including its status after the decision
- `evidence`: hash pointers and lifecycle metadata for evidence considered or produced
- `correlation`: identifiers that connect the decision, action, workflow, approval, trace, and related receipts

The exact shape, nesting, vocabulary, and required-versus-optional status of these sections remain open.

## Candidate normalized verdicts

A small draft verdict set is:

- `allow`
- `deny`
- `escalate`
- `defer`
- `error`

The normalized verdict supports cross-domain comparison. Domain-specific reason codes can live beside it to preserve the detail needed by the originating policy system. A normalized verdict must not be interpreted as proof that the underlying decision was correct or authoritative.

## Status after decision

Candidate status values describing what followed include:

- `action_followed`
- `blocked`
- `handed_off`
- `expired`
- `failed`
- `no_action`

This status describes the claimed handling after the decision. In particular, `action_followed` records a claimed relationship, while `failed` and `no_action` distinguish an attempted-but-failed effect from no effect being attempted. None of these values independently proves the real-world outcome.

## Policy and ruleset digest guidance

Raw policy files should not be treated as semantic ruleset hashes unless the policy engine defines how those files are canonicalized and what the digest represents. Textually different policy inputs may have the same meaning, while includes, defaults, external data, compilation, ordering, or engine behavior may make textually identical inputs evaluate differently.

Candidate policy metadata includes:

- `policy_engine`
- `policy_engine_version`
- `ruleset_ref`
- `ruleset_version`
- `ruleset_hash_alg`
- `ruleset_hash`
- `ruleset_canonicalization`
- `digest_semantics`

`ruleset_canonicalization` should identify the engine-defined transformation, format, or version used before hashing. `digest_semantics` should state what is covered, such as a source bundle, resolved dependency set, compiled policy, or engine-specific semantic representation. If no canonical semantic representation exists, the receipt should say so and characterize the hash narrowly rather than imply semantic equivalence.

## Evidence retention guidance

Receipts should carry hash pointers and retention or redaction metadata, not raw evidence. Keeping raw inputs, personal data, secrets, or large artifacts inside a portable signed receipt can create unnecessary disclosure and retention risks.

Candidate evidence metadata includes:

- `evidence_hash`: a digest used to compare later-provided evidence
- `evidence_ref`: a reference for authorized retrieval, not an assurance of availability
- `retention_class`: the applicable retention category or schedule
- `evidence_owner`: the party responsible for custody and access decisions
- `redaction_status`: whether evidence is unredacted, partially redacted, fully redacted, or otherwise unavailable

A hash does not recover the evidence or prove that the evidence set was complete. A reference can expire, become inaccessible, or resolve only for authorized parties. The receipt should preserve enough metadata to distinguish those conditions without embedding the evidence itself.

## Example fixture scenarios

Future fixtures could illustrate the intended semantics without expanding the current Interop Profile v0.1 test vectors:

- an `allow` decision followed by the bound action
- a `deny` decision with `no_action`
- an `escalate` decision followed by a handoff
- an approval that expired before action
- a claimed ruleset hash that does not match the expected ruleset representation
- an evidence pointer whose target is unavailable or redacted

These are candidate future fixtures only. This draft does not implement fixtures, validation logic, or reason codes.

## Verification expectations

Once a formal profile defines required fields, a verifier can check the integrity of the signed claim and the presence and basic validity of those fields. It can also compare recorded digests or identifiers with independently supplied expected values when their algorithms and semantics are defined.

A verifier cannot prove policy correctness, evidence completeness, or action success. It also cannot infer that an authority was legally valid, that an evaluation engine executed faithfully, or that the signing runtime was uncompromised. Passing verification would establish only the defined structural and cryptographic claims, under the verifier's trust assumptions.

## Open questions

- Which fields and sections should be required, and which should remain optional?
- How should the profile map to DSSE, in-toto, and Sigstore conventions?
- Which producer, engine, adapter, or profile layer owns canonicalization responsibilities?
- Who owns evidence retention, access, redaction, and deletion responsibilities?
- Should this draft become a formal BoundaryAttest profile after external implementation and governance feedback?
