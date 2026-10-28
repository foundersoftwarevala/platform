import { isIP } from "node:net";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

type LocalChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OllamaChunk = { message?: { content?: string }; done?: boolean; error?: string };

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "ollama"
  )
    return true;
  if (isIP(host) === 4) {
    const octets = host.split(".").map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }
  return (
    isIP(host) === 6 && (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"))
  );
}

function localChatConfiguration(): { url: string; model: string } {
  const url = new URL(deploymentSetting("OLLAMA_BASE_URL") || "http://127.0.0.1:11434");
  if (url.protocol !== "http:" || !isPrivateHost(url.hostname) || url.username || url.password) {
    throw new Error("AYRA chat requires a local Ollama endpoint.");
  }
  url.pathname = "/api/chat";
  url.search = "";
  url.hash = "";
  return {
    url: url.toString(),
    model:
      deploymentSetting("AYRA_CHAT_MODEL") || deploymentSetting("OLLAMA_MODEL") || "qwen2.5:3b",
  };
}

function sseError(message: string): string {
  return `data: ${JSON.stringify({ type: "error", error: { message } })}\n\n`;
}

export async function streamLocalAyraChat(options: {
  messages: LocalChatMessage[];
  memoryStatus: "ready" | "not_configured" | "unavailable";
  signal: AbortSignal;
}): Promise<Response> {
  const config = localChatConfiguration();
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: options.messages,
      stream: true,
      options: { temperature: 0.3, num_ctx: 8192, num_predict: 1000 },
    }),
    signal: AbortSignal.any([options.signal, AbortSignal.timeout(120_000)]),
  });
  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `Local AYRA chat failed (${response.status}): ${detail || response.statusText}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buffer = "";
      let completed = false;
      const enqueueLine = (line: string) => {
        if (!line.trim()) return;
        let chunk: OllamaChunk;
        try {
          chunk = JSON.parse(line) as OllamaChunk;
        } catch {
          throw new Error("Local Ollama returned malformed streaming JSON.");
        }
        if (chunk.error)
          throw new Error(`Local Ollama stream failed: ${chunk.error.slice(0, 200)}`);
        if (chunk.message?.content) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: chunk.message.content } }] })}\n\n`,
            ),
          );
        }
        if (chunk.done) {
          completed = true;
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      };
      void (async () => {
        try {
          while (!completed) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              enqueueLine(line);
              if (completed) break;
            }
          }
          if (!completed) {
            buffer += decoder.decode();
            if (buffer.trim()) enqueueLine(buffer);
          }
          if (!completed) {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Local AYRA chat failed.";
          controller.enqueue(new TextEncoder().encode(sseError(message)));
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } finally {
          reader.releaseLock();
        }
      })();
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      "x-ayra-memory-status": options.memoryStatus,
    },
  });
}
