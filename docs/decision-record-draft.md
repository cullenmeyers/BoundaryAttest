# Decision Record Draft

**EXPERIMENTAL · NON-NORMATIVE · NOT Interop Profile v0.3**

This document is a schema-review draft and is subject to change. It tests whether a domain-specific, structured `decision_record` extension inside a signed BoundaryAttest Interop Profile v0.2 `claim` can preserve a real enforcement-plane decision. It does not change either Interop Profile, define a schema, or add required core claim fields.

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

Here, core `status` describes the event attested by this receipt: the producer exported the signed evidence projection. It is deliberately not `denied`. The governance verdict is `decision_record.resolution.verdict`, the hold outcome is `decision_record.adjudication.outcome`, and execution knowledge is `decision_record.execution_observation.state`. These fields answer different questions and must not be inferred from one another.

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
        "evidence_bundle_digest": "sha256:...",
        "source": "...",
        "selection": "deny",
        "confidence": 0.98,
        "round": 1,
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
      "scope": "exporter_observed_hold_release_only",
      "timestamp": "..."
    }
  }
}
```

The shape is a structured projection of selected source events:

- `decision_id` binds the phases to one decision.
- `subject` identifies the consequential request being decided.
- `mode` prevents a shadow verdict from being mistaken for an enforcing outcome.
- `evidence` binds the source bundle and rule version without embedding either; the receipt does not replace the underlying evidence bundle.
- `opened` preserves the closed choices, scoped question, resolution rule, and start time needed to interpret later inputs and the result.
- `inputs` is the universal concept. This fixture uses `type: "vote"`, but other producers could project human approvals, deterministic rule evaluations, capability checks, or failures. Voting is not mandatory. Each input repeats the decision and evidence binding because an input detached from either can change its meaning.
- `resolution` preserves the domain verdict, selected option, explanation, tally, dissent, and time. A verdict alone cannot explain how the result arose.
- `adjudication` separately records how the held operation was handled. A decision does not itself release or reject a hold.
- `execution_observation` states only what the exporter knows about downstream effect. A released hold is not proof of execution.

No `required_capabilities` field is proposed. The fixture does not need it, and adding it would begin to turn this evidence projection into a policy language. Narrowed permissions can be represented in the bounded `opened.scope` for review without defining general capability semantics.

## Projection rather than event sequence

An ordered event array would preserve source ordering more literally and accommodate repeated rounds naturally, but it would also import event-log concerns such as event vocabularies, replay semantics, and lifecycle completeness. The compact projection above retains only the relevant phases: opening context, timestamped ordered inputs, resolution, adjudication, and scoped execution observation. It preserves input → resolution → adjudication while avoiding a universal event-sourcing protocol.

This is a lossy portable projection, not the authoritative event stream. If review finds that omitted event identity or inter-round ordering changes interpretation, an ordered event sequence may be necessary instead.

## Synthetic scenario

A consequential `payments.transfer` call is held. A decision is opened in `shadow` mode with closed options `allow` and `deny`. Three round-one votes are recorded against the same decision and evidence bundle. Two select `deny`; one selects `allow` and remains visible as dissent. Simple majority resolves the governance decision to `deny`.

The hold is nevertheless `released` through the `shadow_observation` adjudication path because the verdict is observational. The exporter observes the hold release but does not observe the payment executor, so execution is explicitly `not_observed`. The later evidence-export event has core `status: "exported"`.

This makes a flat `status: "denied"` materially misleading: it would blur a successful export, a DENY policy result, a released hold, and unknown execution into one word.

The fixture omits input failures because none occurred in this scenario. A producer should include materially relevant failures as decision inputs with an appropriate `type`; absence here must not be generalized into proof that no omitted or failed input existed.

## Semantic validation boundary

The core v0.2 verifier checks the strict envelope, required claim fields, expected-key fingerprint, JCS canonicalization, and Ed25519 signature. The fixture verifier separately checks this example's domain meaning: identities and evidence bindings, shadow mode, closed-option selections, chronology, verdict, reason, tally, dissent, separate adjudication, and explicitly scoped execution knowledge.

It also confirms that changing an input, resolution, adjudication, or execution observation invalidates the signature. Cryptographic verification binds those fields; it does not establish their truth, completeness, authorization, or correctness.

## Historical immutability

The fixture is an immutable historical export. A later vote revision, round, adjudication, invalidation, rule establishment, or transformed export should produce new source evidence and, where exported, a new signed receipt linked by domain references. It must not silently rewrite this receipt. This draft does not define that lifecycle protocol.

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

