#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_DIR = resolve("examples/benchmark-result-public-v0.1");

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type ExpectedFixture = {
  public_canonical_artifact_bytes: string;
  public_canonical_artifact_hash: string;
  full_artifact_hash: string;
};

function sha256(bytes: Buffer | string): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Non-finite numbers are not permitted");
  }
  return Object.is(value, -0) ? 0 : value;
}

function normalizedInteger(value: number, field: string): number {
  const normalized = normalizedNumber(value);
  if (!Number.isInteger(normalized)) {
    throw new Error(`${field} must be an integer`);
  }
  return normalized;
}

function normalizeValue(value: JsonValue, field?: string): JsonValue {
  if (typeof value === "boolean" || typeof value === "string" || value === null) {
    return value;
  }

  if (typeof value === "number") {
    const normalized = normalizedNumber(value);
    switch (field) {
      case "success_rate":
        return normalized.toFixed(1);
      case "avg_cost_usd":
        return normalized.toFixed(4);
      case "avg_latency_s":
        return normalized.toFixed(2);
      case "avg_tokens":
      case "runs":
      case "avg_turns":
        return normalizedInteger(normalized, field);
      default:
        return normalized;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  const sorted: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = normalizeValue(value[key], key);
  }
  return sorted;
}

function buildPublicCanonicalArtifact(parsed: JsonValue): string {
  if (!isObject(parsed) || !isObject(parsed.config) || !isObject(parsed.agg)) {
    throw new Error("Fixture must contain config and agg objects");
  }

  const { key_file: _keyFile, out: _out, ...publicConfig } = parsed.config;
  const publicArtifact: JsonValue = {
    config: publicConfig,
    agg: parsed.agg,
  };

  return JSON.stringify(normalizeValue(publicArtifact));
}

function main(): void {
  const artifactBytes = readFileSync(resolve(FIXTURE_DIR, "fixture_artifact.json"));
  const expected = JSON.parse(
    readFileSync(resolve(FIXTURE_DIR, "fixture_expected.json"), "utf8"),
  ) as ExpectedFixture;

  const fullArtifactHash = sha256(artifactBytes);
  const parsed = JSON.parse(artifactBytes.toString("utf8")) as JsonValue;
  const canonicalBytes = buildPublicCanonicalArtifact(parsed);
  const publicCanonicalArtifactHash = sha256(Buffer.from(canonicalBytes, "utf8"));

  const canonicalBytesMatched = canonicalBytes === expected.public_canonical_artifact_bytes;
  const publicHashMatched = publicCanonicalArtifactHash === expected.public_canonical_artifact_hash;
  const fullHashMatched = fullArtifactHash === expected.full_artifact_hash;

  console.log("Experimental benchmark-result-public-v0.1 interop fixture");

  if (!canonicalBytesMatched || !publicHashMatched || !fullHashMatched) {
    console.error("FAIL canonical artifact or hash mismatch");
    console.error(`Expected canonical bytes: ${expected.public_canonical_artifact_bytes}`);
    console.error(`Actual canonical bytes:   ${canonicalBytes}`);
    console.error(`Expected public hash: ${expected.public_canonical_artifact_hash}`);
    console.error(`Actual public hash:   ${publicCanonicalArtifactHash}`);
    console.error(`Expected full hash:   ${expected.full_artifact_hash}`);
    console.error(`Actual full hash:     ${fullArtifactHash}`);
    process.exitCode = 1;
    return;
  }

  console.log("PASS canonical bytes match exactly");
  console.log(`PASS public_canonical_artifact_hash: ${publicCanonicalArtifactHash}`);
  console.log(`PASS full_artifact_hash: ${fullArtifactHash}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}
