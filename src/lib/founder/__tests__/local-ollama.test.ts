import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateLocalJson } from "../local-ollama.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("local Ollama JSON client", () => {
  it("sends structured requests to a private Ollama endpoint and validates its response", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
    vi.stubEnv("OLLAMA_MODEL", "test-local-model");
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: '{"ok":true}' } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", request);

    const result = await generateLocalJson({
      system: "Use the test contract.",
      prompt: "Return ok.",
      schema: z.object({ ok: z.boolean() }).strict(),
    });

    expect(result).toEqual({ model: "test-local-model", value: { ok: true } });
    expect(request).toHaveBeenCalledOnce();
    const init = request.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "test-local-model",
      stream: false,
      format: "json",
    });
  });

  it("refuses public Ollama URLs rather than allowing outbound model calls", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "https://example.com");
    await expect(
      generateLocalJson({ system: "s", prompt: "p", schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toThrow(/localhost or a private host/i);
  });

  it("surfaces response-contract errors rather than returning an unchecked object", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: '{"ok":"yes"}' } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", request);
    await expect(
      generateLocalJson({ system: "s", prompt: "p", schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toThrow(/required contract/i);
  });
});
