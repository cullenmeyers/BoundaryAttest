# Receipt Lineage

Execution receipts can include optional lineage metadata:

- `lineage_ref`: an upstream proposal, ticket, approval, workflow run, execution record, URL, or URI.
- `lineage_type`: one of `proposal`, `approval`, `ticket`, `change_request`, `workflow_run`, `execution_record`, or `other`.
- `lineage_hash`: an optional host-supplied fingerprint of the upstream record.
- `lineage_label`: an optional human-readable label.

This is not a full lineage engine. BoundaryAttest does not manage proposals, approvals, tickets, workflows, governance state, or authorization.

The point is smaller: preserve continuity between an upstream record and the server-attested tool execution. A host system can create or reference an upstream record, pass that lineage metadata into BoundaryAttest, and later review the chain:

```text
upstream intent/approval record -> server-attested execution receipt -> outcome/review
```

BoundaryAttest records the lineage metadata into the signed receipt payload when present. It does not verify the upstream record by itself. `lineage_ref` and `lineage_hash` are only as trustworthy as the host system that supplied them.
