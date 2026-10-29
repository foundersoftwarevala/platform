import { deploymentSetting } from "@/lib/seo/seo-store.server";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import {
  recordVpsAiUsage,
  resolveVpsAiTarget,
  type VpsAiTarget,
} from "@/lib/ai-manager-vps.server";

type LocalChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OllamaChunk = {
  message?: { content?: string };
  done?: boolean;
  error?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

function sseError(message: string): string {
  return `data: ${JSON.stringify({ type: "error", error: { message } })}\n\n`;
}

export async function streamLocalAyraChat(options: {
  messages: LocalChatMessage[];
  memoryStatus: "ready" | "not_configured" | "unavailable";
  signal: AbortSignal;
}): Promise<Response> {
  const modelId =
    deploymentSetting("AYRA_CHAT_MODEL") || deploymentSetting("OLLAMA_MODEL") || "qwen2.5:3b";
  const serviceName = deploymentSetting("AYRA_AI_SERVICE") || "Ollama Local";
  const target = await withVpsPublicDatabase((tx) => resolveVpsAiTarget(tx, serviceName, modelId));
  if (!target.isLocalOllama)
    throw new Error("AYRA chat is restricted to the approved local Ollama service.");

  const endpoint = new URL(target.endpoint);
  endpoint.pathname = "/api/chat";
  const startedAt = Date.now();
  let statusCode = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let usageWritten = false;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: target.modelId,
        messages: options.messages,
        stream: true,
        options: { temperature: 0.3, num_ctx: 8192, num_predict: 1000 },
      }),
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(120_000)]),
    });
    statusCode = response.status;
  } catch (error) {
    await recordUsage(target, false);
    throw error;
  }
  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    await recordUsage(target, false);
    throw new Error(
      `Local AYRA chat failed (${response.status}): ${detail || response.statusText}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  async function recordUsage(target: VpsAiTarget, success: boolean) {
    if (usageWritten) return;
    await withVpsPublicDatabase((tx) =>
      recordVpsAiUsage(tx, target, {
        product: "ayra-chat",
        source: "ayra-chat",
        statusCode,
        success,
        latencyMs: Date.now() - startedAt,
        tokensIn,
        tokensOut,
      }),
    );
    usageWritten = true;
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buffer = "";
      let completed = false;
      const enqueueLine = async (line: string) => {
        if (!line.trim()) return;
        let chunk: OllamaChunk;
        try {
          chunk = JSON.parse(line) as OllamaChunk;
        } catch {
          throw new Error("Local Ollama returned malformed streaming JSON.");
        }
        if (chunk.error)
          throw new Error(`Local Ollama stream failed: ${chunk.error.slice(0, 200)}`);
        if (Number.isSafeInteger(chunk.prompt_eval_count) && (chunk.prompt_eval_count ?? -1) >= 0)
          tokensIn = chunk.prompt_eval_count!;
        if (Number.isSafeInteger(chunk.eval_count) && (chunk.eval_count ?? -1) >= 0)
          tokensOut = chunk.eval_count!;
        if (chunk.message?.content) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: chunk.message.content } }] })}\n\n`,
            ),
          );
        }
        if (chunk.done) {
          await recordUsage(target, true);
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
              await enqueueLine(line);
              if (completed) break;
            }
          }
          if (!completed) {
            buffer += decoder.decode();
            if (buffer.trim()) await enqueueLine(buffer);
          }
          if (!completed) {
            await recordUsage(target, true);
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          }
        } catch (error) {
          await recordUsage(target, false).catch((meterError: unknown) => {
            console.error(
              "[ayra-chat] usage metering failed:",
              meterError instanceof Error ? meterError.message : "unknown error",
            );
          });
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
      void recordUsage(target, false).catch((error: unknown) => {
        console.error(
          "[ayra-chat] usage metering failed:",
          error instanceof Error ? error.message : "unknown error",
        );
      });
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
