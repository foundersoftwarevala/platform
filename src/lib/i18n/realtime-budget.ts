/**
 * The time a visitor's translation request may wait for the engine, and the
 * sharing of engine work between requests for the same batch.
 *
 * The first visitor to choose a language the platform has not translated yet
 * sends the page's text to the engine, and a batch can take longer than the
 * proxy in front of the application waits (60 s): the browser got a 504 while
 * the engine was still working. /api/marketplace/translate therefore waits at
 * most REALTIME_BUDGET_MS; past it, it answers with what translation memory
 * already holds and `pending_reason: "in_progress"`, and the engine carries on
 * and stores its result. The page asks again shortly (retryAfterFor) and gets
 * it from memory.
 *
 * While the engine is still on a batch, the page's repeat request for the same
 * batch joins that work (joinOrStart) instead of starting a second translation
 * of the same text, which only lengthened the engine's queue for everyone.
 */

export const REALTIME_BUDGET_MS = 20_000;

/** Seconds the page waits before asking again for a batch still being translated. */
export const IN_PROGRESS_RETRY_SECONDS = 10;

export type BudgetOutcome<T> = { done: true; value: T } | { done: false };

/**
 * Waits for `work` at most `ms`. `work` is not cancelled when the budget runs
 * out; the caller decides what to do with it (it keeps running).
 */
export async function withinBudget<T>(work: Promise<T>, ms: number): Promise<BudgetOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<"budget">((resolve) => {
    timer = setTimeout(() => resolve("budget"), ms);
  });
  try {
    const first = await Promise.race([work.then((value) => ({ value })), budget]);
    return first === "budget" ? { done: false } : { done: true, value: first.value };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The work already running under `key`, or `start()` registered under it. The
 * entry is removed when the work settles, whether it succeeded or failed.
 */
export function joinOrStart<T>(
  inFlight: Map<string, Promise<unknown>>,
  key: string,
  start: () => Promise<T>,
): { work: Promise<T>; joined: boolean } {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return { work: existing, joined: true };
  const work = start();
  inFlight.set(key, work);
  const done = () => {
    if (inFlight.get(key) === work) inFlight.delete(key);
  };
  work.then(done, done);
  return { work, joined: false };
}

/** One batch: the same texts, language, namespace and context. */
export function batchKey(
  target: string,
  namespace: string,
  context: string | null | undefined,
  texts: string[],
): string {
  return [target, namespace, context ?? "", ...texts].join("");
}

/**
 * How long the page waits before asking again, from the endpoint's
 * `pending_reason`. Null: nothing to retry.
 */
export function retryAfterFor(pendingReason: string | null | undefined): number | null {
  switch (pendingReason) {
    case "quota_exceeded":
      return 3600;
    case "engine_unavailable":
      return 15;
    // Still being translated: not an engine failure, so no backoff.
    case "in_progress":
      return IN_PROGRESS_RETRY_SECONDS;
    default:
      return null;
  }
}
