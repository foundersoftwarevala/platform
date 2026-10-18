import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import Busboy from "busboy";
import ffmpegPath from "ffmpeg-static";

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 30;
export const STT_MODEL = process.env.JARVIS_STT_MODEL || "onnx-community/whisper-tiny";

const audioTypes = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/x-wav"]);
export const MODEL_DIRECTORY =
  process.env.JARVIS_MODEL_DIR ||
  path.join(process.env.LOCALAPPDATA || os.homedir(), "SoftwareVala", "Jarvis", "models");

export class TranscriptionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function readAudioUpload(req) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let fileCount = 0;
    let audio;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 0 },
      });
    } catch {
      fail(new TranscriptionError(400, "Send one audio file as multipart field 'audio'."));
      return;
    }

    parser.on("file", (field, stream, info) => {
      fileCount++;
      if (field !== "audio" || !audioTypes.has(info.mimeType.split(";")[0].toLowerCase())) {
        stream.resume();
        fail(new TranscriptionError(415, "Audio must be WebM, Ogg, MP4 or WAV in field 'audio'."));
        return;
      }
      const chunks = [];
      let bytes = 0;
      stream.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_AUDIO_BYTES) return;
        chunks.push(chunk);
      });
      stream.once("limit", () =>
        fail(new TranscriptionError(413, "Audio exceeds the 20 MiB limit.")),
      );
      stream.once("error", () =>
        fail(new TranscriptionError(400, "Audio upload was interrupted.")),
      );
      stream.once("end", () => {
        if (bytes && bytes <= MAX_AUDIO_BYTES)
          audio = {
            buffer: Buffer.concat(chunks),
            mimeType: info.mimeType,
            filename: info.filename,
          };
      });
    });
    parser.once("filesLimit", () =>
      fail(new TranscriptionError(400, "Upload exactly one audio file.")),
    );
    parser.once("fieldsLimit", () => fail(new TranscriptionError(400, "Unexpected form fields.")));
    parser.once("partsLimit", () =>
      fail(new TranscriptionError(400, "Upload exactly one audio file.")),
    );
    parser.once("error", () =>
      fail(new TranscriptionError(400, "Invalid multipart audio upload.")),
    );
    parser.once("close", () => {
      if (settled) return;
      settled = true;
      if (fileCount !== 1 || !audio?.buffer.length) {
        reject(new TranscriptionError(400, "A non-empty audio file is required."));
        return;
      }
      resolve(audio);
    });
    req.once("aborted", () => fail(new TranscriptionError(400, "Audio upload was interrupted.")));
    req.pipe(parser);
  });
}

function decodeAudio(buffer, signal) {
  if (!ffmpegPath) throw new TranscriptionError(503, "The local FFmpeg decoder is unavailable.");
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-i",
        "pipe:0",
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-t",
        String(MAX_AUDIO_SECONDS),
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        "pipe:1",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] },
    );
    const chunks = [];
    let size = 0;
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 20_000);
    const finish = (error, samples) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve(samples);
    };
    const cancel = () => {
      child.kill();
      finish(new TranscriptionError(499, "Transcription request was cancelled."));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    child.once("error", () => finish(new TranscriptionError(503, "Local FFmpeg could not start.")));
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_AUDIO_SECONDS * 16000 * 2) {
        child.kill();
        finish(new TranscriptionError(413, "Audio exceeds the 30 second limit."));
        return;
      }
      chunks.push(chunk);
    });
    child.once("close", (code) => {
      if (settled) return;
      if (timedOut) {
        finish(new TranscriptionError(504, "Local audio decoding timed out."));
        return;
      }
      if (code !== 0) {
        finish(new TranscriptionError(400, "Audio decoding failed; record again as WebM or WAV."));
        return;
      }
      const pcm = Buffer.concat(chunks);
      if (pcm.length < 3200 || pcm.length % 2) {
        finish(new TranscriptionError(400, "Audio is empty or too short to transcribe."));
        return;
      }
      const samples = new Float32Array(pcm.length / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
      finish(null, samples);
    });
    child.stdin.once("error", () => {});
    child.stdin.end(buffer);
  });
}

export function createLocalTranscriber({ modelId = STT_MODEL, loadPipeline } = {}) {
  let modelPromise;
  let model;
  let status = "not_loaded";
  let active = false;

  async function initialize({ allowDownload = false } = {}) {
    if (model) return;
    if (modelPromise) return modelPromise;
    status = "loading";
    modelPromise = (async () => {
      let createPipeline = loadPipeline;
      if (!createPipeline) {
        const transformers = await import("@huggingface/transformers");
        transformers.env.cacheDir = MODEL_DIRECTORY;
        transformers.env.allowLocalModels = true;
        transformers.env.allowRemoteModels = allowDownload;
        createPipeline = transformers.pipeline;
      }
      try {
        model = await createPipeline("automatic-speech-recognition", modelId, { device: "cpu" });
        status = "ready";
      } catch (error) {
        status = "error";
        throw error;
      }
    })().catch((error) => {
      modelPromise = undefined;
      if (status !== "error") status = "error";
      throw error;
    });
    return modelPromise;
  }

  async function transcribe(buffer, { signal } = {}) {
    if (active) throw new TranscriptionError(429, "Another local transcription is in progress.");
    if (buffer.length > MAX_AUDIO_BYTES)
      throw new TranscriptionError(413, "Audio exceeds the 20 MiB limit.");
    if (signal?.aborted) throw new TranscriptionError(499, "Transcription request was cancelled.");
    active = true;
    try {
      if (!model) {
        try {
          await initialize();
        } catch (error) {
          console.error("[jarvis:stt] Local Whisper model is not ready:", error.message);
          throw new TranscriptionError(
            503,
            "Local Whisper is not ready. Run 'npm --prefix services/jarvis run model:download' once, then restart Jarvis.",
          );
        }
      }
      const audio = await decodeAudio(buffer, signal);
      if (signal?.aborted)
        throw new TranscriptionError(499, "Transcription request was cancelled.");
      let result;
      try {
        result = await model(audio, {
          chunk_length_s: MAX_AUDIO_SECONDS,
          stride_length_s: 5,
          task: "transcribe",
        });
      } catch (error) {
        console.error("[jarvis:stt] Local Whisper inference failed:", error.message);
        throw new TranscriptionError(502, "Local Whisper could not transcribe this recording.");
      }
      if (signal?.aborted)
        throw new TranscriptionError(499, "Transcription request was cancelled.");
      if (typeof result?.text !== "string" || !result.text.trim())
        throw new TranscriptionError(
          422,
          "No speech was recognized. Try speaking closer to the microphone.",
        );
      return result.text.trim().slice(0, 6000);
    } finally {
      active = false;
    }
  }

  return {
    initialize,
    transcribe,
    status: () => ({ engine: "whisper", model: modelId, device: "cpu", status }),
  };
}
