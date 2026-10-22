import { describe, expect, it } from "vitest";

import { assertManagedProviderEndpoint } from "./managed-api-endpoints.server";

describe("managed AI provider endpoints", () => {
  it("allows the OpenRouter chat-completions endpoint over HTTPS", () => {
    expect(
      assertManagedProviderEndpoint("https://openrouter.ai/api/v1/chat/completions").toString(),
    ).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("rejects unregistered hosts and insecure OpenRouter URLs", () => {
    expect(() =>
      assertManagedProviderEndpoint("https://openrouter.example/v1/chat/completions"),
    ).toThrow("not allowlisted");
    expect(() =>
      assertManagedProviderEndpoint("http://openrouter.ai/api/v1/chat/completions"),
    ).toThrow("not allowlisted");
  });
});
