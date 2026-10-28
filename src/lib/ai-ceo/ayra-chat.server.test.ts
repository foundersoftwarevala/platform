import { afterEach, describe, expect, it, vi } from "vitest";

import { streamLocalAyraChat } from "./ayra-chat.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("local AYRA chat transport", () => {
  it("streams local Ollama chunks as the existing client SSE format", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
    vi.stubEnv("AYRA_CHAT_MODEL", "qwen2.5:3b");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          '{"message":{"content":"Hello"},"done":false}\n{"message":{"content":" Boss"},"done":true}\n',
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await streamLocalAyraChat({
      messages: [{ role: "user", content: "Hi" }],
      memoryStatus: "ready",
      signal: new AbortController().signal,
    });
    const body = await response.text();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:11434/api/chat");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "qwen2.5:3b",
      stream: true,
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(response.headers.get("x-ayra-memory-status")).toBe("ready");
    expect(body).toContain('"content":"Hello"');
    expect(body).toContain('"content":" Boss"');
    expect(body.endsWith("data: [DONE]\n\n")).toBe(true);
  });

  it("refuses a public Ollama endpoint before making a network request", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "https://example.com");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamLocalAyraChat({
        messages: [{ role: "user", content: "Hi" }],
        memoryStatus: "not_configured",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("requires a local Ollama endpoint");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports Ollama stream errors in the established SSE error event", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"error":"model unavailable"}\n', { status: 200 })),
    );

    const response = await streamLocalAyraChat({
      messages: [{ role: "user", content: "Hi" }],
      memoryStatus: "unavailable",
      signal: new AbortController().signal,
    });
    const body = await response.text();
    expect(body).toContain('"type":"error"');
    expect(body).toContain("model unavailable");
    expect(body.endsWith("data: [DONE]\n\n")).toBe(true);
  });
});
