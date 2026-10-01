#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { interopV02PublicKeyId, signInteropV02Claim } from "../interop-v0.2/verify-receipt.js";

export const SLICC_REPOSITORY = "ai-ecoverse/slicc";
export const SLICC_COMMIT = "59672ceaad7701cd56ec32b805bdd0b9d15ac1c4";
export const TRANSCRIPT_EXPORT_DOC = "docs/transcript-export.md";
export const APPROVALS_DOC = "docs/approvals.md";
export const ARTIFACT_FILENAME = "slicc-2026-09-30-boundaryattest-fixture-7a11c0ff.zip";

const fixtureDir = resolve("examples", "slicc-transcript-export-v0.2");
const artifactPath = resolve(fixtureDir, "artifact", ARTIFACT_FILENAME);
const privateKeyPath = resolve(fixtureDir, "test-only-boundaryattest-private-key.pem");
const publicKeyPath = resolve(fixtureDir, "boundaryattest-public-key.pem");

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createSyntheticTranscript(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    export: {
      id: "7a11c0ff-5e4d-4c3b-9a28-000000000001",
      generatedAt: "2026-09-30T12:00:00.000Z",
      producer: { application: "slicc", version: "0.0.0-boundaryattest-fixture" },
      format: "slicc-transcript",
    },
    session: {
      id: "synthetic-session-boundaryattest-001",
      title: "Synthetic BoundaryAttest transcript export fixture",
      state: "active",
      createdAt: "2026-09-30T11:59:00.000Z",
      updatedAt: "2026-09-30T12:00:00.000Z",
      completeness: { status: "complete", missing: [] },
    },
    privacy: {
      reasoningExcluded: true,
      excludedReasoningBlocks: 0,
      binaryAttachments: "included-unchanged",
      redactionCounts: {},
      redactions: [],
    },
    conversations: [{
      id: "synthetic-session-boundaryattest-001",
      kind: "cone",
      name: "Synthetic cone",
      createdAt: "2026-09-30T11:59:00.000Z",
      updatedAt: "2026-09-30T12:00:00.000Z",
      messages: [{
        id: "synthetic-message-001",
        sequence: 1,
        role: "user",
        timestamp: "2026-09-30T11:59:30.000Z",
        content: [{ type: "text", text: "Synthetic fixture content; no real user or private data." }],
      }],
    }],
    delegations: [],
    attachments: [],
  };
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createDeterministicZip(): Buffer {
  const name = Buffer.from("transcript.json", "utf8");
  const data = Buffer.from(`${JSON.stringify(createSyntheticTranscript(), null, 2)}\n`, "utf8");
  const checksum = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0x0021, 12); // 1980-01-01 00:00:00, the DOS epoch.
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x0021, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}

export function createBoundaryAttestClaim(artifactBytes: Buffer): Record<string, unknown> {
  return {
    receipt_version: "0.2",
    receipt_role: "server_attested",
    event_id: "slicc-transcript-export-handoff-synthetic-7a11c0ff",
    timestamp: "2026-09-30T12:00:01.000Z",
    action_type: "slicc.transcript_export_handoff",
    status: "exported",
    slicc_export: {
      source: {
        repository: SLICC_REPOSITORY,
        commit: SLICC_COMMIT,
        transcript_export_doc: TRANSCRIPT_EXPORT_DOC,
        approvals_doc: APPROVALS_DOC,
      },
      artifact: {
        filename: ARTIFACT_FILENAME,
        media_type: "application/zip",
        representation: "raw_bytes",
        byte_length: artifactBytes.length,
        sha256: sha256Hex(artifactBytes),
      },
      export_context: {
        export_id: "7a11c0ff-5e4d-4c3b-9a28-000000000001",
        session_ref: "synthetic-session-boundaryattest-001",
        format: "slicc-transcript",
        schema_version: 1,
      },
      approval_context: {
        gate_kind: "export",
        scenario_decision: "allow_once",
        portable_native_approval_reference: "unavailable",
        provenance: "synthetic_fixture_context",
      },
      adapter: {
        identity: "boundaryattest-synthetic-slicc-export-adapter",
        scope: "attest exact synthetic transcript ZIP bytes and selected export context only",
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
  const receipt = {
    claim,
    signature: signInteropV02Claim(claim, privateKey),
    public_key_id: interopV02PublicKeyId(publicKey),
  };
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
  console.log("Generated deterministic synthetic SLICC transcript-export fixture.");
}
