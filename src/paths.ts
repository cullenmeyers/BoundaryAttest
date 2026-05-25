import { join } from "node:path";

export const KEY_DIR = ".agentreceipt/keys";
export const RECEIPT_DIR = "receipts";
export const PRIVATE_KEY_PATH = join(KEY_DIR, "agentreceipt-demo-private.pem");
export const PUBLIC_KEY_PATH = join(KEY_DIR, "agentreceipt-demo-public.pem");
export const PUBLIC_KEY_ID_PATH = join(KEY_DIR, "agentreceipt-demo-public-key-id.txt");
