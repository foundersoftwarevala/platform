import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const configured = process.env.AI_API_CREDENTIAL_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("AI_API_CREDENTIAL_ENCRYPTION_KEY is not configured on the server");
  }

  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("AI_API_CREDENTIAL_ENCRYPTION_KEY must be a 32-byte hex or base64 key");
  }
  return key;
}

export function encryptAiCredential(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptAiCredential(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const [ivValue, tagValue, ciphertextValue] = value.slice(PREFIX.length).split(".");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored AI credential has an invalid encrypted format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function credentialFingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
