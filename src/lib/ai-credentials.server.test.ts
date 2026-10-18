import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decryptAiCredential,
  encryptAiCredential,
  isEncryptedAiCredential,
  readStoredCredential,
} from "@/lib/ai-credentials.server";

const testKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

beforeEach(() => {
  vi.stubEnv("AI_API_CREDENTIAL_ENCRYPTION_KEY", testKey);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stored credential encryption", () => {
  it("encrypts secrets with authenticated encryption and reads them back", () => {
    const encrypted = encryptAiCredential("seo-api-secret");

    expect(isEncryptedAiCredential(encrypted)).toBe(true);
    expect(encrypted).not.toContain("seo-api-secret");
    expect(decryptAiCredential(encrypted)).toBe("seo-api-secret");
    expect(readStoredCredential(encrypted)).toBe("seo-api-secret");
  });

  it("rejects a modified ciphertext", () => {
    const encrypted = encryptAiCredential("seo-api-secret");
    const [iv, tag, ciphertext] = encrypted.slice("enc:v1:".length).split(".");
    const replacement = tag![0] === "A" ? "B" : "A";

    expect(() =>
      decryptAiCredential(`enc:v1:${iv}.${replacement}${tag!.slice(1)}.${ciphertext}`),
    ).toThrow();
  });

  it("reads historical base64 and plaintext values for migration", () => {
    expect(readStoredCredential(Buffer.from("legacy-secret").toString("base64"))).toBe(
      "legacy-secret",
    );
    expect(readStoredCredential("provider-plain-secret")).toBe("provider-plain-secret");
  });

  it("fails closed when no encryption key is configured", () => {
    vi.stubEnv("AI_API_CREDENTIAL_ENCRYPTION_KEY", "");

    expect(() => encryptAiCredential("seo-api-secret")).toThrow(
      "AI_API_CREDENTIAL_ENCRYPTION_KEY is not configured",
    );
  });
});
