import { parseReceipt, receiptHash, type Receipt } from "./receipts.js";

export type ReceiptWithPath = {
  receiptPath: string;
  receipt: Receipt;
};

export function sortedReceipts(receiptPaths: string[]): ReceiptWithPath[] {
  return receiptPaths
    .map((receiptPath) => ({ receiptPath, receipt: parseReceipt(receiptPath) }))
    .sort((a, b) => a.receipt.timestamp.localeCompare(b.receipt.timestamp));
}

export function latestReceiptHash(receipts: ReceiptWithPath[]): string | null {
  const latest = receipts.at(-1);
  return latest ? receiptHash(latest.receipt) : null;
}
