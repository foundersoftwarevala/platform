import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withVpsPublicDatabase: vi.fn(),
  resolveVpsAiTarget: vi.fn(),
  recordVpsAiUsage: vi.fn(),
}));

vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsPublicDatabase,
}));
vi.mock("@/lib/ai-manager-vps.server", () => ({
  resolveVpsAiTarget: mocks.resolveVpsAiTarget,
  recordVpsAiUsage: mocks.recordVpsAiUsage,
}));

import { streamLocalAyraChat } from "./ayra-chat.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("local AYRA chat transport", () => {
  beforeEach(() => {
    mocks.withVpsPublicDatabase.mockImplementation((run) => run({}));
    mocks.resolveVpsAiTarget.mockResolvedValue({
      serviceId: "00000000-0000-4000-8000-000000000001",
      serviceName: "Ollama Local",
      providerSlug: "ollama-local",
      endpoint: "http://127.0.0.1:11434/v1/chat/completions",
      credential: null,
      modelId: "qwen2.5:3b",
      modelRowId: "00000000-0000-4000-8000-000000000002",
      inputCostPer1k: 0,
      outputCostPer1k: 0,
      isLocalOllama: true,
      isAnthropic: false,
    });
    mocks.recordVpsAiUsage.mockResolvedValue(undefined);
  });

  it("streams local Ollama chunks as the existing client SSE format", async () => {
    vi.stubEnv("AYRA_CHAT_MODEL", "qwen2.5:3b");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          '{"message":{"content":"Hello"},"done":false}\n{"message":{"content":" Boss"},"prompt_eval_count":17,"eval_count":3,"done":true}\n',
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
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://127.0.0.1:11434/api/chat");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "qwen2.5:3b",
      stream: true,
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(response.headers.get("x-ayra-memory-status")).toBe("ready");
    expect(body).toContain('"content":"Hello"');
    expect(body).toContain('"content":" Boss"');
    expect(body.endsWith("data: [DONE]\n\n")).toBe(true);
    expect(mocks.resolveVpsAiTarget).toHaveBeenCalledWith({}, "Ollama Local", "qwen2.5:3b");
    expect(mocks.recordVpsAiUsage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ serviceName: "Ollama Local" }),
      expect.objectContaining({
        product: "ayra-chat",
        source: "ayra-chat",
        statusCode: 200,
        success: true,
        tokensIn: 17,
        tokensOut: 3,
      }),
    );
  });

  it("refuses non-local registered providers before making a network request", async () => {
    mocks.resolveVpsAiTarget.mockResolvedValueOnce({
      isLocalOllama: false,
      endpoint: "https://example.com/v1/chat/completions",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamLocalAyraChat({
        messages: [{ role: "user", content: "Hi" }],
        memoryStatus: "not_configured",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("restricted to the approved local Ollama service");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports Ollama stream errors in the established SSE error event", async () => {
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
    expect(mocks.recordVpsAiUsage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ serviceName: "Ollama Local" }),
      expect.objectContaining({ success: false, statusCode: 200 }),
    );
  });
});
