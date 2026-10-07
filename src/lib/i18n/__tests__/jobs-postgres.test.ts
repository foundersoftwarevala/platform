import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query =
    vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>>();
  const sql = Object.assign(query, {
    array: (values: string[]) => values,
    begin: async <T>(callback: (transaction: typeof query) => Promise<T>): Promise<T> =>
      callback(query),
  });
  return {
    sql,
    db: vi.fn(async () => sql),
    disabled: vi.fn(async () => new Set<string>()),
    ready: vi.fn(async () => true),
    pipeline: vi.fn(),
    memory: vi.fn(() => ({})),
    glossary: vi.fn(() => ({})),
    workerConfig: vi.fn((): { enabled: boolean; maxLoad: number | null } => ({
      enabled: true,
      maxLoad: null,
    })),
  };
});

vi.mock("../service.server", () => ({
  db: mocks.db,
  disabledLanguages: mocks.disabled,
  engineReachable: mocks.ready,
  getTranslationEngine: () => ({ isAvailable: () => true }),
  translationWorkerConfig: mocks.workerConfig,
  createPostgresMemoryStore: mocks.memory,
  createPostgresGlossaryStore: mocks.glossary,
  QUALITY_ATTEMPTED_MODE: "quality_attempted",
  log: vi.fn(),
}));

vi.mock("../pipeline", async (original) => ({
  ...(await original<typeof import("../pipeline")>()),
  runTranslationPipeline: mocks.pipeline,
}));

vi.mock("../catalogue.server", async (original) => ({
  ...(await original<typeof import("../catalogue.server")>()),
  publicCatalogue: async () => new Set<string>(),
}));

import { enqueueJobs, ensureJobWorker, runJobBatch } from "../jobs.server";

const job = {
  id: "5ae8b021-cb37-4c17-8da1-2b358927d701",
  source_text: "Bonjour",
  source_language: "fr",
  target_language: "hi",
  namespace: "catalogue",
  context: "product",
  refresh: false,
};

function sqlText(strings: TemplateStringsArray): string {
  return strings.join("?");
}

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.db.mockClear();
  mocks.disabled.mockReset().mockResolvedValue(new Set());
  mocks.ready.mockReset().mockResolvedValue(true);
  mocks.pipeline.mockReset().mockResolvedValue({
    outcomes: [{ text: "Bonjour", status: "machine", qualityScore: 0.9, issues: [] }],
  });
  mocks.workerConfig.mockReset().mockReturnValue({ enabled: true, maxLoad: null });
  mocks.sql.mockImplementation(async (strings) => {
    const text = sqlText(strings);
    if (text.includes("i18n_enqueue_translation_jobs")) return [{ queued: 1 }];
    if (text.includes("i18n_claim_translation_jobs")) return [job];
    if (text.includes("for update")) return [{ id: job.id }];
    return [];
  });
});

describe("native PostgreSQL translation jobs", () => {
  it("preserves the service-owned worker disable switch without reading environment variables", () => {
    mocks.workerConfig.mockReturnValue({ enabled: false, maxLoad: null });
    const timeout = vi.spyOn(globalThis, "setTimeout");
    ensureJobWorker();
    expect(timeout).not.toHaveBeenCalled();
    timeout.mockRestore();
  });
  it("enqueues the canonical source-language pair through parameterized JSON", async () => {
    expect(
      await enqueueJobs(
        [{ text: " Bonjour ", source: "fr", target: "hi", namespace: "catalogue" }],
        null,
      ),
    ).toBe(1);
    const call = mocks.sql.mock.calls[0]!;
    expect(sqlText(call[0])).toContain("public.i18n_enqueue_translation_jobs");
    expect(JSON.parse(String(call[1]))).toEqual([
      expect.objectContaining({
        source_text: "Bonjour",
        source_language: "fr",
        target_language: "hi",
        requested_by: null,
      }),
    ]);
  });

  it("defaults the source to English", async () => {
    await enqueueJobs([{ text: "Hello", target: "hi", namespace: "catalogue" }], null);
    expect(JSON.parse(String(mocks.sql.mock.calls[0]![1]))[0].source_language).toBe("en");
  });

  it("never enqueues disabled source or target languages", async () => {
    mocks.disabled.mockResolvedValue(new Set(["fr", "hi"]));
    expect(
      await enqueueJobs(
        [
          { text: "Bonjour", source: "fr", target: "es", namespace: "catalogue" },
          { text: "Hello", target: "hi", namespace: "catalogue" },
        ],
        null,
      ),
    ).toBe(0);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it.each(["chat", "ui"])("does not persist private text in namespace %s", async (namespace) => {
    await expect(
      enqueueJobs([{ text: "Private customer order 7744", target: "hi", namespace }], null),
    ).rejects.toThrow("cannot be persisted");
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("guards concurrent callers before awaiting engine readiness", async () => {
    let release: ((ready: boolean) => void) | undefined;
    mocks.ready.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        }),
    );
    const first = runJobBatch();
    await vi.waitFor(() => expect(mocks.ready).toHaveBeenCalledOnce());
    expect(await runJobBatch()).toMatchObject({
      skipped: true,
      reason: "a batch is already running",
    });
    release!(true);
    expect(await first).toMatchObject({ claimed: 1, done: 1, retried: 0 });
    expect(
      mocks.sql.mock.calls.filter(([strings]) =>
        sqlText(strings).includes("i18n_claim_translation_jobs"),
      ),
    ).toHaveLength(1);
  });

  it("does not claim leases while the engine is unavailable", async () => {
    mocks.ready.mockResolvedValue(false);
    expect(await runJobBatch()).toMatchObject({ skipped: true, reason: "engine not reachable" });
    expect(mocks.sql).not.toHaveBeenCalled();
    mocks.ready.mockResolvedValue(true);
    expect(await runJobBatch()).toMatchObject({ done: 1 });
  });

  it("uses the claimed source pair and the native stores", async () => {
    expect(await runJobBatch()).toMatchObject({ claimed: 1, done: 1 });
    expect(mocks.pipeline).toHaveBeenCalledWith(
      expect.objectContaining({ source: "fr", target: "hi", persist: true, mode: "quality" }),
      expect.objectContaining({ memory: {}, glossary: {} }),
    );
    expect(mocks.memory).toHaveBeenCalledWith(mocks.sql);
    expect(mocks.glossary).toHaveBeenCalledWith(mocks.sql);
    const claim = mocks.sql.mock.calls.find(([strings]) =>
      sqlText(strings).includes("i18n_claim_translation_jobs"),
    );
    expect(claim?.[2]).toBe(24);
    expect(sqlText(claim![0])).toContain("900::int");
  });

  it("propagates a finish error instead of reporting success or finishing twice", async () => {
    mocks.sql.mockImplementation(async (strings) => {
      const text = sqlText(strings);
      if (text.includes("i18n_claim_translation_jobs")) return [job];
      if (text.includes("for update")) return [{ id: job.id }];
      throw new Error("finish write failed");
    });
    await expect(runJobBatch()).rejects.toThrow("finish write failed");
    expect(
      mocks.sql.mock.calls.filter(([strings]) =>
        sqlText(strings).includes("i18n_finish_translation_job"),
      ),
    ).toHaveLength(1);
  });

  it("does not finish a job after its lease is lost", async () => {
    mocks.sql.mockImplementation(async (strings) =>
      sqlText(strings).includes("i18n_claim_translation_jobs") ? [job] : [],
    );
    await expect(runJobBatch()).rejects.toThrow("lease lost");
    expect(
      mocks.sql.mock.calls.some(([strings]) =>
        sqlText(strings).includes("i18n_finish_translation_job"),
      ),
    ).toBe(false);
  });

  it("records pending results as retries", async () => {
    mocks.pipeline.mockResolvedValue({ outcomes: [], pendingReason: "engine unavailable" });
    expect(await runJobBatch()).toMatchObject({ done: 0, retried: 1 });
    const finish = mocks.sql.mock.calls.find(([strings]) =>
      sqlText(strings).includes("i18n_finish_translation_job"),
    )!;
    expect(finish[3]).toBe(false);
    expect(finish[4]).toBe("pending");
  });

  it("refuses old private jobs without sending their text to the engine", async () => {
    mocks.sql.mockImplementation(async (strings) => {
      if (sqlText(strings).includes("i18n_claim_translation_jobs"))
        return [{ ...job, namespace: "chat" }];
      if (sqlText(strings).includes("for update")) return [{ id: job.id }];
      return [];
    });
    expect(await runJobBatch()).toMatchObject({ done: 0, retried: 1 });
    expect(mocks.pipeline).not.toHaveBeenCalled();
  });
});
