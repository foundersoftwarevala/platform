import { SlidingWindowLimiter } from "@/lib/i18n/limits";
import { count } from "@/lib/i18n/metrics.server";

/**
 * Per-person request limits for the Chat server functions.
 *
 * Same mechanism the AI reply endpoint already used (the platform's
 * SlidingWindowLimiter, one per server instance, bounding bursts); cost-based
 * limits stay where they were (the translation engine's character quota in
 * PostgreSQL, shared across instances). Message, attachment, conversation and
 * participant limits are enforced in the database (20261108T094000), because
 * those writes do not pass through a server function.
 *
 * The numbers are per person per minute and sit well above what a conversation
 * produces: a person reads and replies a few times a minute, the translation
 * of a screenful is one batched call, an AI reply is one model call.
 */
export const CHAT_LIMITS = {
  /** One AI turn per person message; a fast typist does not exceed this. */
  aiReply: { perMinute: 20, retryAfterSeconds: 30 },
  /** Batched calls (up to 20 messages each), plus polling for a retry. */
  translate: { perMinute: 90, retryAfterSeconds: 15 },
  /** On-demand suggestions, each a model call. */
  suggest: { perMinute: 10, retryAfterSeconds: 30 },
  /** The server opens at most one support conversation per person. */
  openConversation: { perMinute: 5, retryAfterSeconds: 60 },
  /** Staff creating tasks / leads from a conversation. */
  link: { perMinute: 30, retryAfterSeconds: 30 },
} as const;

export type ChatLimitKind = keyof typeof CHAT_LIMITS;

const limiters = new Map<ChatLimitKind, SlidingWindowLimiter>();

export type LimitResult =
  | { ok: true }
  | { ok: false; status: 429; error: string; retryable: true; retryAfterSeconds: number };

export function chatRateLimit(kind: ChatLimitKind, userId: string): LimitResult {
  let limiter = limiters.get(kind);
  if (!limiter) {
    limiter = new SlidingWindowLimiter(60_000, 10_000);
    limiters.set(kind, limiter);
  }
  const rule = CHAT_LIMITS[kind];
  if (!limiter.hit(userId, rule.perMinute)) return { ok: true };
  count(`chat.rate_limited.${kind}`);
  return {
    ok: false,
    status: 429,
    error: "Too many requests. Please wait a moment and try again.",
    retryable: true,
    retryAfterSeconds: rule.retryAfterSeconds,
  };
}
