import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query =
    vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>>();
  const sql = Object.assign(query, {
    begin: async <T>(callback: (transaction: typeof query) => Promise<T>): Promise<T> =>
      callback(query),
  });
  return {
    sql,
    enqueue: vi.fn(async () => 1),
    invalidate: vi.fn(),
    languageOverrides: vi.fn(),
    resolveCaller: vi.fn(),
  };
});

vi.mock("../service.server", () => ({
  db: async () => mocks.sql,
  engineReachable: async () => true,
  getTranslationEngine: () => ({ isAvailable: () => true, describe: () => [] }),
  translationEngineStatus: async () => ({
    configured: true,
    reachable: true,
    ready: true,
    providers: [],
  }),
  translationEngineCounters: async () => ({ svt_requests_total: 12 }),
  invalidateLanguageOverrides: mocks.languageOverrides,
  invalidateTranslationCaches: mocks.invalidate,
  translationCacheStats: vi.fn(),
  resolveCaller: mocks.resolveCaller,
}));

vi.mock("../jobs.server", () => ({
  enqueueJobs: mocks.enqueue,
  enqueueCatalogue: vi.fn(),
  runJobBatch: vi.fn(),
  syncMessageCatalogue: vi.fn(),
  translatableLanguages: () => [],
}));

import {
  engineStatus,
  glossaryList,
  metrics,
  performAction,
  requireLanguageOperator,
  reviewQueue,
  revisions,
} from "../admin.server";

const caller = {
  tier: "operator" as const,
  subject: "user:5ae8b021-cb37-4c17-8da1-2b358927d702",
  userId: "5ae8b021-cb37-4c17-8da1-2b358927d702",
};
const id = "5ae8b021-cb37-4c17-8da1-2b358927d701";
const row = {
  id,
  status: "machine",
  source_text: "Bonjour",
  translated_text: "नमस्ते",
  source_language: "fr",
  target_language: "hi",
  namespace: "catalogue",
  context: "product",
  source_hash: "a".repeat(32),
  context_hash: "b".repeat(32),
};

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.enqueue.mockClear();
  mocks.invalidate.mockClear();
  mocks.languageOverrides.mockClear();
  mocks.resolveCaller.mockReset();
});

describe("native PostgreSQL language administration", () => {
  it("resolves native HttpOnly cookie authentication for operators", async () => {
    mocks.resolveCaller.mockResolvedValue(caller);
    const token = "a".repeat(64);
    const request = new Request("https://example.test/api/i18n/admin", {
      headers: { cookie: `__Host-sv_language_session=${token}` },
    });
    expect(await requireLanguageOperator(request)).toEqual(caller);
    expect(mocks.resolveCaller).toHaveBeenCalledWith(`Bearer ${token}`, "operator", null);
  });

  it("preserves explicit authorization precedence and denies anonymous callers", async () => {
    mocks.resolveCaller.mockResolvedValue({
      tier: "anonymous",
      subject: "anonymous",
      userId: null,
    });
    const request = new Request("https://example.test/api/i18n/admin", {
      headers: {
        authorization: "Bearer explicit",
        cookie: `__Host-sv_language_session=${"a".repeat(64)}`,
      },
    });
    const response = await requireLanguageOperator(request);
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) throw new Error("Expected an authorization response.");
    expect(response.status).toBe(401);
    expect(mocks.resolveCaller).toHaveBeenCalledWith("Bearer explicit", "operator", null);
  });

  it("preserves engine readiness and counters through the service-owned health boundary", async () => {
    mocks.sql.mockResolvedValue([{ status: "queued", jobs: "23" }]);
    expect(await engineStatus()).toMatchObject({ configured: true, ready: true });
    expect(await metrics()).toMatchObject({
      database: { reachable: true },
      queue: { queued: 23 },
      engine: { ready: true, counters: { svt_requests_total: 12 } },
    });
  });

  it("reports a failed queue metrics query as unreachable rather than a healthy empty queue", async () => {
    mocks.sql.mockRejectedValue(new Error("database unavailable"));
    expect(await metrics()).toMatchObject({ database: { reachable: false }, queue: {} });
  });
  it("keeps the exact review count for an empty page and parameterizes literal search text", async () => {
    mocks.sql.mockImplementation(async (strings) =>
      strings.join("?").includes("count(*)") ? [{ total: "23" }] : [],
    );
    expect(
      await reviewQueue(
        new URLSearchParams({
          language: "fr",
          q: "100%_\\' OR 1=1 --",
          offset: "100",
        }),
      ),
    ).toEqual({ rows: [], total: 23 });
    const filters = mocks.sql.mock.calls.flatMap((call) => call.slice(1));
    expect(filters).toContain(100);
    expect(mocks.sql.mock.calls.every(([strings]) => !strings.join("?").includes("OR 1=1"))).toBe(
      true,
    );
  });

  it("validates the selected language before querying", async () => {
    await expect(reviewQueue(new URLSearchParams({ language: "not-a-language" }))).rejects.toThrow(
      "Unknown language",
    );
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("reads revisions and glossary from existing public tables", async () => {
    mocks.sql.mockResolvedValue([]);
    expect(await revisions(id)).toEqual({ revisions: [] });
    expect(await glossaryList()).toEqual({ terms: [] });
    expect(mocks.sql.mock.calls[0]![0].join("?")).toContain("public.i18n_translation_revisions");
    expect(mocks.sql.mock.calls[0]![1]).toBe(id);
    expect(mocks.sql.mock.calls[1]![0].join("?")).toContain("public.i18n_glossary_terms");
  });

  it("propagates PostgreSQL errors instead of returning an empty success", async () => {
    mocks.sql.mockRejectedValue(new Error("database unavailable"));
    await expect(glossaryList()).rejects.toThrow("database unavailable");
  });

  it("marks a manual edit verified with a review note", async () => {
    mocks.sql.mockResolvedValue([
      { id, status: "verified", translated_text: "Human text", version: 2 },
    ]);
    expect(
      await performAction({ action: "review", id, decision: "verify", text: "Human text" }, caller),
    ).toMatchObject({ status: "verified", translated_text: "Human text" });
    const [strings, ...values] = mocks.sql.mock.calls[0]!;
    expect(strings.join("?")).toContain("review_note");
    expect(values).toContain("verified");
    expect(values).toContain("Human text");
    expect(values).toContain(caller.userId);
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it("never overwrites a row that became verified before the stale update", async () => {
    mocks.sql.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    await expect(
      performAction({ action: "review", id, decision: "retranslate" }, caller),
    ).rejects.toThrow("verified translation is locked");
    expect(mocks.sql.mock.calls[1]![0].join("?")).toContain("status <> 'verified'");
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("retranslates and reprioritizes the original source pair", async () => {
    mocks.sql
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ id }])
      .mockResolvedValueOnce([{ id }]);
    expect(
      await performAction({ action: "review", id, decision: "retranslate" }, caller),
    ).toMatchObject({ status: "stale", queued: 1 });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      [expect.objectContaining({ source: "fr", text: "Bonjour", target: "hi" })],
      caller.userId,
    );
    const [strings, ...values] = mocks.sql.mock.calls[2]!;
    expect(strings.join("?")).toContain("source_language =");
    expect(values).toContain("fr");
  });

  it("allows an explicit source language in console enqueue actions", async () => {
    expect(
      await performAction(
        {
          action: "enqueue_texts",
          source: "fr",
          texts: ["Bonjour"],
          languages: ["hi"],
        },
        caller,
      ),
    ).toEqual({ queued: 1 });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      [expect.objectContaining({ source: "fr", text: "Bonjour", namespace: "catalogue" })],
      caller.userId,
    );
  });

  it("does not claim a language switch succeeded when its row is absent", async () => {
    mocks.sql.mockResolvedValue([]);
    await expect(
      performAction({ action: "set_language_enabled", code: "hi", enabled: false }, caller),
    ).rejects.toThrow("Language not found");
    expect(mocks.languageOverrides).not.toHaveBeenCalled();
  });
});
