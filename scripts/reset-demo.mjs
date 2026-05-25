import { existsSync, rmSync } from "node:fs";

const receiptsDir = "receipts";

if (existsSync(receiptsDir)) {
  rmSync(receiptsDir, { recursive: true, force: true });
  console.log("Removed: ./receipts/");
} else {
  console.log("Removed: nothing (./receipts/ did not exist)");
}
