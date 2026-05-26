import { parseReceipt, receiptHash, type Receipt } from "./receipts.js";
import { verifyReceipt } from "./signing.js";

export type ReceiptWithPath = {
  receiptPath: string;
  receipt: Receipt;
};

export type ChainItemStatus = ReceiptWithPath & {
  signatureValid: boolean;
  linkValid: boolean;
};

export type ChainVerificationResult = {
  intact: boolean;
  items: ChainItemStatus[];
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

export function verifyStrictChain(receipts: ReceiptWithPath[], publicKeyPem: string): ChainVerificationResult {
  let intact = true;
  let previousHash: string | null = null;

  const items = receipts.map((item) => {
    const signatureValid = verifyReceipt(item.receipt, publicKeyPem);
    const linkValid = item.receipt.previous_receipt_hash === previousHash;
    if (!signatureValid || !linkValid) {
      intact = false;
    }

    previousHash = receiptHash(item.receipt);
    return { ...item, signatureValid, linkValid };
  });

  return { intact, items };
}

export function verifyRetainedChain(receipts: ReceiptWithPath[], publicKeyPem: string): ChainVerificationResult {
  let intact = true;
  let previousHash: string | null = null;

  const items = receipts.map((item, index) => {
    const signatureValid = verifyReceipt(item.receipt, publicKeyPem);
    const linkValid = index === 0 ? true : item.receipt.previous_receipt_hash === previousHash;
    if (!signatureValid || !linkValid) {
      intact = false;
    }

    previousHash = receiptHash(item.receipt);
    return { ...item, signatureValid, linkValid };
  });

  return { intact, items };
}
