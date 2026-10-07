import { resolveLanguage } from "@/lib/i18n/registry";

/**
 * Chat translation: detect -> English canonical -> recipient language.
 *
 * Pure orchestration. Everything that touches the outside world (the database
 * rows, the language detector, the translation pipeline, the clock) arrives
 * through TranslationDeps, so the same code runs against the real
 * database and the real translation engine in production
 * (translation.server.ts) and against in-memory stand-ins in tests.
 *
 * Rules it keeps:
 *  - the original (messages.body) is never changed; the canonical English and
 *    each recipient language are separate rows;
 *  - one worker per (message, language): a claimed row is not translated again;
 *  - a message already in the recipient's language, or with nothing to
 *    translate, is never sent to the engine;
 *  - source -> English happens once per message; English -> language once per
 *    (message, language), however many people read it;
 *  - failure is a state, never fake text: retrying with bounded exponential
 *    backoff, then failed. The original stays available throughout.
 */

export const CANONICAL = "en";
export const MAX_ATTEMPTS = 4;
export const MAX_CHUNK = 3_500;

export type TranslationStatus = "pending" | "processing" | "completed" | "failed" | "retrying";

export type TranslationRow = {
  message_id: string;
  target_language: string;
  status: TranslationStatus;
  source_language: string | null;
  source_confidence: number | null;
  translated_text: string | null;
  identity: boolean;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
};

export type Detection = { code: string | null; confidence: number | null };

export type Translated = {
  text: string;
  provider: string | null;
  model: string | null;
  quality: number | null;
};

/** Raised by deps.translate for failures with a known meaning. */
export class TranslationFailure extends Error {
  constructor(
    readonly kind: "retryable" | "quota" | "permanent",
    message: string,
  ) {
    super(message);
    this.name = "TranslationFailure";
  }
}

export type FinishInput = {
  status: "completed" | "retrying" | "failed";
  text?: string | null;
  source?: string | null;
  confidence?: number | null;
  identity?: boolean;
  error?: string | null;
  provider?: string | null;
  model?: string | null;
  quality?: number | null;
  latencyMs?: number | null;
  retryInSeconds?: number | null;
  /** Waiting for something else (not a failure of this row): do not spend an attempt. */
  refundAttempt?: boolean;
};

export interface TranslationDeps {
  claim(
    messageId: string,
    target: string,
    retry: boolean,
  ): Promise<{ claimed: boolean; row: TranslationRow }>;
  finish(messageId: string, target: string, input: FinishInput): Promise<TranslationRow>;
  /** The real language detector. Throws when it cannot be reached. */
  detect(text: string): Promise<Detection>;
  /** The real translation pipeline. `source` null lets the engine detect. */
  translate(text: string, source: string | null, target: string): Promise<Translated>;
  now(): number;
  random(): number;
  /** Anything this process is already running; used for backpressure. */
  inflight: { value: number; limit: number };
}

export type TranslationView = {
  messageId: string;
  target: string;
  status: TranslationStatus;
  text: string | null;
  sourceLanguage: string | null;
  /** True when there was nothing to translate; the reader shows the original. */
  identity: boolean;
  error: string | null;
  /** When to ask again, for retrying / processing rows. */
  retryAfterMs: number | null;
};

export function viewOf(row: TranslationRow, now: number): TranslationView {
  let retryAfterMs: number | null = null;
  if (row.status === "retrying" && row.next_attempt_at) {
    retryAfterMs = Math.max(500, new Date(row.next_attempt_at).getTime() - now);
  } else if (row.status === "processing" || row.status === "pending") {
    retryAfterMs = 1_500;
  }
  return {
    messageId: row.message_id,
    target: row.target_language,
    status: row.status,
    text: row.status === "completed" ? row.translated_text : null,
    sourceLanguage: row.source_language,
    identity: row.identity,
    error: row.status === "failed" || row.status === "retrying" ? row.last_error : null,
    retryAfterMs,
  };
}

/** Same language, or the same language in the same script (en vs en-GB). */
export function sameLanguage(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const x = resolveLanguage(a, { names: true });
  const y = resolveLanguage(b, { names: true });
  if (!x || !y) return false;
  return x.code === y.code || (x.iso639_3 === y.iso639_3 && x.script === y.script);
}

/** Does the text contain anything that is a word in some language? */
export function hasTranslatableText(text: string): boolean {
  return /\p{L}/u.test(text);
}

/**
 * Trust a detector result only as far as it is reliable: a few words are easy
 * to misread ("ok", "no", names), so short text needs a high score. An
 * untrusted result is "unknown", and the engine then detects per segment.
 */
export function trustedDetection(text: string, detection: Detection): Detection {
  if (!detection.code || detection.confidence === null) return { code: null, confidence: null };
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  const needed = letters < 12 ? 0.9 : letters < 30 ? 0.7 : 0.5;
  return detection.confidence >= needed
    ? detection
    : { code: null, confidence: detection.confidence };
}

/** Split long text on line breaks into pieces the engine accepts, keeping order. */
export function splitForTranslation(text: string, max = MAX_CHUNK): string[] {
  if (text.length <= max) return [text];
  const pieces: string[] = [];
  let current = "";
  const push = () => {
    if (current) pieces.push(current);
    current = "";
  };
  for (const line of text.split("\n")) {
    if (line.length > max) {
      push();
      for (let i = 0; i < line.length; i += max) pieces.push(line.slice(i, i + max));
      continue;
    }
    if (current.length + line.length + 1 > max) push();
    current = current ? `${current}\n${line}` : line;
  }
  push();
  return pieces;
}

/** Seconds to wait before attempt n+1: 4, 8, 16 ... capped at 5 minutes, jittered 50-100%. */
export function backoffSeconds(attempts: number, random: number): number {
  const base = Math.min(300, 4 * 2 ** Math.max(0, attempts - 1));
  return Math.max(1, Math.round(base * (0.5 + random * 0.5)));
}

function failureOutcome(error: unknown, row: TranslationRow, deps: TranslationDeps): FinishInput {
  if (error instanceof TranslationFailure) {
    if (error.kind === "permanent") return { status: "failed", error: error.message };
    const base = error.kind === "quota" ? 120 : backoffSeconds(row.attempts, deps.random());
    return { status: "retrying", error: error.message, retryInSeconds: base };
  }
  const message = error instanceof Error ? error.message : "translation failed";
  return {
    status: "retrying",
    error: message.slice(0, 200),
    retryInSeconds: backoffSeconds(row.attempts, deps.random()),
  };
}

export type EnsureOptions = { retry?: boolean; internal?: boolean };

/**
 * Make sure `message` has a translation into `target`, working at most once
 * across all callers, and return its current state.
 */
export async function ensureTranslation(
  deps: TranslationDeps,
  message: { id: string; body: string },
  target: string,
  options: EnsureOptions = {},
): Promise<TranslationView> {
  const lang = resolveLanguage(target, { names: true });
  if (!lang) {
    return {
      messageId: message.id,
      target,
      status: "failed",
      text: null,
      sourceLanguage: null,
      identity: false,
      error: "That language is not supported.",
      retryAfterMs: null,
    };
  }
  const code = lang.code;

  // Backpressure: past this process's own limit, answer "try again shortly"
  // without taking the claim, so no attempt is spent and no queue grows.
  if (!options.internal && deps.inflight.value >= deps.inflight.limit) {
    return {
      messageId: message.id,
      target: code,
      status: "retrying",
      text: null,
      sourceLanguage: null,
      identity: false,
      error: "busy",
      retryAfterMs: 2_000 + Math.round(deps.random() * 2_000),
    };
  }

  const { claimed, row } = await deps.claim(message.id, code, options.retry === true);
  if (!claimed) return viewOf(row, deps.now());

  deps.inflight.value += 1;
  const started = deps.now();
  try {
    const done =
      code === CANONICAL
        ? await computeCanonical(deps, message, row, started)
        : await computeTarget(deps, message, code, row, started);
    return viewOf(done, deps.now());
  } catch (error) {
    const finished = await deps.finish(message.id, code, {
      ...failureOutcome(error, row, deps),
      latencyMs: deps.now() - started,
    });
    return viewOf(finished, deps.now());
  } finally {
    deps.inflight.value -= 1;
  }
}

async function translateChunks(
  deps: TranslationDeps,
  text: string,
  source: string | null,
  target: string,
): Promise<Translated> {
  const pieces = splitForTranslation(text);
  const out: Translated[] = [];
  for (const piece of pieces) out.push(await deps.translate(piece, source, target));
  return {
    text: out.map((o) => o.text).join("\n"),
    provider: out[0]?.provider ?? null,
    model: out[0]?.model ?? null,
    quality: out.length ? Math.min(...out.map((o) => o.quality ?? 1)) : null,
  };
}

async function computeCanonical(
  deps: TranslationDeps,
  message: { id: string; body: string },
  row: TranslationRow,
  started: number,
): Promise<TranslationRow> {
  const body = message.body;
  if (!hasTranslatableText(body)) {
    return deps.finish(message.id, CANONICAL, {
      status: "completed",
      text: body,
      identity: true,
      latencyMs: deps.now() - started,
    });
  }

  let detection: Detection = { code: null, confidence: null };
  try {
    detection = trustedDetection(body, await deps.detect(body.slice(0, 2_000)));
  } catch {
    // The detector being unreachable is not fatal: with no source given, the
    // translation engine detects each segment itself.
  }

  if (detection.code && sameLanguage(detection.code, CANONICAL)) {
    return deps.finish(message.id, CANONICAL, {
      status: "completed",
      text: body,
      source: detection.code,
      confidence: detection.confidence,
      identity: true,
      latencyMs: deps.now() - started,
    });
  }

  const result = await translateChunks(deps, body, detection.code, CANONICAL);
  void row;
  return deps.finish(message.id, CANONICAL, {
    status: "completed",
    text: result.text,
    source: detection.code,
    confidence: detection.confidence,
    provider: result.provider,
    model: result.model,
    quality: result.quality,
    latencyMs: deps.now() - started,
  });
}

async function computeTarget(
  deps: TranslationDeps,
  message: { id: string; body: string },
  target: string,
  row: TranslationRow,
  started: number,
): Promise<TranslationRow> {
  void row;
  // The English canonical text is the bridge. If it is not ready (being made by
  // another caller, or retrying) this language waits for it, spending no
  // engine work of its own.
  const canonical = await ensureTranslation(deps, message, CANONICAL, { internal: true });
  if (canonical.status !== "completed" || canonical.text === null) {
    const failed = canonical.status === "failed";
    return deps.finish(message.id, target, {
      status: failed ? "failed" : "retrying",
      error: canonical.error ?? "canonical_unavailable",
      retryInSeconds: failed
        ? null
        : Math.max(2, Math.round((canonical.retryAfterMs ?? 3_000) / 1000)),
      refundAttempt: !failed,
      latencyMs: deps.now() - started,
    });
  }

  // Already in the reader's language: nothing to translate.
  if (canonical.sourceLanguage && sameLanguage(canonical.sourceLanguage, target)) {
    return deps.finish(message.id, target, {
      status: "completed",
      text: message.body,
      source: canonical.sourceLanguage,
      identity: true,
      latencyMs: deps.now() - started,
    });
  }
  // Nothing in it to translate.
  if (canonical.identity && !canonical.sourceLanguage && !hasTranslatableText(message.body)) {
    return deps.finish(message.id, target, {
      status: "completed",
      text: message.body,
      identity: true,
      latencyMs: deps.now() - started,
    });
  }

  const result = await translateChunks(deps, canonical.text, CANONICAL, target);
  return deps.finish(message.id, target, {
    status: "completed",
    text: result.text,
    source: canonical.sourceLanguage,
    provider: result.provider,
    model: result.model,
    quality: result.quality,
    latencyMs: deps.now() - started,
  });
}

/** Run `work` over `items` with at most `limit` in flight. */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await work(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}
