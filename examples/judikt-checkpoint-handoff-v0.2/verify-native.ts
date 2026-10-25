#!/usr/bin/env node

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKPOINT_FILENAME, FIXTURE_HMAC_SECRET } from "./generate.js";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function pythonSortedCompactJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonSortedCompactJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${pythonSortedCompactJson(value[key])}`).join(",")}}`;
}

export function verifyNativeJudiktCheckpoint(checkpointText: string, secret: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(checkpointText);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const checkpoint = parsed as Record<string, unknown>;
  if (typeof checkpoint.chain_id !== "string"
    || !Number.isSafeInteger(checkpoint.seq)
    || typeof checkpoint.head_hash !== "string"
    || !/^[0-9a-f]{64}$/.test(checkpoint.head_hash)
    || typeof checkpoint.created_at !== "string"
    || typeof checkpoint.signature !== "string"
    || !/^[0-9a-f]{64}$/.test(checkpoint.signature)) return false;

  const payload: Record<string, JsonValue> = {
    chain_id: checkpoint.chain_id,
    seq: checkpoint.seq as number,
    head_hash: checkpoint.head_hash,
    created_at: checkpoint.created_at,
  };
  const expected = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(pythonSortedCompactJson(payload), "utf8")
    .digest();
  return timingSafeEqual(expected, Buffer.from(checkpoint.signature, "hex"));
}

function main(): void {
  const checkpointText = readFileSync(resolve("examples", "judikt-checkpoint-handoff-v0.2", CHECKPOINT_FILENAME), "utf8");
  if (!verifyNativeJudiktCheckpoint(checkpointText, FIXTURE_HMAC_SECRET)) {
    throw new Error("native Judikt checkpoint HMAC verification failed");
  }
  console.log("PASS native Judikt checkpoint HMAC verified with the fixture-only shared secret");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
