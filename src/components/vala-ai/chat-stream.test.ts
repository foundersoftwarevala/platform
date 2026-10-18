import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

import { ChatRequestError, deltaFromEvent, streamChat } from "./chat-stream";

function sse(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("deltaFromEvent", () => {
  it("reads OpenAI-compatible deltas", () => {
    expect(deltaFromEvent({ choices: [{ delta: { content: "Hi" } }] })).toBe("Hi");
  });
  it("reads Anthropic text deltas and ignores the other events", () => {
    expect(
      deltaFromEvent({ type: "content_block_delta", delta: { type: "text_delta", text: "Yo" } }),
    ).toBe("Yo");
    expect(deltaFromEvent({ type: "message_start", message: {} })).toBe("");
    expect(deltaFromEvent({ type: "ping" })).toBe("");
  });
  it("turns a provider error event into an error", () => {
    expect(() => deltaFromEvent({ type: "error", error: { message: "overloaded" } })).toThrow(
      ChatRequestError,
    );
  });
});

describe("streamChat", () => {
  it("sends the bearer token to /api/chat and joins an Anthropic stream split across chunks", async () => {
    const fetchMock = vi.fn(async () =>
      sse([
        'event: content_block_delta\r\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\r\n\r\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_d',
        'elta","text":"lo"}}\n\ndata: {"type":"message_stop"}\n',
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const seen: string[] = [];
    const full = await streamChat([{ role: "user", content: "hi" }], {
      onDelta: (t) => seen.push(t),
    });
    expect(full).toBe("Hello");
    expect(seen).toEqual(["Hel", "Hello"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/chat");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    vi.unstubAllGlobals();
  });

  it("reports the route's refusal with its status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("AI routing permission required.", { status: 401 })),
    );
    await expect(streamChat([{ role: "user", content: "hi" }])).rejects.toMatchObject({
      status: 401,
    });
    vi.unstubAllGlobals();
  });
});
