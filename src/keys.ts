import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { KEY_DIR, PRIVATE_KEY_PATH, PUBLIC_KEY_ID_PATH, PUBLIC_KEY_PATH, RECEIPT_DIR } from "./paths.js";
import { sha256 } from "./hash.js";

export type KeyMaterial = {
  privateKeyPem: string;
  publicKeyPem: string;
  publicKeyId: string;
  created: boolean;
};

export function ensureDirectories(): void {
  mkdirSync(KEY_DIR, { recursive: true });
  mkdirSync(RECEIPT_DIR, { recursive: true });
}

function createPublicKeyId(publicKeyPem: string): string {
  return `sha256:${sha256(publicKeyPem).slice(0, 24)}`;
}

export function setupKeys(): KeyMaterial {
  ensureDirectories();

  if (existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH) && existsSync(PUBLIC_KEY_ID_PATH)) {
    return {
      privateKeyPem: readFileSync(PRIVATE_KEY_PATH, "utf8"),
      publicKeyPem: readFileSync(PUBLIC_KEY_PATH, "utf8"),
      publicKeyId: readFileSync(PUBLIC_KEY_ID_PATH, "utf8").trim(),
      created: false,
    };
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const publicKeyId = createPublicKeyId(publicKey);

  writeFileSync(PRIVATE_KEY_PATH, privateKey, { encoding: "utf8", mode: 0o600 });
  writeFileSync(PUBLIC_KEY_PATH, publicKey, "utf8");
  writeFileSync(PUBLIC_KEY_ID_PATH, `${publicKeyId}\n`, "utf8");

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    publicKeyId,
    created: true,
  };
}

export function loadPublicKey(): string {
  if (!existsSync(PUBLIC_KEY_PATH)) {
    throw new Error("No public key found. Run npm run build, then npm run setup or npm run demo first.");
  }
  return readFileSync(PUBLIC_KEY_PATH, "utf8");
}
