/**
 * Starts the self-hosted model Vala AI uses: llama.cpp's llama-server with a
 * GGUF model, listening on loopback only.
 *
 *   VALA_AI_LLAMA_BIN=/path/to/llama-server VALA_AI_MODEL_PATH=/path/to/model.gguf node scripts/vala-ai/model-server.mjs
 *
 * Optional: VALA_AI_MODEL_PORT (5200), VALA_AI_MODEL_CTX (8192), VALA_AI_MODEL_THREADS (CPU cores).
 * Tested with llama.cpp b11515 and Qwen2.5-Coder-3B-Instruct Q4_K_M
 * (sha256 724fb256bec1ff062b2f65e4569e871ad2e95ab2a3989723d1769c54294730b7).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename } from "node:path";

const bin = process.env.VALA_AI_LLAMA_BIN;
const model = process.env.VALA_AI_MODEL_PATH;
if (!bin || !existsSync(bin)) {
  console.error("Set VALA_AI_LLAMA_BIN to the llama-server executable.");
  process.exit(2);
}
if (!model || !existsSync(model)) {
  console.error("Set VALA_AI_MODEL_PATH to a .gguf model file.");
  process.exit(2);
}

const args = [
  "-m",
  model,
  "--host",
  "127.0.0.1",
  "--port",
  process.env.VALA_AI_MODEL_PORT ?? "5200",
  "-c",
  process.env.VALA_AI_MODEL_CTX ?? "8192",
  "-t",
  process.env.VALA_AI_MODEL_THREADS ?? String(Math.max(1, Math.floor(availableParallelism() / 2))),
  "--alias",
  basename(model).replace(/\.gguf$/i, ""),
];
const child = spawn(bin, args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
