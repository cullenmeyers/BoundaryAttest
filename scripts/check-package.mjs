import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const temp = mkdtempSync(join(tmpdir(), "boundaryattest-package-"));
let tarballPath = null;

function run(command, args, cwd = root) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
  });
}

try {
  const packed = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts"]));
  assert.equal(Array.isArray(packed), true);
  assert.equal(packed.length, 1);

  const manifest = packed[0];
  tarballPath = join(root, manifest.filename);
  assert.equal(existsSync(tarballPath), true);
  assert.equal(manifest.name, "boundaryattest");

  for (const file of manifest.files) {
    const path = file.path;
    const allowed =
      path === "package.json" ||
      path === "README.md" ||
      path === "LICENSE" ||
      path.startsWith("dist/src/");
    assert.equal(allowed, true, `unexpected published file: ${path}`);
  }

  writeFileSync(
    join(temp, "package.json"),
    JSON.stringify({ name: "boundaryattest-consumer-smoke", private: true, type: "module" }, null, 2),
  );

  run(
    "npm",
    [
      "install",
      tarballPath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
    ],
    temp,
  );

  const apiProbe = `
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  createArtifactAttestationV02,
  verifyArtifactAttestationV02,
} from "boundaryattest";

const keys = generateKeyPairSync("ed25519", {
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const bytes = Buffer.from("consumer-installed artifact\\n", "utf8");
const receipt = createArtifactAttestationV02(bytes, keys.privateKey, {
  actionType: "package.smoke",
  eventId: "package-smoke-event",
  timestamp: "2026-10-29T00:00:00.000Z",
});
assert.deepEqual(
  verifyArtifactAttestationV02(bytes, JSON.stringify(receipt), keys.publicKey).ok,
  true,
);
console.log("public API smoke passed");
`;
  writeFileSync(join(temp, "api-probe.mjs"), apiProbe);
  const apiOutput = run(process.execPath, ["api-probe.mjs"], temp);
  assert.match(apiOutput, /public API smoke passed/);

  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const artifactPath = join(temp, "artifact.bin");
  const privateKeyPath = join(temp, "private.pem");
  const publicKeyPath = join(temp, "public.pem");
  const receiptPath = join(temp, "artifact.receipt.json");
  writeFileSync(artifactPath, Buffer.from("cli-installed artifact\\n", "utf8"));
  writeFileSync(privateKeyPath, privateKey);
  writeFileSync(publicKeyPath, publicKey);

  const binDir = join(temp, "node_modules", ".bin");
  const suffix = process.platform === "win32" ? ".cmd" : "";
  const boundaryattestBin = join(binDir, `boundaryattest${suffix}`);
  const legacyBin = join(binDir, `agentreceipt${suffix}`);
  assert.equal(existsSync(boundaryattestBin), true, "boundaryattest CLI alias missing");
  assert.equal(existsSync(legacyBin), true, "agentreceipt compatibility CLI alias missing");

  const attestOutput = run(
    boundaryattestBin,
    [
      "attest",
      artifactPath,
      "--action-type",
      "package.cli.smoke",
      "--private-key",
      privateKeyPath,
      "--output",
      receiptPath,
    ],
    temp,
  );
  assert.match(attestOutput, /BoundaryAttest v0\.2 artifact receipt created/);

  const verifyOutput = run(
    boundaryattestBin,
    ["verify-artifact", artifactPath, receiptPath, "--public-key", publicKeyPath],
    temp,
  );
  assert.match(verifyOutput, /PASS: BoundaryAttest v0\.2 artifact receipt verified/);
  assert.match(verifyOutput, /Not proven:/);

  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(receipt.claim.action_type, "package.cli.smoke");

  console.log(
    `Package smoke passed: ${basename(tarballPath)} installed, public API imported, and CLI attested/verified exact bytes.`,
  );
} finally {
  if (tarballPath && existsSync(tarballPath)) rmSync(tarballPath, { force: true });
  rmSync(temp, { recursive: true, force: true });
}
