import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = { sql: string; values: unknown[] };
type MockTx = <Rows extends unknown[]>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Rows>;

const database = vi.hoisted(() => ({ calls: [] as QueryCall[], results: [] as unknown[][] }));
vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: async <T>(run: (tx: MockTx) => Promise<T>) => {
    const tx: MockTx = async <Rows extends unknown[]>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      database.calls.push({ sql: strings.join("?"), values });
      return (database.results.shift() ?? []) as Rows;
    };
    return run(tx);
  },
}));

import { recallFacts, rememberFact } from "./ayra-memory.server";

const USER_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  database.calls = [];
  database.results = [];
  vi.stubEnv("AYRA_EMBEDDING_MODEL", "local-embed-1536");
  vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AYRA private VPS memory", () => {
  it("embeds locally and stores facts in user-scoped VPS Postgres", async () => {
    database.results = [
      [{ id: "00000000-0000-4000-8000-000000000002", created_at: "2026-10-28T00:00:00Z" }],
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ embeddings: [Array.from({ length: 1536 }, (_, index) => index / 1536)] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(rememberFact(USER_ID, "Use IST for reporting.")).resolves.toEqual({
      id: "00000000-0000-4000-8000-000000000002",
      createdAt: "2026-10-28T00:00:00Z",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:11434/api/embed");
    expect(database.calls).toHaveLength(1);
    expect(database.calls[0]?.sql).toContain("public.ayra_memory_vectors");
    expect(database.calls[0]?.sql).toContain("returning id::text");
    expect(database.calls[0]?.values).toContain(USER_ID);
  });

  it("rejects wrong embedding dimensions without writing to Postgres", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ embeddings: [Array(1535).fill(0)] })),
    );
    await expect(rememberFact(USER_ID, "Do not save malformed vectors.")).rejects.toThrow(
      "exactly 1536 dimensions",
    );
    expect(database.calls).toHaveLength(0);
  });

  it("returns the top five facts for the same user using pgvector", async () => {
    database.results = [
      [
        {
          id: "00000000-0000-4000-8000-000000000002",
          content: "Use IST.",
          similarity: 0.9,
          created_at: "2026-10-28T00:00:00Z",
        },
      ],
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ embeddings: [Array(1536).fill(0.1)] })),
    );
    const result = await recallFacts(USER_ID, "What timezone should reports use?");

    expect(result.status).toBe("ready");
    expect(result.facts).toHaveLength(1);
    expect(database.calls[0]?.sql).toContain("embedding <=>");
    expect(database.calls[0]?.sql).toContain("limit 5");
    expect(database.calls[0]?.values).toContain(USER_ID);
  });

  it("reports disabled memory without calling Ollama or the database", async () => {
    vi.stubEnv("AYRA_EMBEDDING_MODEL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(recallFacts(USER_ID, "Relevant past fact?")).resolves.toMatchObject({
      status: "not_configured",
      facts: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(database.calls).toHaveLength(0);
  });
});
