import express from "express";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  createLocalTranscriber,
  readAudioUpload,
  TranscriptionError,
} from "./local-transcriber.mjs";

const BRIDGE = "http://127.0.0.1:5200";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function transcriptOf(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 6000)
    throw new HttpError(400, "A transcript of 1-6000 characters is required.");
  return value.trim();
}

function tokens(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0)
    throw new HttpError(502, "The local bridge returned invalid token counts.");
  return value;
}

export function createJarvisApp({
  fetcher = fetch,
  timeoutMs = 600_000,
  checkBridgeHealth = true,
  transcriber = createLocalTranscriber(),
  preloadLocalModel = false,
} = {}) {
  const app = express();
  if (preloadLocalModel) {
    void transcriber
      .initialize({ allowDownload: process.env.JARVIS_STT_ALLOW_MODEL_DOWNLOAD === "1" })
      .catch((error) => console.error("[jarvis:stt] Model initialization failed:", error.message));
  }
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("cache-control", "no-store");
    if (req.headers.origin)
      return next(new HttpError(403, "Use the authenticated, same-origin Vala AI API."));
    next();
  });
  app.use(express.json({ limit: "128kb", strict: true }));

  async function upstream(path, init, signal) {
    let response;
    try {
      response = await fetcher(`${BRIDGE}${path}`, { ...init, signal });
    } catch (error) {
      if (signal.aborted)
        throw new HttpError(
          signal.reason?.name === "TimeoutError" ? 504 : 499,
          signal.reason?.name === "TimeoutError"
            ? "Local model request timed out."
            : "Request cancelled.",
        );
      console.error("[jarvis] local bridge connection failed:", error.message);
      throw new HttpError(503, "The local model bridge is unavailable.");
    }
    if (!response.ok)
      throw new HttpError(502, `Local model bridge returned HTTP ${response.status}.`);
    try {
      return await response.json();
    } catch {
      throw new HttpError(502, "Local model bridge returned invalid JSON.");
    }
  }

  app.get("/health", async (req, res) => {
    if (!checkBridgeHealth) {
      res.json({
        status: "ok",
        service: "jarvis",
        port: req.socket.localPort,
        health: "liveness",
        endpoints: ["GET /health", "POST /api/transcribe", "POST /voice", "POST /chat"],
        modelBridge: { url: BRIDGE, status: "not_checked" },
        transcription: transcriber.status(),
      });
      return;
    }
    const bridge = await upstream("/health", {}, AbortSignal.timeout(4000));
    if (bridge?.status !== "ok" || typeof bridge.model !== "string" || !bridge.model.trim())
      throw new HttpError(503, "Local model bridge is not ready.");
    res.json({
      status: "ok",
      model: bridge.model,
      transcription: transcriber.status(),
      speech: "browser-speech-synthesis",
    });
  });

  app.post("/api/transcribe", async (req, res) => {
    if (!req.is("multipart/form-data"))
      throw new HttpError(415, "Upload a MediaRecorder audio file as multipart form data.");
    const audio = await readAudioUpload(req);
    const controller = new AbortController();
    req.once("aborted", () => controller.abort());
    res.once("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const text = await transcriber.transcribe(audio.buffer, {
      contentType: audio.mimeType,
      signal: controller.signal,
    });
    res.json({ text });
  });

  app.post(["/voice/transcribe", "/voice", "/chat"], async (req, res) => {
    if (!req.is("application/json"))
      throw new HttpError(415, "Send the local Whisper transcript as JSON.");
    const input =
      req.path !== "/voice/transcribe" && req.body?.transcript === undefined
        ? req.body?.message
        : req.body?.transcript;
    const transcript = transcriptOf(input);
    const messages = req.body.messages ?? [
      {
        role: "system",
        content: "You are Vala AI. Answer briefly. You cannot execute commands or open pages.",
      },
      { role: "user", content: transcript },
    ];
    if (
      !Array.isArray(messages) ||
      !messages.length ||
      messages.length > 12 ||
      messages.some(
        (m) =>
          !m || !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string",
      ) ||
      messages.at(-1)?.role !== "user" ||
      messages.at(-1)?.content !== transcript
    )
      throw new HttpError(400, "Text messages must end with the recognized transcript.");

    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
    const started = Date.now();
    const body = await upstream(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, stream: false, max_tokens: 700, temperature: 0.3 }),
      },
      signal,
    );
    const text = body?.choices?.[0]?.message?.content;
    if (
      typeof text !== "string" ||
      !text.trim() ||
      typeof body.model !== "string" ||
      !body.model.trim()
    )
      throw new HttpError(502, "Local model bridge returned no usable text or model.");
    res.json({
      transcript,
      transcription: "local-whisper",
      reply: {
        text: text.trim(),
        model: body.model,
        source: "local",
        service: null,
        durationMs: Date.now() - started,
        tokensIn: tokens(body.usage?.prompt_tokens),
        tokensOut: tokens(body.usage?.completion_tokens),
      },
    });
  });

  app.post("/voice/speak", (req, res) => {
    if (!req.is("application/json"))
      throw new HttpError(415, "Send text as JSON for browser playback.");
    const text = transcriptOf(req.body?.text);
    res.json({ text, lang: "en-IN", playback: "browser-speech-synthesis", audioGenerated: false });
  });

  app.use((_req, _res, next) => next(new HttpError(404, "Jarvis endpoint not found.")));
  app.use((error, req, res, next) => {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof TranscriptionError
          ? error.status
          : error.type === "entity.parse.failed"
            ? 400
            : error.type === "entity.too.large"
              ? 413
              : 500;
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof TranscriptionError
          ? error.message
          : status === 400
            ? "Body must be valid JSON."
            : status === 413
              ? "Request body exceeds 128 KiB."
              : "Internal Jarvis error.";
    console.error(`[jarvis] ${req.method} ${req.path}: ${status} ${message}`);
    if (res.headersSent) return next(error);
    if (!res.destroyed) res.status(status).json({ error: message });
  });
  return app;
}

export function startJarvisServer(options = {}) {
  const server = createJarvisApp({
    ...options,
    preloadLocalModel: options.preloadLocalModel ?? true,
  }).listen(3003, "127.0.0.1", () => {
    console.log("Jarvis browser-voice relay listening on 127.0.0.1:3003");
  });
  server.on("error", (error) => {
    console.error("[jarvis] startup failed:", error.message);
    process.exitCode = 1;
  });
  server.requestTimeout = 610_000;
  server.headersTimeout = 10_000;
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      server.closeAllConnections();
      server.close();
    });
  return server;
}

export function isDirectExecution(moduleUrl, entryPath) {
  return Boolean(entryPath) && moduleUrl === pathToFileURL(realpathSync(entryPath)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) startJarvisServer();
