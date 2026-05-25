import { existsSync, rmSync } from "node:fs";

const targets = ["receipts", ".agentreceipt"];

console.log("WARNING: reset:all removes local signing keys. Old receipts may no longer verify with the same key.");

let removedAny = false;
for (const target of targets) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`Removed: ./${target}/`);
    removedAny = true;
  }
}

if (!removedAny) {
  console.log("Removed: nothing (./receipts/ and ./.agentreceipt/ did not exist)");
}
