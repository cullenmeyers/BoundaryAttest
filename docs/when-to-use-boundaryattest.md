# When to use BoundaryAttest

BoundaryAttest is for selected evidence crossings, not for signing every agent or tool event. Use this practical test:

> Does a portable signed evidence object materially improve trust at this boundary?

The strongest fit is usually a selected action, decision, result, artifact, or handoff that leaves its originating trust domain, cannot simply be checked against stronger authoritative evidence, cannot trivially be fetched and recomputed, and benefits from preserving an exact historical representation bound to an expected signer. These are selection factors, not an absolute rule.

## Two-minute decision flow

```text
Does the evidence leave its native trust domain?
    no  -> probably use normal logs or storage
    yes
     |
Is stronger authoritative evidence already available?
    yes -> prefer or reference that evidence
    no
     |
Can the receiver independently fetch and deterministically recompute the result?
    yes -> a receipt may add little unless exact historical freezing matters
    no
     |
Does preserving the exact signer/evidence binding matter?
    yes -> BoundaryAttest may be a good fit
    no  -> it is probably unnecessary

Separately: do you need completeness or full-history guarantees?
    yes -> an individual receipt is insufficient
```

## Good fits

BoundaryAttest is most useful when several of these are true:

- Evidence crosses an organizational, runtime, or system trust boundary.
- A receiver needs to verify later what a particular signer claimed.
- The originating mutable runtime or log should not be the receiver's only evidence source.
- No stronger authoritative system already issues equivalent durable evidence.
- An exact historical artifact, result, decision, or evidence set must remain bound to the claim.
- Recomputation is unavailable, expensive, ambiguous, non-deterministic, or no longer possible.

Examples include an exported incident report, a consequential agent action handed to another team, an artifact sent to a customer or reviewer, a governance decision exported from its enforcement system, or a multi-system handoff whose evidence references need to remain bound together.

## Weak fits and non-fits

Do not add BoundaryAttest merely because an event can be signed.

- **Authoritative source:** If an external authoritative system already provides durable, independently retrievable evidence for the exact action, its evidence may be stronger than a local runtime's signed copy.
- **Recomputable result:** If another party can fetch the authoritative input and deterministically recompute the result, a signed derived summary may add little. Exact historical freezing can still make a receipt useful.
- **Same trust domain:** If the result remains inside one accepted local or user trust boundary, normal logs and storage are usually enough.
- **Redundant re-signing:** Do not re-sign a stronger source-of-truth record unless the new receipt adds a meaningful evidence-composition, representation-binding, or handoff property.

## What the signer establishes

`server_attested` means: **this runtime or operator, under this expected signing key, signed this claim.** It does not mean the signer is independent, the claim is objectively true, the runtime was uncompromised, the operator could not fabricate the event, or the key was securely held.

Server signing can add integrity after signing, portability, stable evidence binding, and attributable signer identity under the relying party's trust model. It does not automatically add independent truth. Expected-key distribution, key custody, signer trust, runtime integrity, and relying-party policy remain external assumptions.

`client_observed` proves only what a cooperating participating client signs that it observed. It does not discover unwrapped activity, automatically detect shadow MCP traffic, prove that all tool calls passed through that client, or solve non-cooperating client behavior. Client-side attestation and client-side enforcement both depend on client participation.

## Evidence scope and history

One receipt proves only its own signed claim. It does not prove that no other events existed, no event was omitted, no receipt was deleted, a session or history is complete, or ordering across unrelated receipts is authoritative. Do not describe an individual receipt as a tamper-proof history.

The assurance levels are distinct:

1. **Individual receipt:** integrity of one signed claim.
2. **Local chained receipts:** stronger detection of accidental or naive deletion, replacement, or reordering under the local producer trust model.
3. **Externally anchored checkpoint or root:** potentially stronger evidence that the producer did not silently rewrite the entire history after publishing the anchor.

Even an externally anchored construction does not prove that the underlying events were truthful when recorded.

The current `previous_receipt_hash` linear chain works best with a real, coordinated sequential order for writers and events. It is not a general solution for active/active systems, concurrent writers, independent replicas, or systems where sequence allocation and durable commit order can differ.

Higher-level future constructions might use authoritative ordered event views, canonical event digests, Merkle or root commitments, periodic signed checkpoints, external anchoring, or a real sequencer. BoundaryAttest does not currently specify or implement those constructions.

## Keep decisions and execution distinct

A governance or policy decision is not always faithfully represented by only `status: "denied"`. Domain evidence may need a verdict, reason code, policy reference and version, required capabilities, relevant inputs, participant votes, narrowed versus broad permission semantics, dissent, overridden alternatives, timestamps or sequence, later adjudication, and execution state.

These are not core v0.2 fields. Put validated domain semantics in adapter-specific signed claim fields or separately versioned domain evidence. A future profile should add them only after real schema validation.

Keep the lifecycle states separate:

```text
requested
  -> authorization decision
  -> execution started or did not start
  -> terminal execution outcome
  -> artifact or result exported
```

`DENIED + NOT EXECUTED` differs from `DENIED + EXECUTED`. `AUTHORIZED` does not prove successful execution. `EXECUTED` does not prove a correct result. Receipt verification also does not prove policy or authorization correctness.

## Bind the declared representation

A receipt binds only the representation it explicitly declares: for example, raw artifact bytes, canonical structured JSON, redacted data, or another documented representation. A digest of redacted or canonical data must not be called a raw-input hash.

Later edits, migrations, sanitization, projections, and transformations should normally create new evidence references rather than rewrite historical evidence. Keep the original signed claim immutable.

## Decision table

| Situation | Fit | Reason |
|---|---|---|
| Incident report or artifact exported to another organization | Strong | Preserves an exact cross-boundary handoff claim |
| Consequential cross-system action result with no authoritative external record | Strong | Gives the receiver portable, attributable evidence |
| Local analysis only | Weak | Normal logs or storage usually suffice |
| Authoritative system already exposes durable evidence for the action | Weak | Prefer or reference the stronger source |
| Deterministic analysis whose source can be fetched again | Usually weak | Independent recomputation is often better evidence |
| Historical benchmark input that must be frozen exactly | Potentially strong | Exact historical representation binding may matter |
| Multi-writer audit log needing full-history integrity | Individual receipt insufficient | Requires a stronger ordering and completeness construction |
| Complete session provenance | Individual receipt insufficient | One claim cannot establish completeness |
| Calls observed by a cooperating agent client | Possible | Proves only that client's signed observation |
| Shadow or uncooperative MCP traffic | Not solved by `client_observed` | The client cannot attest activity it did not observe |

## Verification boundary

Successful verification establishes that the expected key signed the unchanged declared claim under the selected profile. It does not establish claim truth, signer independence, correct authorization or policy, actual or correct execution, complete history, secure key custody, or an uncompromised runtime. Apply domain policy and check referenced evidence separately.
