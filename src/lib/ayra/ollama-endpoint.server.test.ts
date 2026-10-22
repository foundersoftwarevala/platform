// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveAyraOllamaEndpoint } from "./ollama-endpoint.server";

describe("resolveAyraOllamaEndpoint", () => {
  it("uses the local endpoint by default", () => {
    expect(
      resolveAyraOllamaEndpoint(undefined, "http://127.0.0.1:11434/v1/chat/completions"),
    ).toEqual({
      url: "http://127.0.0.1:11434/v1/chat/completions",
      headers: {},
    });
  });

  it("allows HTTP only on loopback or private VPN addresses", () => {
    expect(
      resolveAyraOllamaEndpoint("http://10.8.0.4:11434", "http://127.0.0.1:11434/chat"),
    ).toEqual({
      url: "http://10.8.0.4:11434/v1/chat/completions",
      headers: {},
    });
  });

  it("requires Cloudflare Access credentials for remote HTTPS and attaches them", () => {
    expect(() =>
      resolveAyraOllamaEndpoint("https://ollama.example.com", "http://127.0.0.1:11434/chat"),
    ).toThrow(/Cloudflare Access client credentials/);

    expect(
      resolveAyraOllamaEndpoint(
        "https://ollama.example.com/ollama/",
        "http://127.0.0.1:11434/chat",
        "access-id",
        "access-secret",
      ),
    ).toEqual({
      url: "https://ollama.example.com/ollama/v1/chat/completions",
      headers: {
        "CF-Access-Client-Id": "access-id",
        "CF-Access-Client-Secret": "access-secret",
      },
    });
  });

  it("rejects public HTTP, URL credentials, queries, fragments, and incomplete Access config", () => {
    for (const url of [
      "http://ollama.example.com",
      "https://user:password@ollama.example.com",
      "https://ollama.example.com?token=secret",
      "https://ollama.example.com/#fragment",
    ]) {
      expect(() =>
        resolveAyraOllamaEndpoint(url, "http://127.0.0.1:11434/chat", "id", "secret"),
      ).toThrow();
    }

    expect(() =>
      resolveAyraOllamaEndpoint("https://ollama.example.com", "http://127.0.0.1:11434/chat", "id"),
    ).toThrow(/both AYRA_OLLAMA_ACCESS_CLIENT_ID/);
  });
});
