export type ChatConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export const CHAT_CONVERSATION_FALLBACK_POLL_MS = 60_000;
export const CHAT_MESSAGE_FALLBACK_POLL_MS = 30_000;

export function chatFallbackRefetchInterval(
  enabled: boolean,
  connection: ChatConnectionState,
  intervalMs: number,
): number | false {
  return enabled && connection !== "live" ? intervalMs : false;
}
