#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { interopV02PublicKeyId, signInteropV02Claim } from "../interop-v0.2/verify-receipt.js";

export const SHIPFRAME_REPOSITORY = "juanitourquiza/shipframe";
export const SHIPFRAME_COMMIT = "1cd40df17baacb164ed693acf640bf7e372d194c";
export const DEPLOY_EVIDENCE_DOC = "skills/deploy-evidence/SKILL.md";
export const EVIDENCE_AUDIT_DOC = "skills/evidence-audit/SKILL.md";
export const PROOF_RUNNER_DOC = "skills/proof-runner/SKILL.md";
export const ARTIFACT_FILENAME = "shipframe-release-package.zip";

const fixtureDir = resolve("examples", "shipframe-release-handoff-v0.2");
const artifactPath = resolve(fixtureDir, "package", ARTIFACT_FILENAME);
const privateKeyPath = resolve(fixtureDir, "test-only-boundaryattest-private-key.pem");
const publicKeyPath = resolve(fixtureDir, "boundaryattest-public-key.pem");

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createSyntheticReleaseReport(): string {
  return `# Synthetic ShipFrame-style release evidence report

> SYNTHETIC FIXTURE: No commands ran. ShipFrame did not generate this report. This is only a native-style synthetic artifact.

Environment: staging
Commit/tag/version checked: synthetic-release-2026-10-14
Timestamp: 2026-10-14T12:00:00.000Z (fixed synthetic, signer-asserted only)

Evidence collected:
- CI job for synthetic commit passed
- staging version endpoint reported synthetic-release-2026-10-14

Smoke checks:
- homepage synthetic smoke: PASS
- /health synthetic smoke: PASS

Gaps:
- provider-side production evidence not included

Verdict:
Complete for the stated synthetic staging scope only

This synthetic verdict is fixture content, not a BoundaryAttest judgment. ShipFrame remains authoritative for release/deploy evidence validity.
`;
}

export function createSyntheticEvidenceManifest(): string {
  return `${JSON.stringify({
    manifest_version: "synthetic-1",
    provenance: "synthetic_fixture_context",
    release_ref: "synthetic-release-2026-10-14",
    environment: "staging",
    selected_evidence: [
      { reference: "synthetic://ci/jobs/shipframe-fixture-001", sha256: "1".repeat(64), status: "passed" },
      { reference: "synthetic://staging/version/synthetic-release-2026-10-14", sha256: "2".repeat(64), status: "observed" },
    ],
    notice: "Synthetic references and digests only; no commands ran and no provider systems were queried.",
  }, null, 2)}\n`;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntry(nameText: string, data: Buffer, offset: number): { local: Buffer; central: Buffer } {
  const name = Buffer.from(nameText, "utf8");
  const checksum = crc32(data);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0x0800, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0x0021, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0x0800, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0x0021, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(offset, 42);
  return { local: Buffer.concat([localHeader, name, data]), central: Buffer.concat([centralHeader, name]) };
}

export function createDeterministicZip(overrides: { releaseReport?: string; evidenceManifest?: string } = {}): Buffer {
  const entries = [
    ["release-report.md", Buffer.from(overrides.releaseReport ?? createSyntheticReleaseReport(), "utf8")],
    ["evidence-manifest.json", Buffer.from(overrides.evidenceManifest ?? createSyntheticEvidenceManifest(), "utf8")],
  ] as const;
  let offset = 0;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  for (const [name, data] of entries) {
    const entry = zipEntry(name, data, offset);
    locals.push(entry.local);
    centrals.push(entry.central);
    offset += entry.local.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

export function createBoundaryAttestClaim(artifactBytes: Buffer): Record<string, unknown> {
  return {
    receipt_version: "0.2",
    receipt_role: "server_attested",
    event_id: "shipframe-release-handoff-synthetic-2026-10-14",
    timestamp: "2026-10-14T12:00:01.000Z",
    action_type: "shipframe.release_evidence_handoff",
    status: "exported",
    shipframe_export: {
      source: {
        repository: SHIPFRAME_REPOSITORY,
        commit: SHIPFRAME_COMMIT,
        deploy_evidence_doc: DEPLOY_EVIDENCE_DOC,
        evidence_audit_doc: EVIDENCE_AUDIT_DOC,
        proof_runner_doc: PROOF_RUNNER_DOC,
      },
      artifact: {
        filename: ARTIFACT_FILENAME,
        media_type: "application/zip",
        representation: "raw_bytes",
        byte_length: artifactBytes.length,
        sha256: sha256Hex(artifactBytes),
      },
      export_context: {
        synthetic_release_ref: "synthetic-release-2026-10-14",
        environment: "staging",
        selected_evidence_count: 2,
        provenance: "synthetic_fixture_context",
      },
      time_semantics: { timestamp_kind: "signer_asserted", independently_witnessed: false },
      adapter: {
        identity: "boundaryattest-synthetic-shipframe-release-handoff-adapter",
        scope: "attest exact synthetic release-evidence ZIP bytes and selected context only",
      },
    },
  };
}

export function generateFixture(): void {
  const artifactBytes = createDeterministicZip();
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, artifactBytes);
  const privateKey = readFileSync(privateKeyPath, "utf8");
  const publicKey = readFileSync(publicKeyPath, "utf8");
  const claim = createBoundaryAttestClaim(artifactBytes);
  const receipt = { claim, signature: signInteropV02Claim(claim, privateKey), public_key_id: interopV02PublicKeyId(publicKey) };
  writeFileSync(resolve(fixtureDir, "boundaryattest-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  writeFileSync(resolve(fixtureDir, "expected.json"), `${JSON.stringify({
    artifact_filename: ARTIFACT_FILENAME,
    artifact_byte_length: artifactBytes.length,
    artifact_sha256: sha256Hex(artifactBytes),
    boundaryattest_public_key_id: receipt.public_key_id,
  }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateFixture();
  console.log("Generated deterministic synthetic ShipFrame-style release handoff fixture.");
}
