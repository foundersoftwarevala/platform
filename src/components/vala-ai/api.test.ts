import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

vi.mock("@/lib/auth/operator-fetch", () => ({
  authHeaders: vi.fn(async () => ({ authorization: "Bearer test-session" })),
}));

afterEach(() => vi.unstubAllGlobals());

describe("authenticated Vala AI API client", () => {
  it("passes multipart audio through without overriding the browser boundary", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init: RequestInit) =>
      Response.json({ text: "Hello Jarvis" }),
    );
    vi.stubGlobal("fetch", fetcher);
    const form = new FormData();
    form.append("audio", new Blob(["recorded bytes"], { type: "audio/webm" }), "recording.webm");

    await expect(
      api<{ text: string }>("/voice/transcribe-audio", { method: "POST", body: form }),
    ).resolves.toEqual({ text: "Hello Jarvis" });
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error("The authenticated fetch was not called.");
    const [url, init] = call;
    expect(url).toBe("/api/vala-ai/voice/transcribe-audio");
    expect(init.body).toBe(form);
    expect(init.headers).toEqual({ authorization: "Bearer test-session" });
    expect(init.headers).not.toHaveProperty("content-type");
  });

  it("retains JSON request behavior for existing API calls", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init: RequestInit) =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetcher);

    await api("/chat", { method: "POST", body: { text: "Hello" } });
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error("The authenticated fetch was not called.");
    expect(call[1].headers).toEqual({
      authorization: "Bearer test-session",
      "content-type": "application/json",
    });
    expect(call[1].body).toBe(JSON.stringify({ text: "Hello" }));
  });
});
