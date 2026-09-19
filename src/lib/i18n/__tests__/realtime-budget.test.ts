import { afterEach, describe, expect, it, vi } from "vitest";

import { action } from "../admin.server";
import {
  IN_PROGRESS_RETRY_SECONDS,
  REALTIME_BUDGET_MS,
  batchKey,
  joinOrStart,
  retryAfterFor,
  withinBudget,
} from "../realtime-budget";

afterEach(() => {
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("request budget", () => {
  it("is 20 seconds, well inside the proxy's 60", () => {
    expect(REALTIME_BUDGET_MS).toBe(20_000);
  });

  it("returns the result when the engine answers in time", async () => {
    await expect(withinBudget(Promise.resolve("done"), 1000)).resolves.toEqual({ done: true, value: "done" });
  });

  it("answers at the budget while the engine keeps working, and does not cancel it", async () => {
    vi.useFakeTimers();
    const engine = deferred<string>();
    const outcome = withinBudget(engine.promise, REALTIME_BUDGET_MS);
    await vi.advanceTimersByTimeAsync(REALTIME_BUDGET_MS);
    await expect(outcome).resolves.toEqual({ done: false });
    // The work finishes later and its result is still there for whoever waits on it.
    engine.resolve("stored");
    await expect(engine.promise).resolves.toBe("stored");
  });

  it("passes an engine failure inside the budget through", async () => {
    await expect(withinBudget(Promise.reject(new Error("engine")), 1000)).rejects.toThrow("engine");
  });
});

describe("one translation run per batch", () => {
  it("a retry for the same batch joins the run in progress", async () => {
    const inFlight = new Map<string, Promise<unknown>>();
    const engine = deferred<string>();
    const start = vi.fn(() => engine.promise);
    const key = batchKey("am", "ui", null, ["Buy Now", "Live Demo"]);
    const first = joinOrStart(inFlight, key, start);
    const retry = joinOrStart(inFlight, key, start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(first.joined).toBe(false);
    expect(retry.joined).toBe(true);
    expect(retry.work).toBe(first.work);
    engine.resolve("ok");
    await first.work;
    // Settled work is forgotten, so a later request asks again (memory answers it).
    await Promise.resolve();
    expect(inFlight.size).toBe(0);
  });

  it("a failed run is forgotten too, so the batch can be tried again", async () => {
    const inFlight = new Map<string, Promise<unknown>>();
    const { work } = joinOrStart(inFlight, "k", () => Promise.reject(new Error("busy")));
    await expect(work).rejects.toThrow("busy");
    await Promise.resolve();
    expect(inFlight.has("k")).toBe(false);
  });

  it("different languages, contexts or texts are different batches", () => {
    const base = batchKey("am", "ui", null, ["Buy Now"]);
    expect(batchKey("ti", "ui", null, ["Buy Now"])).not.toBe(base);
    expect(batchKey("am", "ui", "marketplace", ["Buy Now"])).not.toBe(base);
    expect(batchKey("am", "ui", null, ["Buy Now", "Live Demo"])).not.toBe(base);
    expect(batchKey("am", "ui", undefined, ["Buy Now"])).toBe(base);
  });
});

describe("page retry", () => {
  it("asks again shortly while a batch is in progress", () => {
    expect(retryAfterFor("in_progress")).toBe(IN_PROGRESS_RETRY_SECONDS);
    expect(IN_PROGRESS_RETRY_SECONDS).toBe(10);
  });

  it("keeps the existing waits for the other reasons", () => {
    expect(retryAfterFor("engine_unavailable")).toBe(15);
    expect(retryAfterFor("quota_exceeded")).toBe(3600);
    expect(retryAfterFor(null)).toBeNull();
    expect(retryAfterFor("memory_only")).toBeNull();
  });
});

describe("enqueue texts priority", () => {
  const base = { action: "enqueue_texts", texts: ["Buy Now"], languages: "all" } as const;

  it("defaults to the ordinary priority", () => {
    const parsed = action.parse(base);
    expect(parsed.action === "enqueue_texts" && parsed.priority).toBe(100);
  });

  it("accepts a higher priority for a page's text", () => {
    const parsed = action.parse({ ...base, priority: 20 });
    expect(parsed.action === "enqueue_texts" && parsed.priority).toBe(20);
  });

  it("refuses priorities outside 1-100", () => {
    expect(() => action.parse({ ...base, priority: 0 })).toThrow();
    expect(() => action.parse({ ...base, priority: 101 })).toThrow();
    expect(() => action.parse({ ...base, priority: 2.5 })).toThrow();
  });
});
