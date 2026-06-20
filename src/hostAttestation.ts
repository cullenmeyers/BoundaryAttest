import { createHash, createPublicKey, verify } from "node:crypto";

export const HOST_ATTESTATION_CONTEXT = "boundaryattest.host-attestation.v1";
export const HOST_ATTESTATION_ENVELOPE_SCHEMA_ID = "host_attestation_envelope.v1";
export const ED25519_SIGNATURE_ALGORITHM = "Ed25519";

const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const ENVELOPE_FIELDS = new Set([
  "schema_id",
  "context",
  "payload_schema_id",
  "signed_payload_hash",
  "signature_algorithm",
  "public_key_id",
  "signed_at",
  "signature",
]);

type JsonObject = Record<string, unknown>;

export type HostAttestationEnvelope = {
  schema_id: string;
  context: string;
  payload_schema_id: string;
  signed_payload_hash: string;
  signature_algorithm: string;
  public_key_id: string;
  signed_at: string;
  signature: string;
};

export type HostAttestationStatement = Omit<HostAttestationEnvelope, "schema_id" | "signature">;

export type HostAttestationVerification = {
  valid: true;
  publicKeyId: string;
  signatureAlgorithm: string;
  signedAt: string;
  signedPayloadHash: string;
};

export type HostAttestationPublicKeys = Readonly<Record<string, string>>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareUnicode(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0) as number);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0) as number);
  const length = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) {
      return leftPoints[index] - rightPoints[index];
    }
  }

  return leftPoints.length - rightPoints.length;
}

function pythonJsonString(value: string): string {
  return JSON.stringify(value).replace(/[\u0080-\uffff]/g, (codeUnit) => {
    return `\\u${codeUnit.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

/** Canonical JSON compatible with Intergrax's sorted, compact Python JSON output. */
export function canonicalHostAttestationJson(value: unknown): string {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    const encoded = typeof value === "string" ? pythonJsonString(value) : JSON.stringify(value);
    if (encoded === undefined) {
      throw new Error("Host attestation payload contains a value that cannot be serialized as JSON");
    }
    return encoded;
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalHostAttestationJson).join(",")}]`;
  }

  const entries = Object.entries(value as JsonObject)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => compareUnicode(left, right));

  return `{${entries
    .map(([key, entryValue]) => `${pythonJsonString(key)}:${canonicalHostAttestationJson(entryValue)}`)
    .join(",")}}`;
}

export function unsignedHostAttestationPayload(event: JsonObject): JsonObject {
  const { host_attestation: _hostAttestation, ...unsignedEvent } = event;
  return { ...unsignedEvent, signed: false };
}

export function computeHostAttestationPayloadHash(event: JsonObject): string {
  const canonicalEvent = canonicalHostAttestationJson(unsignedHostAttestationPayload(event));
  return `sha256:${createHash("sha256").update(canonicalEvent, "utf8").digest("hex")}`;
}

function requireEnvelopeString(envelope: JsonObject, field: string): string {
  const value = envelope[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Malformed host-attestation envelope: ${field} must be a non-empty string`);
  }
  return value;
}

export function parseHostAttestationEnvelope(value: unknown): HostAttestationEnvelope {
  if (!isObject(value)) {
    throw new Error("Malformed host-attestation envelope: expected an object");
  }

  const unexpected = Object.keys(value).filter((field) => !ENVELOPE_FIELDS.has(field));
  const missing = [...ENVELOPE_FIELDS].filter((field) => !(field in value));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Malformed host-attestation envelope: expected exact v1 fields` +
        `${missing.length > 0 ? `; missing ${missing.join(", ")}` : ""}` +
        `${unexpected.length > 0 ? `; unexpected ${unexpected.join(", ")}` : ""}`,
    );
  }

  const envelope: HostAttestationEnvelope = {
    schema_id: requireEnvelopeString(value, "schema_id"),
    context: requireEnvelopeString(value, "context"),
    payload_schema_id: requireEnvelopeString(value, "payload_schema_id"),
    signed_payload_hash: requireEnvelopeString(value, "signed_payload_hash"),
    signature_algorithm: requireEnvelopeString(value, "signature_algorithm"),
    public_key_id: requireEnvelopeString(value, "public_key_id"),
    signed_at: requireEnvelopeString(value, "signed_at"),
    signature: requireEnvelopeString(value, "signature"),
  };

  if (envelope.schema_id !== HOST_ATTESTATION_ENVELOPE_SCHEMA_ID) {
    throw new Error(`Malformed host-attestation envelope: unsupported schema_id ${envelope.schema_id}`);
  }
  if (envelope.context !== HOST_ATTESTATION_CONTEXT) {
    throw new Error(`Malformed host-attestation envelope: unsupported context ${envelope.context}`);
  }
  if (!SHA256_DIGEST.test(envelope.signed_payload_hash)) {
    throw new Error("Malformed host-attestation envelope: signed_payload_hash must be sha256:<64 lowercase hex>");
  }

  return envelope;
}

export function hostAttestationStatement(envelope: HostAttestationEnvelope): HostAttestationStatement {
  return {
    context: envelope.context,
    payload_schema_id: envelope.payload_schema_id,
    signed_payload_hash: envelope.signed_payload_hash,
    signature_algorithm: envelope.signature_algorithm,
    public_key_id: envelope.public_key_id,
    signed_at: envelope.signed_at,
  };
}

function decodeBase64(value: string, field: string, expectedLength: number): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== expectedLength || decoded.toString("base64") !== value) {
    throw new Error(`Malformed host-attestation envelope: ${field} must be canonical base64 for ${expectedLength} bytes`);
  }
  return decoded;
}

export function verifyHostAttestation(
  event: JsonObject,
  envelopeValue: unknown,
  publicKeys: HostAttestationPublicKeys,
): HostAttestationVerification {
  const envelope = parseHostAttestationEnvelope(envelopeValue);
  if (envelope.signature_algorithm !== ED25519_SIGNATURE_ALGORITHM) {
    throw new Error(`Unsupported host-attestation signature_algorithm: ${envelope.signature_algorithm}`);
  }

  if (!Object.prototype.hasOwnProperty.call(publicKeys, envelope.public_key_id)) {
    throw new Error(`Unknown host-attestation public_key_id: ${envelope.public_key_id}`);
  }
  const publicKeyBase64 = publicKeys[envelope.public_key_id];

  const eventSchemaId = event.schema_id;
  if (typeof eventSchemaId !== "string" || envelope.payload_schema_id !== eventSchemaId) {
    throw new Error("Host-attestation payload_schema_id does not match the event schema_id");
  }

  const computedHash = computeHostAttestationPayloadHash(event);
  if (computedHash !== envelope.signed_payload_hash) {
    throw new Error("Host-attestation signed_payload_hash does not match canonical event digest");
  }

  const publicKeyBytes = decodeBase64(publicKeyBase64, "public key", 32);
  const signatureBytes = decodeBase64(envelope.signature, "signature", 64);
  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBytes]),
    format: "der",
    type: "spki",
  });
  const statementBytes = Buffer.from(canonicalHostAttestationJson(hostAttestationStatement(envelope)), "utf8");

  if (!verify(null, statementBytes, publicKey, signatureBytes)) {
    throw new Error("Invalid host-attestation signature");
  }

  return {
    valid: true,
    publicKeyId: envelope.public_key_id,
    signatureAlgorithm: envelope.signature_algorithm,
    signedAt: envelope.signed_at,
    signedPayloadHash: envelope.signed_payload_hash,
  };
}
