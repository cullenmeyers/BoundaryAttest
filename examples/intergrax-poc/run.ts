import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXECUTION_BOUNDARY_SCHEMA_ID,
  executionBoundaryEvents,
  persistIntergraxEventReceipt,
  type HashComparison,
  type IntergraxRunResponse,
} from "./adapter.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:8097";
const REQUEST_PATH = join(process.cwd(), "examples", "intergrax-poc", "fixtures", "poc_run_request.v1.json");

function apiKey(): string | undefined {
  return process.env.INTERGRAX_HARNESS_API_KEY || process.env.INTERGRAX_API_KEY || undefined;
}

function baseUrl(): string {
  return (process.env.INTERGRAX_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function formatHashComparison(comparison: HashComparison): string {
  const base = `${comparison.field}: ${comparison.status}`;
  return comparison.reason ? `${base} (${comparison.reason})` : base;
}

async function postPocRun(): Promise<IntergraxRunResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = apiKey();

  if (key) {
    headers["X-Api-Key"] = key;
  }

  const response = await fetch(`${baseUrl()}/v1/attestation_demo/poc/run`, {
    method: "POST",
    headers,
    body: readFileSync(REQUEST_PATH, "utf8"),
  });

  if (!response.ok) {
    throw new Error(`Intergrax PoC request failed: HTTP ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as IntergraxRunResponse;
}

async function main(): Promise<void> {
  const response = await postPocRun();
  const unsupported = (response.boundary_events ?? []).filter((event) => event.schema_id !== EXECUTION_BOUNDARY_SCHEMA_ID);

  for (const event of unsupported) {
    console.log(`Skipping unsupported boundary event schema: ${event.schema_id}`);
  }

  const events = executionBoundaryEvents(response);
  if (events.length === 0) {
    throw new Error(`No ${EXECUTION_BOUNDARY_SCHEMA_ID} events found in Intergrax response`);
  }

  for (const event of events) {
    const persisted = await persistIntergraxEventReceipt(event, response);
    console.log(`receipt_path: ${persisted.receiptPath ?? "<none>"}`);
    console.log(`evidence_path: ${persisted.evidencePath ?? "<none>"}`);
    console.log(`verification: ${persisted.verificationValid ? "valid" : "invalid"}`);
    console.log(`run_id: ${event.run_id ?? response.run_id ?? "<missing>"}`);
    console.log(`step_id: ${event.step_id ?? "<missing>"}`);
    console.log(`receipt_role: ${persisted.receipt.receipt_role}`);
    for (const comparison of persisted.hashComparisons) {
      console.log(`hash_${formatHashComparison(comparison)}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
