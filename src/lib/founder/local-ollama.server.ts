import { isIP } from "node:net";
import { z } from "zod";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

const DEFAULT_MODEL = "qwen2.5:3b";

type OllamaResponse = { message?: { content?: string } };

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "ollama"
  )
    return true;
  const version = isIP(host);
  if (version === 4) {
    const octets = host.split(".").map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }
  if (version === 6)
    return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  return false;
}

function ollamaConfiguration(): { url: string; model: string } {
  const configuredUrl = deploymentSetting("OLLAMA_BASE_URL") || "http://127.0.0.1:11434";
  const url = new URL(configuredUrl);
  if (url.protocol !== "http:" || !isPrivateHost(url.hostname) || url.username || url.password) {
    throw new Error("OLLAMA_BASE_URL must be an HTTP endpoint on localhost or a private host.");
  }
  url.pathname = "/api/chat";
  url.search = "";
  url.hash = "";
  const model = deploymentSetting("OLLAMA_MODEL") || DEFAULT_MODEL;
  return { url: url.toString(), model };
}

export function configuredLocalModel(): string {
  return ollamaConfiguration().model;
}

export async function generateLocalJson<T>(options: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  contextLength?: number;
  numPredict?: number;
}): Promise<{ model: string; value: T }> {
  const config = ollamaConfiguration();
  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          num_ctx: options.contextLength ?? 8192,
          num_predict: options.numPredict ?? 1024,
        },
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "connection failed";
    throw new Error(`Local Ollama is unavailable at ${new URL(config.url).host}: ${detail}`);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(
      `Local Ollama request failed (${response.status}): ${detail || response.statusText}`,
    );
  }
  const result = (await response.json()) as OllamaResponse;
  const content = result.message?.content;
  if (!content) throw new Error("Local Ollama returned no JSON content.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`Local Ollama returned malformed JSON: ${detail}`);
  }
  const validated = options.schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Local Ollama response did not match the required contract: ${validated.error.message}`,
    );
  }
  return { model: config.model, value: validated.data };
}
