// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { handleApi } from "./api.server";
import type { Operator } from "./auth.server";
import { all, closeDb } from "./db.server";
import { updateSettings } from "./settings.server";
import { jarvisChat, jarvisHealth, jarvisSpeak, jarvisTranscribe } from "./jarvis.server";

const root = mkdtempSync(join(tmpdir(), "vala-jarvis-test-"));
const previous = process.env.VALA_AI_DATA_DIR;
const previousWorker = process.env.VALA_AI_WORKER;
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";
const owner: Operator = {
  id: "jarvis-owner",
  email: "owner@test.local",
  name: "Owner",
  role: "boss",
};
const operator: Operator = { ...owner, id: "jarvis-operator", role: "operator" };
const viewer: Operator = { ...owner, id: "jarvis-viewer", role: "viewer" };
const reply = {
  text: "Open the Control Panel using its existing link.",
  model: "qwen2.5:7b",
  source: "local",
  service: null,
  durationMs: 42,
  tokensIn: 20,
  tokensOut: 10,
};
const post = (who: Operator | null, body: object = { transcript: "Open dashboard" }) =>
  handleApi(
    new Request("http://localhost/api/vala-ai/voice/transcribe", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    async () => who,
  );

beforeAll(() => updateSettings({ chat_per_minute: 600 }, owner.id));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(() => {
  closeDb();
  if (previous === undefined) delete process.env.VALA_AI_DATA_DIR;
  else process.env.VALA_AI_DATA_DIR = previous;
  if (previousWorker === undefined) delete process.env.VALA_AI_WORKER;
  else process.env.VALA_AI_WORKER = previousWorker;
  rmSync(root, { recursive: true, force: true });
});

describe("authenticated voice API and existing Chat persistence", () => {
  it("accepts explicit local liveness without inventing model readiness", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "ok",
          service: "jarvis",
          port: 3003,
          health: "liveness",
          modelBridge: { url: "http://127.0.0.1:5200", status: "not_checked" },
          transcription: {
            engine: "whisper",
            model: "onnx-community/whisper-tiny",
            device: "cpu",
            status: "not_loaded",
          },
        }),
      ),
    );
    expect(await jarvisHealth()).toEqual({
      status: "ok",
      service: "jarvis",
      port: 3003,
      health: "liveness",
      modelBridge: { url: "http://127.0.0.1:5200", status: "not_checked" },
      transcription: {
        engine: "whisper",
        model: "onnx-community/whisper-tiny",
        device: "cpu",
        status: "not_loaded",
      },
    });
  });

  it.each([owner, operator])(
    "connects configured typed Chat through Jarvis for $role",
    async (who) => {
      vi.stubEnv("VITE_JARVIS_URL", "http://127.0.0.1:3003");
      const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(String(init.body));
        return Response.json({
          transcript: sent.transcript,
          transcription: "local-whisper",
          reply,
        });
      });
      vi.stubGlobal("fetch", fetcher);
      const response = await handleApi(
        new Request("http://localhost/api/vala-ai/chat", {
          method: "POST",
          body: JSON.stringify({ text: "Hello" }),
        }),
        async () => who,
      );
      expect(response.status).toBe(200);
      expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:3003/chat");
      expect((await response.json()).reply).toMatchObject({
        role: "assistant",
        content: reply.text,
        operator_id: who.id,
      });
    },
  );

  it.each([null, viewer])(
    "keeps configured Chat authorization before any Jarvis request",
    async (who) => {
      vi.stubEnv("VITE_JARVIS_URL", "http://127.0.0.1:3003");
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      const response = await handleApi(
        new Request("http://localhost/api/vala-ai/chat", {
          method: "POST",
          body: JSON.stringify({ text: "Hello" }),
        }),
        async () => who,
      );
      expect(response.status).toBe(who ? 403 : 401);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("connects the local transcription result to the existing voice endpoint", async () => {
    vi.stubEnv("VITE_JARVIS_URL", "http://127.0.0.1:3003");
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      return Response.json({
        transcript: sent.transcript,
        transcription: "local-whisper",
        reply,
      });
    });
    vi.stubGlobal("fetch", fetcher);
    expect((await post(owner, { transcript: "Hello Jarvis" })).status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:3003/voice");
  });

  it("forwards authenticated bounded multipart audio to loopback Whisper without JSON encoding", async () => {
    vi.stubEnv("VITE_JARVIS_URL", "http://127.0.0.1:3003");
    const fetcher = vi.fn(async (_url: string, init: RequestInit) =>
      Response.json({ text: "Hello Jarvis" }),
    );
    vi.stubGlobal("fetch", fetcher);
    const form = new FormData();
    form.append("audio", new Blob(["audio fixture"], { type: "audio/webm" }), "recording.webm");
    const response = await handleApi(
      new Request("http://localhost/api/vala-ai/voice/transcribe-audio", {
        method: "POST",
        body: form,
      }),
      async () => operator,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Hello Jarvis" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:3003/api/transcribe");
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
    expect(fetcher.mock.calls[0][1].body).toBeInstanceOf(FormData);
  });

  it("refuses to forward microphone audio to a non-loopback endpoint", async () => {
    vi.stubEnv("VITE_JARVIS_URL", "https://transcription.example");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      jarvisTranscribe(new Blob(["audio"], { type: "audio/webm" })),
    ).rejects.toMatchObject({
      status: 500,
      message: "VITE_JARVIS_URL must point to HTTP loopback port 3003 only.",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([null, viewer])(
    "refuses unauthenticated or view-only multipart audio before reading it",
    async (who) => {
      vi.stubEnv("VITE_JARVIS_URL", "http://127.0.0.1:3003");
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      const form = new FormData();
      form.append("audio", new Blob(["audio fixture"], { type: "audio/webm" }), "recording.webm");
      const req = new Request("http://localhost/api/vala-ai/voice/transcribe-audio", {
        method: "POST",
        body: form,
      });
      const response = await handleApi(req, async () => who);
      expect(response.status).toBe(who ? 403 : 401);
      expect(req.bodyUsed).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid multipart audio type before forwarding", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const form = new FormData();
    form.append("audio", new Blob(["not audio"], { type: "text/plain" }), "recording.txt");
    const response = await handleApi(
      new Request("http://localhost/api/vala-ai/voice/transcribe-audio", {
        method: "POST",
        body: form,
      }),
      async () => operator,
    );
    expect(response.status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([null, viewer])(
    "refuses missing/view-only callers before contacting Jarvis",
    async (who) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect((await post(who)).status).toBe(who ? 403 : 401);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([owner, operator])(
    "preserves real Chat attribution and history for $role",
    async (who) => {
      const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(String(init.body));
        expect(sent.messages.at(-1)).toEqual({ role: "user", content: "Open dashboard" });
        return Response.json({
          transcript: sent.transcript,
          transcription: "local-whisper",
          reply,
        });
      });
      vi.stubGlobal("fetch", fetcher);
      const response = await post(who);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.reply).toMatchObject({
        role: "assistant",
        content: reply.text,
        operator_id: who.id,
        duration_ms: 42,
      });
      expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:3003/voice/transcribe");
      expect(
        all<{ n: number }>(
          "select count(*) as n from chat_messages where id in (?,?)",
          body.user.id,
          body.reply.id,
        )[0].n,
      ).toBe(2);
    },
  );

  it("makes relay failures explicit and preserves an error row, not a fake assistant reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Bridge unavailable" }, { status: 503 })),
    );
    const response = await post(owner, { transcript: "failure acceptance fixture" });
    expect(response.status).toBe(502);
    expect((await response.json()).error).toMatch(/Bridge unavailable/);
    expect(
      all<{ role: string }>(
        "select role from chat_messages where content = ?",
        "Bridge unavailable",
      ),
    ).toEqual([{ role: "error" }]);
  });

  it("rejects empty transcript before any relay call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await post(owner, { transcript: "" })).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("validates health and playback metadata instead of reporting a false success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
    await expect(jarvisHealth()).rejects.toMatchObject({ status: 502 });
    await expect(jarvisSpeak("hello")).rejects.toMatchObject({ status: 502 });
    await expect(jarvisChat([{ role: "user", content: "hello" }])).rejects.toMatchObject({
      status: 502,
    });
  });

  it("requires the returned transcript to match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          transcript: "wrong",
          transcription: "local-whisper",
          reply,
        }),
      ),
    );
    await expect(jarvisChat([{ role: "user", content: "hello" }])).rejects.toMatchObject({
      status: 502,
    });
  });
});
