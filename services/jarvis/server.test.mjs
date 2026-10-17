import { mkdtemp, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createJarvisApp, isDirectExecution } from "./server.mjs";

const servers = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function start(fetcher, options = {}) {
  const server = createJarvisApp({ fetcher, ...options }).listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

function completion(text = "I can explain how to open the dashboard.") {
  return Response.json({
    model: "qwen2.5:7b",
    choices: [{ message: { role: "assistant", content: text } }],
    usage: { prompt_tokens: 20, completion_tokens: 11 },
  });
}

it("recognizes the executable module when launched through a release symlink", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "jarvis-entrypoint-"));
  const target = fileURLToPath(new URL("./server.mjs", import.meta.url));
  const symlinkDirectory = path.join(directory, "current");
  try {
    await symlink(path.dirname(target), symlinkDirectory, "junction");
    expect(
      isDirectExecution(pathToFileURL(target).href, path.join(symlinkDirectory, "server.mjs")),
    ).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function fakeTranscriber(text = "Hello Jarvis") {
  return {
    initialize: vi.fn(),
    transcribe: vi.fn(async (buffer, options) => {
      expect(buffer).toBeInstanceOf(Buffer);
      expect(options.contentType).toBe("audio/webm");
      return text;
    }),
    status: () => ({
      engine: "whisper",
      model: "onnx-community/whisper-tiny",
      device: "cpu",
      status: "ready",
    }),
  };
}

async function post(url, body, headers = { "content-type": "application/json" }) {
  return fetch(`${url}/voice/transcribe`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function postAudio(url, { type = "audio/webm", name = "recording.webm", origin } = {}) {
  const form = new FormData();
  form.append("audio", new Blob(["unit fixture bytes"], { type }), name);
  return fetch(`${url}/api/transcribe`, {
    method: "POST",
    headers: origin ? { origin } : {},
    body: form,
  });
}

describe("loopback Jarvis browser-voice contract", () => {
  it("reports local liveness without claiming the model bridge is ready", async () => {
    const upstream = vi.fn();
    const url = await start(upstream, { checkBridgeHealth: false });
    const response = await fetch(`${url}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "jarvis",
      port: Number(new URL(url).port),
      health: "liveness",
      endpoints: ["GET /health", "POST /api/transcribe", "POST /voice", "POST /chat"],
      modelBridge: { url: "http://127.0.0.1:5200", status: "not_checked" },
      transcription: {
        engine: "whisper",
        model: "onnx-community/whisper-tiny",
        device: "cpu",
        status: "not_loaded",
      },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("retains bridge readiness checks by default", async () => {
    const url = await start(async () => {
      throw new TypeError("connection refused");
    });
    expect((await fetch(`${url}/health`)).status).toBe(503);
  });

  it.each(["/voice", "/chat"])("forwards %s messages through the existing bridge", async (path) => {
    const upstream = vi.fn(async () => completion());
    const url = await start(upstream);
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: " Open dashboard " }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      transcript: "Open dashboard",
      reply: { source: "local", model: "qwen2.5:7b" },
    });
    const [target, init] = upstream.mock.calls[0];
    expect(target).toBe("http://127.0.0.1:5200/v1/chat/completions");
    expect(JSON.parse(init.body).messages.at(-1)).toEqual({
      role: "user",
      content: "Open dashboard",
    });
  });

  it.each(["/voice", "/chat"])("rejects missing %s input before inference", async (path) => {
    const upstream = vi.fn();
    const response = await fetch(`${await start(upstream)}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(["/voice", "/chat"])("reports an unavailable bridge on %s", async (path) => {
    const url = await start(async () => {
      throw new TypeError("connection refused");
    });
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "Hello" }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "The local model bridge is unavailable." });
  });

  it("preserves the legacy transcribe payload contract", async () => {
    const upstream = vi.fn();
    const response = await post(await start(upstream), { message: "Hello" });
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("checks the existing bridge without claiming hardware or model-loaded acceptance", async () => {
    const upstream = vi.fn(async () => Response.json({ status: "ok", model: "qwen2.5:7b" }));
    const url = await start(upstream);
    const response = await fetch(`${url}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      transcription: {
        engine: "whisper",
        model: "onnx-community/whisper-tiny",
        device: "cpu",
        status: "not_loaded",
      },
      speech: "browser-speech-synthesis",
    });
    expect(upstream.mock.calls[0][0]).toBe("http://127.0.0.1:5200/health");
  });

  it("forwards recognized text to 5200 and reports the actual local response", async () => {
    const upstream = vi.fn(async () => completion());
    const response = await post(await start(upstream), { transcript: " Open dashboard " });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      transcript: "Open dashboard",
      reply: { source: "local", model: "qwen2.5:7b", tokensIn: 20, tokensOut: 11 },
    });
    const [target, init] = upstream.mock.calls[0];
    expect(target).toBe("http://127.0.0.1:5200/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "Open dashboard" });
    expect(body.stream).toBe(false);
    expect(body).not.toHaveProperty("model");
    expect(init.headers).toEqual({ "content-type": "application/json" });
  });

  it.each([
    {},
    { transcript: "" },
    { transcript: " " },
    { transcript: 12 },
    { transcript: "x".repeat(6001) },
    { transcript: "Open dashboard", messages: [{ role: "user", content: "different" }] },
  ])("rejects invalid text/context without invoking inference: %j", async (body) => {
    const upstream = vi.fn();
    const response = await post(await start(upstream), body);
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects raw audio rather than pretending it transcribed it", async () => {
    const upstream = vi.fn();
    const response = await post(await start(upstream), "audio bytes", {
      "content-type": "audio/webm",
    });
    expect(response.status).toBe(415);
    expect((await response.json()).error).toMatch(/local Whisper transcript/);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("transcribes a bounded multipart recording with the injected local transcriber", async () => {
    const transcriber = fakeTranscriber();
    const url = await start(vi.fn(), { transcriber });
    const response = await postAudio(url);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Hello Jarvis" });
    expect(transcriber.transcribe).toHaveBeenCalledOnce();
    expect(transcriber.status().status).toBe("ready");
  });

  it.each([
    ["unsupported MIME", { type: "text/plain" }, 415],
    ["missing audio", null, 400],
  ])("rejects %s without a transcription success response", async (_case, options, status) => {
    const transcriber = fakeTranscriber();
    const url = await start(vi.fn(), { transcriber });
    const response = options
      ? await postAudio(url, options)
      : await fetch(`${url}/api/transcribe`, {
          method: "POST",
          headers: { "content-type": "multipart/form-data; boundary=empty" },
          body: "--empty--\r\n",
        });
    expect(response.status).toBe(status);
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it("does not allow direct browser-origin access to local transcription", async () => {
    const transcriber = fakeTranscriber();
    const url = await start(vi.fn(), { transcriber });
    const response = await postAudio(url, { origin: "https://untrusted.invalid" });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it("rejects malformed and oversized JSON", async () => {
    const upstream = vi.fn();
    const url = await start(upstream);
    expect((await post(url, "{")).status).toBe(400);
    expect((await post(url, { transcript: "x".repeat(140_000) })).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects direct browser origins; exposes no permissive CORS", async () => {
    const upstream = vi.fn();
    const response = await post(
      await start(upstream),
      { transcript: "hello" },
      {
        "content-type": "application/json",
        origin: "https://untrusted.invalid",
      },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns browser playback instructions, not fabricated server audio", async () => {
    const upstream = vi.fn();
    const response = await fetch(`${await start(upstream)}/voice/speak`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Dashboard response" }),
    });
    expect(await response.json()).toEqual({
      text: "Dashboard response",
      lang: "en-IN",
      playback: "browser-speech-synthesis",
      audioGenerated: false,
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([
    () => new Response("{}", { status: 502 }),
    () => new Response("not json"),
    () => completion(""),
    () => Response.json({ choices: [{ message: { content: "hello" } }] }),
  ])("surfaces bad upstream responses without a success fallback", async (reply) => {
    const response = await post(await start(async () => reply()), { transcript: "hello" });
    expect(response.status).toBe(502);
    expect(await response.json()).toHaveProperty("error");
  });

  it("surfaces unavailable bridges and timeouts", async () => {
    const unavailable = await start(async () => {
      throw new TypeError("connection refused");
    });
    expect((await post(unavailable, { transcript: "hello" })).status).toBe(503);
    const timeout = await start(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
        }),
      { timeoutMs: 10 },
    );
    expect((await post(timeout, { transcript: "hello" })).status).toBe(504);
  });
});
