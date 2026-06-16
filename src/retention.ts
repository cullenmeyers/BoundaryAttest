import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { CONFIG_PATH, RECEIPT_DIR } from "./paths.js";
import { listReceiptPaths, parseReceipt, type Receipt } from "./receipts.js";

export type RetentionConfig = {
  maxAgeDays: number;
  maxCount: number;
};

export type PruneResult = {
  scanned: number;
  deletedByAge: number;
  deletedByCount: number;
  retained: number;
  maxAgeDays: number;
  maxCount: number;
};

type ConfigFile = {
  retention?: Partial<RetentionConfig>;
};

type ReceiptFile = {
  receiptPath: string;
  receipt: Receipt;
};

const DEFAULT_RETENTION: RetentionConfig = {
  maxAgeDays: 30,
  maxCount: 1000,
};

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function loadRetentionConfig(): RetentionConfig {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_RETENTION;
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as ConfigFile;
  return {
    maxAgeDays: readPositiveInteger(config.retention?.maxAgeDays, DEFAULT_RETENTION.maxAgeDays),
    maxCount: readPositiveInteger(config.retention?.maxCount, DEFAULT_RETENTION.maxCount),
  };
}

function listExistingReceiptFiles(): string[] {
  if (!existsSync(RECEIPT_DIR)) {
    return [];
  }

  return listReceiptPaths();
}

function sortByTimestamp(receipts: ReceiptFile[]): ReceiptFile[] {
  return receipts.sort((a, b) => a.receipt.timestamp.localeCompare(b.receipt.timestamp));
}

export function pruneReceipts(now = new Date()): PruneResult {
  const config = loadRetentionConfig();
  const receiptPaths = listExistingReceiptFiles();
  const receipts = sortByTimestamp(receiptPaths.map((receiptPath) => ({ receiptPath, receipt: parseReceipt(receiptPath) })));
  const cutoffMs = now.getTime() - config.maxAgeDays * 24 * 60 * 60 * 1000;

  let deletedByAge = 0;
  const ageRetained: ReceiptFile[] = [];

  for (const item of receipts) {
    if (new Date(item.receipt.timestamp).getTime() < cutoffMs) {
      unlinkSync(item.receiptPath);
      deletedByAge += 1;
    } else {
      ageRetained.push(item);
    }
  }

  let deletedByCount = 0;
  const countToDelete = Math.max(0, ageRetained.length - config.maxCount);
  for (const item of ageRetained.slice(0, countToDelete)) {
    unlinkSync(item.receiptPath);
    deletedByCount += 1;
  }

  return {
    scanned: receiptPaths.length,
    deletedByAge,
    deletedByCount,
    retained: ageRetained.length - deletedByCount,
    maxAgeDays: config.maxAgeDays,
    maxCount: config.maxCount,
  };
}
