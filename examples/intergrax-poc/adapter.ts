import { writeFileSync } from "node:fs";
import { hashValue } from "../../src/hash.js";
import {
  createSignedReceipt,
  type ActionStatus,
  type CreateReceiptOptions,
  type LineageMetadata,
  type LineageType,
  type Receipt,
} from "../../src/receipts.js";
import { LocalFileReceiptSink, type ReceiptSinkResult } from "../../src/sinks.js";
import { verifyReceipt } from "../../src/signing.js";

export const EXECUTION_BOUNDARY_SCHEMA_ID = "execution_boundary_event.v1";

type JsonObject = Record<string, unknown>;

export type IntergraxLineage = {
  ref?: string;
  type?: string;
  hash?: string;
  label?: string;
};

export type IntergraxBoundaryEvent = {
  schema_id: string;
  event_id?: string;
  boundary_type?: string;
  signed?: boolean;
  tool_id?: string;
  agent_id?: string;
  run_id?: string;
  step_id?: string;
  task_id?: string;
  tenant_id?: string;
  action_status?: string;
  side_effects?: boolean;
  risk_level?: string;
  input?: unknown;
  output?: unknown;
  input_hash?: string;
  output_hash?: string;
  occurred_at?: string;
  lineage?: IntergraxLineage;
  runtime_ref?: unknown;
};

export type IntergraxRunResponse = {
  run_id?: string;
  task_id?: string;
  boundary_events?: IntergraxBoundaryEvent[];
  trust_model?: unknown;
  metadata?: unknown;
};

export type HashComparisonStatus = "match" | "mismatch" | "not_comparable";

export type HashComparison = {
  field: "input" | "output";
  status: HashComparisonStatus;
  agentReceiptHash: string;
  intergraxHash: string | null;
  reason?: string;
};

export type IntergraxReceiptMapping = {
  receiptOptions: Omit<CreateReceiptOptions, "previousReceiptHash">;
  toolMetadata: JsonObject;
  hashComparisons: HashComparison[];
};

export type PersistedIntergraxReceipt = {
  receipt: Receipt;
  sinkResult: ReceiptSinkResult;
  receiptPath: string | null;
  verificationValid: boolean;
  evidencePath: string | null;
  hashComparisons: HashComparison[];
};

const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const PREFIXED_SHA256 = /^sha256:([a-f0-9]{64})$/i;

function requireString(value: string | undefined, field: string): string {
  if (!value) {
    throw new Error(`Intergrax event is missing required field: ${field}`);
  }

  return value;
}

function mapActionStatus(status: string | undefined): ActionStatus {
  switch (status) {
    case "executed":
    case "failed":
    case "success":
    case "failure":
      return status;
    default:
      throw new Error(`Unsupported Intergrax action_status: ${status ?? "<missing>"}`);
  }
}

function mapLineage(lineage: IntergraxLineage | undefined): LineageMetadata | undefined {
  if (!lineage?.ref) {
    return undefined;
  }

  const mapped: LineageMetadata = {
    ref: lineage.ref,
    type: isLineageType(lineage.type) ? lineage.type : "other",
  };

  if (lineage.hash !== undefined) {
    mapped.hash = lineage.hash;
  }

  if (lineage.label !== undefined) {
    mapped.label = lineage.label;
  }

  return mapped;
}

function isLineageType(value: string | undefined): value is LineageType {
  return (
    value === "proposal" ||
    value === "approval" ||
    value === "ticket" ||
    value === "change_request" ||
    value === "workflow_run" ||
    value === "execution_record" ||
    value === "other"
  );
}

function comparableDigest(intergraxHash: string | undefined): { digest: string | null; reason?: string } {
  if (intergraxHash === undefined || intergraxHash === "") {
    return { digest: null, reason: "Intergrax hash is missing" };
  }

  if (HEX_SHA256.test(intergraxHash)) {
    return { digest: intergraxHash.toLowerCase() };
  }

  const prefixed = intergraxHash.match(PREFIXED_SHA256);
  if (prefixed) {
    return { digest: prefixed[1].toLowerCase() };
  }

  return {
    digest: null,
    reason: `Intergrax hash is not comparable; expected sha256:<64 hex> or <64 hex>, got ${JSON.stringify(
      intergraxHash,
    )}`,
  };
}

export function compareIntergraxHash(
  field: "input" | "output",
  value: unknown,
  intergraxHash: string | undefined,
): HashComparison {
  const agentReceiptHash = hashValue(value);
  const comparable = comparableDigest(intergraxHash);

  if (comparable.digest === null) {
    return {
      field,
      status: "not_comparable",
      agentReceiptHash,
      intergraxHash: intergraxHash ?? null,
      reason: comparable.reason,
    };
  }

  return {
    field,
    status: comparable.digest === agentReceiptHash ? "match" : "mismatch",
    agentReceiptHash,
    intergraxHash: intergraxHash ?? null,
    reason: comparable.digest === agentReceiptHash ? undefined : "Digest differs from AgentReceipt canonical hash",
  };
}

export function mapIntergraxEventToReceiptOptions(
  event: IntergraxBoundaryEvent,
  response: Pick<IntergraxRunResponse, "trust_model" | "metadata"> = {},
): IntergraxReceiptMapping {
  if (event.schema_id !== EXECUTION_BOUNDARY_SCHEMA_ID) {
    throw new Error(`Unsupported Intergrax boundary event schema: ${event.schema_id}`);
  }

  const toolMetadata: JsonObject = {
    source: "intergrax",
    source_schema_id: event.schema_id,
    event_id: event.event_id ?? null,
    boundary_type: event.boundary_type ?? null,
    intergrax_signed: event.signed === true,
    run_id: event.run_id ?? null,
    step_id: event.step_id ?? null,
    task_id: event.task_id ?? null,
    tenant_id: event.tenant_id ?? null,
    side_effects: event.side_effects ?? null,
    risk_level: event.risk_level ?? null,
    input_hash: event.input_hash ?? null,
    output_hash: event.output_hash ?? null,
    runtime_ref: event.runtime_ref ?? null,
    trust_model: response.trust_model ?? null,
    response_metadata: response.metadata ?? null,
    receipt_trust_note:
      "AgentReceipt locally signs the event received by this adapter; Intergrax did not cryptographically sign or attest this event.",
  };

  return {
    receiptOptions: {
      agentId: requireString(event.agent_id, "agent_id"),
      tool: requireString(event.tool_id, "tool_id"),
      actionStatus: mapActionStatus(event.action_status),
      input: event.input,
      output: event.output,
      timestamp: event.occurred_at,
      receiptRole: "client_observed",
      toolMetadata,
      lineage: mapLineage(event.lineage),
      receiptPolicy: {
        mode: "required",
        reason: "Intergrax PoC boundary event received by local AgentReceipt adapter",
      },
    },
    toolMetadata,
    hashComparisons: [
      compareIntergraxHash("input", event.input, event.input_hash),
      compareIntergraxHash("output", event.output, event.output_hash),
    ],
  };
}

export function createReceiptFromIntergraxEvent(
  event: IntergraxBoundaryEvent,
  response: Pick<IntergraxRunResponse, "trust_model" | "metadata"> = {},
  previousReceiptHash: string | null = null,
): { receipt: Receipt; mapping: IntergraxReceiptMapping } {
  const mapping = mapIntergraxEventToReceiptOptions(event, response);
  const receipt = createSignedReceipt({
    ...mapping.receiptOptions,
    previousReceiptHash,
    receiptRole: "client_observed",
  });

  return { receipt, mapping };
}

export async function persistIntergraxEventReceipt(
  event: IntergraxBoundaryEvent,
  response: Pick<IntergraxRunResponse, "trust_model" | "metadata"> = {},
  sink = new LocalFileReceiptSink(),
): Promise<PersistedIntergraxReceipt> {
  const mapping = mapIntergraxEventToReceiptOptions(event, response);
  const { receipt, sinkResult } = await sink.createAndWriteReceipt({
    ...mapping.receiptOptions,
    receiptRole: "client_observed",
  });
  const receiptPath = sinkResult.receiptPath ?? null;
  const evidencePath = receiptPath ? `${receiptPath}.intergrax-evidence.json` : null;

  if (evidencePath) {
    writeFileSync(
      evidencePath,
      `${JSON.stringify(
        {
          receipt_id: receipt.receipt_id,
          tool_metadata_hash: receipt.tool_metadata_hash,
          tool_metadata: mapping.toolMetadata,
          boundary_event: event,
          hash_comparisons: mapping.hashComparisons,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  return {
    receipt,
    sinkResult,
    receiptPath,
    evidencePath,
    verificationValid: verifyReceipt(receipt),
    hashComparisons: mapping.hashComparisons,
  };
}

export function executionBoundaryEvents(response: IntergraxRunResponse): IntergraxBoundaryEvent[] {
  return (response.boundary_events ?? []).filter((event) => event.schema_id === EXECUTION_BOUNDARY_SCHEMA_ID);
}
