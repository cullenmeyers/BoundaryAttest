# Decision Record Draft

**EXPERIMENTAL · NON-NORMATIVE · NOT Interop Profile v0.3**

This decision-record draft revision 2 is a schema-review draft and is subject to change. It tests whether a domain-specific, structured `decision_record` extension inside a signed BoundaryAttest Interop Profile v0.2 `claim` can preserve a real enforcement-plane decision. It does not change either Interop Profile, define a schema, or add required core claim fields.

## Question under test

Can a v0.2 receipt carry enough signed evidence to explain a governance decision without reducing the decision, adjudication, and observed effect to one status?

The accompanying synthetic fixture answers provisionally: yes. Its strict receipt envelope remains `claim`, `signature`, and `public_key_id`; all experimental content is inside `claim.decision_record`.

## Receipt event and status

The receipt represents an evidence export, not the original decision or execution:

```json
{
  "action_type": "governance.decision_evidence_exported",
  "status": "exported"
}
```

Here, core `status` describes the event attested by this receipt: the producer exported the signed evidence projection. It is deliberately not `denied`. The governance verdict is `decision_record.resolution.verdict`, the hold outcome is `decision_record.adjudication.outcome`, the observed enforcement-boundary effect is `decision_record.control_effect`, and downstream knowledge is `decision_record.execution_observation.state`. These fields answer different questions and must not be inferred from one another.

`receipt_role: "server_attested"` means only that the evidence-export service, under the independently expected key, signed this claim. It does not prove that the source decision events were complete or true, or that the exporter was the enforcement runtime.

## Smallest useful proposed shape

```json
{
  "decision_record": {
    "decision_id": "...",
    "subject": {
      "action_ref": "...",
      "action_type": "..."
    },
    "mode": "shadow",
    "control_effect": "not_blocked",
    "evidence": {
      "bundle_digest": "sha256:...",
      "source_ref": "...",
      "rule_ref": "..."
    },
    "opened": {
      "timestamp": "...",
      "options": ["allow", "deny"],
      "scope": { "...": "..." },
      "resolution_rule": "simple_majority"
    },
    "inputs": [
      {
        "type": "vote",
        "decision_id": "...",
        "source": "...",
        "selection": "deny",
        "timestamp": "..."
      }
    ],
    "resolution": {
      "verdict": "deny",
      "chosen_option": "deny",
      "reason": "...",
      "tally": { "allow": 1, "deny": 2 },
      "dissent": [{ "source": "...", "selection": "allow", "reason": "..." }],
      "timestamp": "..."
    },
    "adjudication": {
      "decision_id": "...",
      "outcome": "released",
      "path": "shadow_observation",
      "reason": "...",
      "timestamp": "..."
    },
    "execution_observation": {
      "state": "not_observed",
      "scope": "hold_released_downstream_unobserved",
      "timestamp": "..."
    }
  }
}
```

The shape is a structured projection of selected source events:

- `decision_id` binds the phases to one decision.
- `subject` identifies the consequential request being decided. The fixture requires the exact subject to also appear in the evidence bundle committed to by `evidence.bundle_digest`.
- `mode` prevents a shadow verdict from being mistaken for an enforcing outcome.
- `control_effect` conservatively states whether this control prevented continuation at the observed enforcement boundary. Its closed vocabulary is `blocked`, `not_blocked`, and `unknown`, and a domain verifier recomputes it from adjudication semantics. `not_blocked` does not mean the action executed.
- `evidence` binds one source bundle and a rule reference without embedding either; the receipt does not replace the underlying evidence bundle.
- `opened` preserves the closed choices, scoped question, resolution rule, and start time needed to interpret later inputs and the result.
- `inputs` is the universal concept. This fixture uses `type: "vote"`, but other producers could project human approvals, deterministic rule evaluations, capability checks, or failures. Voting is not mandatory. Every input in this draft is interpreted against the single `decision_record.evidence.bundle_digest`; per-input evidence snapshots are not defined.
- `resolution` preserves the domain verdict, selected option, explanation, tally, dissent, and time. A verdict alone cannot explain how the result arose.
- `adjudication` separately records how the held operation was handled. A decision does not itself release or reject a hold.
- `execution_observation` states only what the exporter knows about later downstream execution or effect. A released hold is not proof of execution.

## Closed execution-observation vantage points

`execution_observation.scope` is a closed vocabulary in this draft:

- `shadow_no_hold`: shadow evaluation did not place a hold, so no hold-release observation exists.
- `hold_released_downstream_unobserved`: the exporter observed release at the hold boundary but did not observe later downstream execution.
- `exporter_terminated_before_downstream_observation`: the exporter stopped before it could make the downstream observation.

Unknown values fail domain validation. The fixture uses `hold_released_downstream_unobserved`. This vocabulary belongs only to this experimental projection; it is not a new BoundaryAttest core field.

## Control effect is not execution

`control_effect` answers whether this control prevented continuation at the observed enforcement boundary. `execution_observation` answers what the exporter knows about later downstream execution or effect. For the fixture, `adjudication.outcome: "released"` derives `control_effect: "not_blocked"`, while downstream execution remains `state: "not_observed"`. A consumer therefore cannot legitimately translate the shadow `deny` verdict into a prevented transfer, nor translate `not_blocked` into an executed transfer.

The draft derivation is conservative: a rejected hold is `blocked`, a released hold is `not_blocked`, and an adjudication that establishes neither is `unknown`. A valid signature with a mismatched derived value fails domain validation.

## References do not establish authority

`evidence.source_ref` and `evidence.rule_ref` are signed references asserted by the exporter. Likewise, `inputs[].source` is an opaque source identifier asserted by the exporter, not a credential or a globally meaningful display identity. The BoundaryAttest signature does not establish that its key was authorized to govern `payments.transfer`, that `rule_ref` was legitimately applicable at that time, that an input source had authority to vote or review, or that any source identifier maps to a credential or real-world principal. A consuming domain must establish those authority bindings independently. This draft adds no PKI, trust registry, or authority protocol.

## One evidence bundle and subject correlation

All inputs in this draft are interpreted against the single `decision_record.evidence.bundle_digest`. The fixture hashes the RFC 8785/JCS canonical bytes of `evidence-bundle.json`, and domain validation both recomputes that digest and requires its `subject` to equal the signed `decision_record.subject`. Digest and subject equality establish correlation and integrity only; they do not establish truth, completeness, or authority. If a future source system permits inputs against different evidence snapshots, it needs an explicit versioned/reference model not defined here.

Bare `confidence` values are omitted because `simple_majority` does not consume them and this draft defines no portable confidence scale. Source systems may retain confidence, but values that do not materially participate in portable decision semantics should not be included merely because they exist.

No `required_capabilities` field is proposed. The fixture does not need it, and adding it would begin to turn this evidence projection into a policy language. Narrowed permissions can be represented in the bounded `opened.scope` for review without defining general capability semantics.

## Projection rather than event sequence

An ordered event array would preserve source ordering more literally and accommodate repeated rounds naturally, but it would also import event-log concerns such as event vocabularies, replay semantics, and lifecycle completeness. The compact projection above retains only the relevant phases: opening context, timestamped ordered inputs, resolution, adjudication, and scoped execution observation. It preserves input → resolution → adjudication while avoiding a universal event-sourcing protocol.

This is a lossy portable projection, not the authoritative event stream. If review finds that omitted event identity or inter-round ordering changes interpretation, an ordered event sequence may be necessary instead.

## Synthetic scenario

A consequential `payments.transfer` call is held. A decision is opened in `shadow` mode with closed options `allow` and `deny`. Three votes are recorded against the same decision and evidence bundle. Two select `deny`; one selects `allow` and remains visible as dissent. Simple majority resolves the governance decision to `deny`.

The hold is nevertheless `released` through the `shadow_observation` adjudication path because the verdict is observational. Therefore the control is `not_blocked`. The exporter observes the hold release but does not observe the payment executor, so execution is independently `not_observed` with scope `hold_released_downstream_unobserved`. The later evidence-export event has core `status: "exported"`.

This makes a flat `status: "denied"` materially misleading: it would blur a successful export, a DENY policy result, a released hold, and unknown execution into one word.

The fixture omits input failures because none occurred in this scenario. A producer should include materially relevant failures as decision inputs with an appropriate `type`; absence here must not be generalized into proof that no omitted or failed input existed.

## Semantic validation boundary

The core v0.2 verifier checks the strict envelope, required claim fields, expected-key fingerprint, JCS canonicalization, and Ed25519 signature. The fixture verifier separately checks this example's domain meaning: identities, subject/bundle correlation, the one-bundle input rule, shadow mode, closed-option selections, chronology, verdict, reason, tally, dissent, separate adjudication, derived control effect, and the closed execution-observation scope.

It also confirms that changing an input, resolution, adjudication, or execution observation invalidates the signature. Separate negative cases re-sign inconsistent claims to demonstrate that a cryptographically valid record can still fail semantic validation. Cryptographic verification binds fields; it does not establish their truth, completeness, authorization, or correctness.

All decision-record timestamps are exporter/source supplied. Chronology checks establish only internal relationships such as opening ≤ inputs ≤ resolution ≤ adjudication ≤ observation ≤ export; they cannot independently prove when any event occurred in real time.

## Historical immutability

The fixture is one immutable, resolved decision snapshot. It has no `round` field and defines no multi-round, reopening, supersession, or authority semantics. A later reconsideration, revised input, adjudication, invalidation, rule establishment, or transformed export should produce new source evidence and, where exported, a new signed historical record linked through domain references. It must not silently rewrite this receipt. This draft does not define that lifecycle protocol.

Multi-writer audit-log completeness and signed checkpoints are a separate higher-level problem and are intentionally out of scope.

## Questions for enforcement-plane review

1. Does this preserve enough information to understand why the final verdict occurred?
2. Is the projection of decision events faithful enough, or should portable evidence preserve the ordered event sequence directly?
3. Are tally, dissent, and reason sufficient resolution evidence?
4. What important enforcement-plane fact has been lost?
5. Is adjudication modeled separately enough from resolution?
6. Is the distinction between shadow DENY and actual execution/effect clear?
7. Should execution observation live inside this decision record or as separately linked evidence?
8. Are decision inputs too vote-specific?
9. Does the structure handle narrowed permissions/scopes without becoming a policy language?
10. Does this stretch BoundaryAttest's claim-extension mechanism too far?
