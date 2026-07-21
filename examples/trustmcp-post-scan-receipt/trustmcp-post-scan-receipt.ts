#!/usr/bin/env node

import { createHash, randomUUID, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableJson } from "../../src/hash.js";
import { setupKeys } from "../../src/keys.js";
import {
  interopPublicKeyId,
  verifyInteropReceipt,
} from "../interop-v0.1/verify-receipt.js";

const EXAMPLE_DIR = resolve("examples/trustmcp-post-scan-receipt");

type JsonObject = Record<string, unknown>;

type TrustMcpReport = {
  tool: { name: string; version: string };
  target: {
    input: string;
    displayName: string;
    sourceType: string;
    resolvedRef: string;
  };
  coverage: unknown;
  limitations: unknown;
  summary: unknown;
  findings: unknown[];
  newFindings: Array<{ severity?: string }>;
};

function readJson(fileName: string): JsonObject {
  return JSON.parse(readFileSync(resolve(EXAMPLE_DIR, fileName), "utf8")) as JsonObject;
}

function artifactHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function isTrustMcpReport(value: JsonObject): value is JsonObject & TrustMcpReport {
  const tool = value.tool as JsonObject | undefined;
  const target = value.target as JsonObject | undefined;
  return Boolean(
    tool &&
      typeof tool.name === "string" &&
      typeof tool.version === "string" &&
      target &&
      typeof target.input === "string" &&
      typeof target.displayName === "string" &&
      typeof target.sourceType === "string" &&
      typeof target.resolvedRef === "string" &&
      "coverage" in value &&
      "limitations" in value &&
      "summary" in value &&
      Array.isArray(value.findings) &&
      Array.isArray(value.newFindings),
  );
}

function main(): void {
  const reportJson = readJson("sample-trustmcp-report.json");
  const effectiveConfig = readJson("sample-trustmcp-config.json");
  const baseline = readJson("sample-trustmcp-baseline.json");

  if (!isTrustMcpReport(reportJson)) {
    throw new Error("Synthetic report does not match the required TrustMCP JSON fields");
  }

  const failOnThreshold = effectiveConfig.failOn;
  if (typeof failOnThreshold !== "string") {
    throw new Error("Synthetic effective config is missing failOn");
  }

  const severityRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const thresholdRank = severityRank[failOnThreshold];
  if (thresholdRank === undefined) {
    throw new Error(`Unsupported synthetic failOn threshold: ${failOnThreshold}`);
  }

  const blockingNewFindings = reportJson.newFindings.filter(
    (finding) =>
      typeof finding.severity === "string" &&
      (severityRank[finding.severity] ?? Number.POSITIVE_INFINITY) >= thresholdRank,
  );
  const gatePassed = blockingNewFindings.length === 0;

  const { privateKeyPem, publicKeyPem } = setupKeys();
  const claim = {
    receipt_version: "0.1",
    receipt_role: "client_observed",
    event_id: `evt_trustmcp_${randomUUID()}`,
    timestamp: new Date().toISOString(),
    action_type: "trustmcp.scan.gate",
    status: gatePassed ? "passed" : "failed",
    trustmcp_version: reportJson.tool.version,
    trustmcp_rule_metadata_hash: artifactHash(effectiveConfig.ruleMetadata),
    target_input: reportJson.target.input,
    target_display_name: reportJson.target.displayName,
    target_source_type: reportJson.target.sourceType,
    target_resolved_ref: reportJson.target.resolvedRef,
    fail_on_threshold: failOnThreshold,
    gate_result: {
      passed: gatePassed,
      blocking_new_findings: blockingNewFindings.length,
      evaluated_new_findings: reportJson.newFindings.length,
    },
    trustmcp_report_hash: artifactHash(reportJson),
    trustmcp_effective_config_hash: artifactHash(effectiveConfig),
    trustmcp_baseline_hash: artifactHash(baseline),
    verification_limits: [
      "Does not prove the scanned MCP server is safe.",
      "Does not prove scanner completeness.",
      "Does not prove the config, baseline, or gate decision was wise.",
    ],
  } as const;

  const receipt = {
    claim,
    signature: sign(null, Buffer.from(stableJson(claim)), privateKeyPem).toString("base64"),
    public_key_id: interopPublicKeyId(publicKeyPem),
  };
  const verification = verifyInteropReceipt(JSON.stringify(receipt), publicKeyPem);

  console.log("Experimental TrustMCP post-scan receipt example");
  console.log(`Gate decision: ${gatePassed ? "PASS" : "FAIL"} (${claim.status})`);
  console.log(`trustmcp_report_hash: ${claim.trustmcp_report_hash}`);
  console.log(`trustmcp_effective_config_hash: ${claim.trustmcp_effective_config_hash}`);
  console.log(`trustmcp_baseline_hash: ${claim.trustmcp_baseline_hash}`);
  console.log(`Signing: PASS (${receipt.public_key_id})`);

  if (!verification.ok) {
    console.error(`Verification: FAIL (${verification.reason})`);
    process.exitCode = 1;
    return;
  }

  console.log("Verification: PASS (signed claim is intact)");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}
