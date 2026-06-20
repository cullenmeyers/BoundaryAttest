import { writeFileSync } from "node:fs";
import { hashValue } from "../../src/hash.js";
import {
  verifyHostAttestation,
  type HostAttestationVerification,
} from "../../src/hostAttestation.js";
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
export const INTERGRAX_EBE9_PUBLIC_KEY_ID = "attestation-demo-host-1";
export const INTERGRAX_EBE9_PUBLIC_KEY_BASE64 = "Gqzzm+wKy7G3VnqP0nDCgodIu28F21Y4jp6kkcH44vc=";

const INTERGRAX_HOST_ATTESTATION_KEYS = {
  [INTERGRAX_EBE9_PUBLIC_KEY_ID]: INTERGRAX_EBE9_PUBLIC_KEY_BASE64,
} as const;

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
  event_sequence?: number;
  boundary_type?: string;
  signed?: boolean;
  host_attestation?: unknown;
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
  input_hash?: string | null;
  output_hash?: string | null;
  error_message?: string | null;
  policy_verdicts?: unknown[];
  step_outcome?: unknown;
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
  hostAttestationVerification: HostAttestationVerification | null;
};

export type PersistedIntergraxReceipt = {
  receipt: Receipt;
  sinkResult: ReceiptSinkResult;
  receiptPath: string | null;
  verificationValid: boolean;
  evidencePath: string | null;
  hashComparisons: HashComparison[];
  hostAttestationVerification: HostAttestationVerification | null;
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
    case "completed":
      return "success";
    default:
      throw new Error(`Unsupported Intergrax action_status: ${status ?? "<missing>"}`);
  }
}

function mapTool(event: IntergraxBoundaryEvent): string {
  if (event.boundary_type === "tool_execution") {
    return requireString(event.tool_id, "tool_id");
  }

  if (event.boundary_type === "harness_step") {
    return "intergrax.harness_step";
  }

  throw new Error(`Unsupported Intergrax boundary_type: ${event.boundary_type ?? "<missing>"}`);
}

function requireEventSequence(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1) {
    throw new Error(`Intergrax event has invalid event_sequence: ${value ?? "<missing>"}`);
  }

  return value as number;
}

function mapTimestamp(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Intergrax event has invalid occurred_at: ${value}`);
  }

  return parsed.toISOString();
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

function comparableDigest(intergraxHash: string | null | undefined): { digest: string | null; reason?: string } {
  if (intergraxHash === undefined || intergraxHash === null || intergraxHash === "") {
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

export function verifyIntergraxHostAttestation(
  event: IntergraxBoundaryEvent,
): HostAttestationVerification | null {
  if (event.signed !== true) {
    if (event.host_attestation !== undefined && event.host_attestation !== null) {
      throw new Error("Unsigned Intergrax event must not include a host_attestation envelope");
    }
    return null;
  }

  if (event.host_attestation === undefined || event.host_attestation === null) {
    throw new Error("Signed Intergrax event is missing required host_attestation envelope");
  }

  return verifyHostAttestation(event as JsonObject, event.host_attestation, INTERGRAX_HOST_ATTESTATION_KEYS);
}

export function compareIntergraxHash(
  field: "input" | "output",
  value: unknown,
  intergraxHash: string | null | undefined,
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
  response: Pick<IntergraxRunResponse, "run_id" | "task_id" | "trust_model" | "metadata"> = {},
): IntergraxReceiptMapping {
  if (event.schema_id !== EXECUTION_BOUNDARY_SCHEMA_ID) {
    throw new Error(`Unsupported Intergrax boundary event schema: ${event.schema_id}`);
  }

  const eventId = requireString(event.event_id, "event_id");
  const eventSequence = requireEventSequence(event.event_sequence);
  const boundaryType = requireString(event.boundary_type, "boundary_type");
  const hostAttestationVerification = verifyIntergraxHostAttestation(event);
  const toolMetadata: JsonObject = {
    source: "intergrax",
    source_schema_id: event.schema_id,
    source_event_key: eventId,
    event_id: eventId,
    event_sequence: eventSequence,
    boundary_type: boundaryType,
    source_action_status: event.action_status ?? null,
    intergrax_signed: event.signed === true,
    intergrax_host_attestation: hostAttestationVerification
      ? {
          verification: "verified",
          public_key_id: hostAttestationVerification.publicKeyId,
          signature_algorithm: hostAttestationVerification.signatureAlgorithm,
          signed_at: hostAttestationVerification.signedAt,
          signed_payload_hash: hostAttestationVerification.signedPayloadHash,
        }
      : { verification: "unsigned" },
    run_id: event.run_id ?? null,
    step_id: event.step_id ?? null,
    task_id: event.task_id ?? null,
    tenant_id: event.tenant_id ?? null,
    side_effects: event.side_effects ?? null,
    risk_level: event.risk_level ?? null,
    input_hash: event.input_hash ?? null,
    output_hash: event.output_hash ?? null,
    error_message: event.error_message ?? null,
    policy_verdicts: event.policy_verdicts ?? [],
    step_outcome: event.step_outcome ?? null,
    runtime_ref: event.runtime_ref ?? null,
    trust_model: response.trust_model ?? null,
    response_metadata: response.metadata ?? null,
    receipt_trust_note: hostAttestationVerification
      ? "Intergrax host signature was verified as a separate host/runtime claim; BoundaryAttest locally signs only its client-observed ingestion wrapper."
      : "BoundaryAttest locally signs the unsigned event received by this adapter; no Intergrax host signature was present.",
  };

  return {
    receiptOptions: {
      agentId: requireString(event.agent_id, "agent_id"),
      tool: mapTool(event),
      actionStatus: mapActionStatus(event.action_status),
      input: event.input,
      output: event.output,
      error: event.error_message ?? undefined,
      timestamp: mapTimestamp(event.occurred_at),
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
    hostAttestationVerification,
  };
}

export function createReceiptFromIntergraxEvent(
  event: IntergraxBoundaryEvent,
  response: Pick<IntergraxRunResponse, "run_id" | "task_id" | "trust_model" | "metadata"> = {},
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
  response: Pick<IntergraxRunResponse, "run_id" | "task_id" | "trust_model" | "metadata"> = {},
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
          event_id: requireString(event.event_id, "event_id"),
          event_sequence: requireEventSequence(event.event_sequence),
          boundary_type: requireString(event.boundary_type, "boundary_type"),
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
    hostAttestationVerification: mapping.hostAttestationVerification,
  };
}

export function executionBoundaryEvents(response: IntergraxRunResponse): IntergraxBoundaryEvent[] {
  return (response.boundary_events ?? [])
    .filter((event) => event.schema_id === EXECUTION_BOUNDARY_SCHEMA_ID)
    .sort((left, right) => requireEventSequence(left.event_sequence) - requireEventSequence(right.event_sequence));
}

export async function persistIntergraxRunReceipts(
  response: IntergraxRunResponse,
  sink = new LocalFileReceiptSink(),
): Promise<PersistedIntergraxReceipt[]> {
  const persisted: PersistedIntergraxReceipt[] = [];

  for (const event of executionBoundaryEvents(response)) {
    persisted.push(await persistIntergraxEventReceipt(event, response, sink));
  }

  return persisted;
}
