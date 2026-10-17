import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { MODEL_DIRECTORY, STT_MODEL } from "./local-transcriber.mjs";

env.cacheDir = MODEL_DIRECTORY;
env.allowLocalModels = true;
env.allowRemoteModels = true;

console.log(`Downloading/loading ${STT_MODEL} into ${path.resolve(MODEL_DIRECTORY)}.`);
await pipeline("automatic-speech-recognition", STT_MODEL, { device: "cpu" });
console.log("Local Whisper model is cached and ready. Audio inference remains on this machine.");
