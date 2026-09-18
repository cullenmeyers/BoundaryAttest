#!/usr/bin/env node

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_HMAC_SECRET } from "./generate.js";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type NativeReceipt = { receipt: JsonValue; signature: string };

function pythonSortedCompactJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonSortedCompactJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${pythonSortedCompactJson(value[key])}`).join(",")}}`;
}

export function verifyNativeCtzReceipt(receiptText: string, secret: string): boolean {
  const parsed = JSON.parse(receiptText) as NativeReceipt;
  if (!parsed.receipt || typeof parsed.signature !== "string" || !/^[0-9a-f]{64}$/.test(parsed.signature)) return false;
  const expected = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(pythonSortedCompactJson(parsed.receipt), "utf8")
    .digest();
  return timingSafeEqual(expected, Buffer.from(parsed.signature, "hex"));
}

function main(): void {
  const receiptText = readFileSync(resolve("examples", "ctz-hmac-export-v0.2", "ctz-native-receipt.json"), "utf8");
  if (!verifyNativeCtzReceipt(receiptText, FIXTURE_HMAC_SECRET)) throw new Error("native CTZ HMAC verification failed");
  console.log("PASS native CTZ HMAC verified with the fixture-only shared secret");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
