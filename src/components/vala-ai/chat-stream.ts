import { supabase } from "@/integrations/supabase/client";

/**
 * One streamed reply from the platform's guarded assistant route, /api/chat.
 *
 * The route is behind requireAuthorizedAiCaller, so the signed-in session's
 * access token is sent as a bearer token. The route returns the provider's
 * server-sent events untouched, and the gateway may answer from an
 * OpenAI-compatible service (choices[0].delta.content) or from Anthropic
 * (content_block_delta / text_delta), so both are read here.
 */

export class ChatRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatRequestError";
    this.status = status;
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** The text carried by one SSE `data:` payload, or "" when it carries none. */
export function deltaFromEvent(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const event = payload as Record<string, any>;
  if (event.type === "error") {
    throw new ChatRequestError(
      String(event.error?.message ?? "The AI provider reported an error."),
      502,
    );
  }
  const openAi = event.choices?.[0]?.delta?.content;
  if (typeof openAi === "string") return openAi;
  if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
    return typeof event.delta.text === "string" ? event.delta.text : "";
  }
  if (event.type === "content_block_start" && event.content_block?.type === "text") {
    return typeof event.content_block.text === "string" ? event.content_block.text : "";
  }
  return "";
}

export async function streamChat(
  messages: ChatTurn[],
  options: { signal?: AbortSignal; onDelta?: (full: string) => void } = {},
): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ChatRequestError("Please sign in to use Vala AI.", 401);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    signal: options.signal,
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new ChatRequestError(detail || `The AI request failed (HTTP ${res.status}).`, res.status);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let full = "";
  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return; // a partial or non-JSON keep-alive line
    }
    const delta = deltaFromEvent(parsed);
    if (delta) {
      full += delta;
      options.onDelta?.(full);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) consume(line);
  }
  if (buffer) consume(buffer);
  return full;
}
