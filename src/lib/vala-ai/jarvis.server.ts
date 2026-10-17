import { z } from "zod";
import type { ChatMessage, ModelReply } from "./model.server";
import { getSettings } from "./settings.server";
import { ValaError } from "./util.server";

const base = "http://127.0.0.1:3003";
function localJarvisBase() {
  let url: URL;
  try {
    url = new URL(process.env.VITE_JARVIS_URL || base);
  } catch {
    throw new ValaError(500, "VITE_JARVIS_URL must point to HTTP loopback port 3003 only.");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.port !== "3003" ||
    url.username ||
    url.password ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search ||
    url.hash
  )
    throw new ValaError(500, "VITE_JARVIS_URL must point to HTTP loopback port 3003 only.");
  return url.origin;
}

const replySchema = z.object({
  text: z.string().trim().min(1),
  model: z.string().trim().min(1),
  source: z.literal("local"),
  service: z.null(),
  durationMs: z.number().nonnegative(),
  tokensIn: z.number().int().nonnegative().nullable(),
  tokensOut: z.number().int().nonnegative().nullable(),
});
const healthSchema = z.union([
  z.object({
    status: z.literal("ok"),
    model: z.string().min(1),
    transcription: z.object({
      engine: z.literal("whisper"),
      model: z.string().min(1),
      device: z.literal("cpu"),
      status: z.enum(["not_loaded", "loading", "ready", "error"]),
    }),
    speech: z.literal("browser-speech-synthesis"),
  }),
  z.object({
    status: z.literal("ok"),
    service: z.literal("jarvis"),
    port: z.literal(3003),
    health: z.literal("liveness"),
    modelBridge: z.object({
      url: z.literal("http://127.0.0.1:5200"),
      status: z.literal("not_checked"),
    }),
    transcription: z.object({
      engine: z.literal("whisper"),
      model: z.string().min(1),
      device: z.literal("cpu"),
      status: z.enum(["not_loaded", "loading", "ready", "error"]),
    }),
  }),
]);
const speechSchema = z.object({
  text: z.string().trim().min(1).max(6000),
  lang: z.literal("en-IN"),
  playback: z.literal("browser-speech-synthesis"),
  audioGenerated: z.literal(false),
});
const transcriptionSchema = z.object({ text: z.string().trim().min(1).max(6000) });

async function request(path: string, body?: object, signal?: AbortSignal): Promise<unknown> {
  const target = `${localJarvisBase()}${path}`;
  let response: Response;
  try {
    response = await fetch(target, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any([
        AbortSignal.timeout(body ? getSettings().model_timeout_s * 1000 : 5000),
        ...(signal ? [signal] : []),
      ]),
    });
  } catch (error) {
    console.error("[vala-ai:jarvis] relay request failed", error);
    if (signal?.aborted) throw new ValaError(499, "Jarvis voice request was cancelled.");
    if (error instanceof Error && error.name === "TimeoutError")
      throw new ValaError(504, "Jarvis voice request timed out.");
    throw new ValaError(503, "Jarvis voice relay is unavailable.");
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ValaError(502, "Jarvis returned invalid JSON.");
  }
  if (!response.ok) {
    const detail = z.object({ error: z.string() }).safeParse(data);
    throw new ValaError(
      response.status >= 400 && response.status <= 599 ? response.status : 502,
      detail.success ? detail.data.error : `Jarvis returned HTTP ${response.status}.`,
    );
  }
  return data;
}

export async function jarvisHealth(signal?: AbortSignal) {
  const parsed = healthSchema.safeParse(await request("/health", undefined, signal));
  if (!parsed.success) throw new ValaError(502, "Jarvis returned invalid health metadata.");
  return parsed.data;
}

export async function jarvisSpeak(text: string, signal?: AbortSignal) {
  if (!text.trim() || text.trim().length > 6000)
    throw new ValaError(400, "Speech text must contain 1-6000 characters.");
  const parsed = speechSchema.safeParse(await request("/voice/speak", { text }, signal));
  if (!parsed.success)
    throw new ValaError(502, "Jarvis returned invalid browser speech instructions.");
  return parsed.data;
}

export async function jarvisTranscribe(audio: Blob, signal?: AbortSignal) {
  if (!audio.size || audio.size > 20 * 1024 * 1024)
    throw new ValaError(400, "Audio must contain 1 byte to 20 MiB.");
  const target = `${localJarvisBase()}/api/transcribe`;
  let response: Response;
  try {
    const form = new FormData();
    form.append("audio", audio, audio.type.includes("webm") ? "recording.webm" : "recording.audio");
    response = await fetch(target, {
      method: "POST",
      body: form,
      signal: AbortSignal.any([
        AbortSignal.timeout(getSettings().model_timeout_s * 1000),
        ...(signal ? [signal] : []),
      ]),
    });
  } catch (error) {
    console.error("[vala-ai:jarvis] local transcription request failed", error);
    if (signal?.aborted) throw new ValaError(499, "Local transcription was cancelled.");
    if (error instanceof Error && error.name === "TimeoutError")
      throw new ValaError(504, "Local transcription timed out.");
    throw new ValaError(503, "The local Whisper service is unavailable.");
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ValaError(502, "Local Whisper returned invalid JSON.");
  }
  if (!response.ok) {
    const detail = z.object({ error: z.string() }).safeParse(data);
    throw new ValaError(
      response.status >= 400 && response.status <= 599 ? response.status : 502,
      detail.success ? detail.data.error : `Local Whisper returned HTTP ${response.status}.`,
    );
  }
  const parsed = transcriptionSchema.safeParse(data);
  if (!parsed.success) throw new ValaError(502, "Local Whisper returned an invalid transcript.");
  return parsed.data;
}

export async function jarvisChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
  path: "/voice/transcribe" | "/voice" | "/chat" = "/voice/transcribe",
): Promise<ModelReply> {
  const transcript = messages.at(-1)?.content;
  const parsed = z
    .object({
      transcript: z.string(),
      transcription: z.literal("local-whisper"),
      reply: replySchema,
    })
    .safeParse(await request(path, { transcript, messages }, signal));
  if (!parsed.success || parsed.data.transcript !== transcript)
    throw new ValaError(502, "Jarvis returned an invalid transcript or model response.");
  return parsed.data.reply;
}
