import { describe, expect, it, vi } from "vitest";

import { TranslationEngine } from "../engine/engine";
import {
  buildTranslationPrompt,
  createAiApiManagerProvider,
} from "../engine/providers/ai-api-manager";
import { createOwnedEngineProvider } from "../engine/providers/owned-engine";
import {
  EngineUnavailableError,
  type EngineRequest,
  type EngineResponse,
  type TranslationProvider,
} from "../engine/types";
import type { GlossaryTerm } from "../glossary";
import { contextHash, sourceHash } from "../hash";
import {
  PipelineError,
  looksLikeProductName,
  runTranslationPipeline,
  type MemoryEntry,
  type MemoryRecord,
  type TranslationMemoryStore,
} from "../pipeline";
import { getLanguage } from "../registry";
import { UI_DICTIONARY } from "../ui-dictionary";

/**
 * Test doubles. Providers answer only with translations taken from the
 * reviewed UI dictionaries, so nothing here is an invented translation.
 */
const HINDI = UI_DICTIONARY.hi!;
const SPANISH = UI_DICTIONARY.es!;

function dictionaryProvider(
  id = "owned-engine",
  kind: "owned" | "external" = "owned",
  overrides: Record<string, string> = {},
): TranslationProvider & { calls: EngineRequest[] } {
  const calls: EngineRequest[] = [];
  return {
    id,
    kind,
    calls,
    isConfigured: () => true,
    supports: () => true,
    async translate(request): Promise<EngineResponse> {
      calls.push(request);
      return {
        provider: id,
        providerKind: kind,
        model: "test-model",
        version: "1",
        segments: request.segments.flatMap((segment) => {
          const text = overrides[segment.text] ?? HINDI[segment.text];
          return text === undefined ? [] : [{ id: segment.id, text, confidence: 0.9 }];
        }),
      };
    },
  };
}

function unconfigured(id: string, kind: "owned" | "external"): TranslationProvider {
  return {
    id,
    kind,
    isConfigured: () => false,
    supports: () => true,
    translate: () => Promise.reject(new Error("must not be called")),
  };
}

class MemoryStore implements TranslationMemoryStore {
  rows: (MemoryRecord | (MemoryEntry & { sourceLanguage: string; targetLanguage: string }))[] = [];
  saved: MemoryRecord[] = [];

  async lookup(query: { sourceLanguage: string; targetLanguage: string; sourceHashes: string[] }) {
    const found = new Map<string, MemoryEntry>();
    for (const row of this.rows) {
      if (
        row.sourceLanguage !== query.sourceLanguage ||
        row.targetLanguage !== query.targetLanguage
      )
        continue;
      if (!query.sourceHashes.includes(row.sourceHash)) continue;
      found.set(`${row.sourceHash}:${row.contextHash}`, {
        sourceHash: row.sourceHash,
        contextHash: row.contextHash,
        translatedText: row.translatedText,
        status: row.status,
        qualityScore: row.qualityScore,
        version: "version" in row ? row.version : 1,
        engine: row.engine,
      });
    }
    return found;
  }

  async save(records: MemoryRecord[]) {
    this.saved.push(...records);
    this.rows.push(...records);
  }
}

const engineWith = (...providers: TranslationProvider[]) =>
  new TranslationEngine(providers, { allowExternal: true });

describe("translation pipeline", () => {
  it("rejects an unsupported language before doing any work", async () => {
    const provider = dictionaryProvider();
    await expect(
      runTranslationPipeline(
        { texts: ["Apply Now"], source: "en", target: "AR9" },
        { engine: engineWith(provider) },
      ),
    ).rejects.toMatchObject({ reason: "invalid_language" });
    await expect(
      runTranslationPipeline(
        { texts: ["Apply Now"], source: "xx", target: "hi" },
        { engine: engineWith(provider) },
      ),
    ).rejects.toBeInstanceOf(PipelineError);
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects a language an operator disabled", async () => {
    await expect(
      runTranslationPipeline(
        { texts: ["Apply Now"], source: "en", target: "hi" },
        { engine: engineWith(dictionaryProvider()), isLanguageEnabled: (code) => code !== "hi" },
      ),
    ).rejects.toMatchObject({ reason: "invalid_language" });
  });

  it("rejects an invalid namespace or oversized context", async () => {
    const engine = engineWith(dictionaryProvider());
    await expect(
      runTranslationPipeline(
        { texts: ["x"], source: "en", target: "hi", namespace: "Bad Space" },
        { engine },
      ),
    ).rejects.toMatchObject({ reason: "invalid_request" });
    await expect(
      runTranslationPipeline(
        { texts: ["x"], source: "en", target: "hi", context: "c".repeat(501) },
        { engine },
      ),
    ).rejects.toMatchObject({ reason: "invalid_request" });
  });

  it("returns the source unchanged for the source language and its regional varieties", async () => {
    const provider = dictionaryProvider();
    for (const target of ["en", "EN", "en-GB", "en-IN"]) {
      const result = await runTranslationPipeline(
        { texts: ["Apply Now"], source: "en", target },
        { engine: engineWith(provider) },
      );
      expect(result.outcomes[0]).toMatchObject({ translation: "Apply Now", status: "source" });
    }
    expect(provider.calls).toHaveLength(0);
  });

  it("translates, validates and stores under canonical languages", async () => {
    const memory = new MemoryStore();
    const provider = dictionaryProvider();
    const result = await runTranslationPipeline(
      { texts: ["Apply Now", "Language", "Apply Now"], source: "en", target: "HI", persist: true },
      { engine: engineWith(provider), memory },
    );

    expect(result.target.code).toBe("hi");
    expect(result.outcomes.map((o) => [o.text, o.translation, o.status, o.origin])).toEqual([
      ["Apply Now", HINDI["Apply Now"], "machine", "engine"],
      ["Language", HINDI.Language, "machine", "engine"],
    ]);
    expect(provider.calls[0]!.target.code).toBe("hi");
    expect(provider.calls[0]!.segments).toHaveLength(2); // de-duplicated
    expect(memory.saved).toHaveLength(2);
    expect(memory.saved[0]).toMatchObject({
      sourceLanguage: "en",
      targetLanguage: "hi",
      status: "machine",
      engine: "owned-engine",
      providerKind: "owned",
      sourceHash: await sourceHash("Apply Now"),
      contextHash: await contextHash("ui", null),
    });
  });

  it("answers the second request from memory, whichever spelling of the language is used", async () => {
    const memory = new MemoryStore();
    const provider = dictionaryProvider();
    const deps = { engine: engineWith(provider), memory };
    await runTranslationPipeline(
      { texts: ["Apply Now"], source: "en", target: "hi", persist: true },
      deps,
    );
    for (const target of ["HI", "Hindi", "hi-IN"]) {
      const result = await runTranslationPipeline(
        { texts: ["Apply Now"], source: "en", target, persist: true },
        deps,
      );
      expect(result.outcomes[0]).toMatchObject({
        translation: HINDI["Apply Now"],
        origin: "memory",
      });
    }
    expect(provider.calls).toHaveLength(1);
    expect(memory.saved).toHaveLength(1);
  });

  it("prefers a verified translation and never re-asks for rejected or queued ones", async () => {
    const memory = new MemoryStore();
    const ctx = await contextHash("ui", null);
    memory.rows.push(
      {
        sourceHash: await sourceHash("Language"),
        contextHash: ctx,
        sourceLanguage: "en",
        targetLanguage: "hi",
        translatedText: HINDI.Language!,
        status: "verified",
        qualityScore: 1,
        version: 2,
        engine: null,
      },
      {
        sourceHash: await sourceHash("Apply Now"),
        contextHash: ctx,
        sourceLanguage: "en",
        targetLanguage: "hi",
        translatedText: "x",
        status: "needs_review",
        qualityScore: 0.1,
        version: 1,
        engine: "owned-engine",
      },
    );
    const provider = dictionaryProvider();
    const result = await runTranslationPipeline(
      { texts: ["Language", "Apply Now"], source: "en", target: "hi", persist: true },
      { engine: engineWith(provider), memory },
    );
    expect(result.outcomes).toMatchObject([
      { status: "verified", translation: HINDI.Language, origin: "memory" },
      { status: "needs_review", translation: null, origin: "memory" },
    ]);
    expect(provider.calls).toHaveLength(0);
  });

  it("keeps memory separate per context", async () => {
    const memory = new MemoryStore();
    const provider = dictionaryProvider();
    const deps = { engine: engineWith(provider), memory };
    await runTranslationPipeline(
      { texts: ["Language"], source: "en", target: "hi", persist: true },
      deps,
    );
    await runTranslationPipeline(
      { texts: ["Language"], source: "en", target: "hi", persist: true, context: "settings menu" },
      deps,
    );
    expect(provider.calls).toHaveLength(2);
    expect(new Set(memory.saved.map((r) => r.contextHash)).size).toBe(2);
  });

  it("does not return output that fails validation, and stores it for review", async () => {
    const memory = new MemoryStore();
    // The dictionary's Arabic text sent back for a Hindi request: wrong script.
    const provider = dictionaryProvider("owned-engine", "owned", {
      Language: UI_DICTIONARY.ar!.Language!,
    });
    const result = await runTranslationPipeline(
      { texts: ["Language"], source: "en", target: "hi", persist: true },
      { engine: engineWith(provider), memory },
    );
    expect(result.outcomes[0]).toMatchObject({ translation: null, status: "needs_review" });
    expect(result.outcomes[0]!.issues).toContain("wrong_script");
    expect(memory.saved[0]).toMatchObject({ status: "needs_review" });
    expect(result.stats.needsReview).toBe(1);
  });

  it("keeps private text out of memory entirely", async () => {
    const memory = new MemoryStore();
    const lookup = vi.spyOn(memory, "lookup");
    const result = await runTranslationPipeline(
      { texts: ["Apply Now"], source: null, target: "hi", namespace: "chat", persist: false },
      { engine: engineWith(dictionaryProvider()), memory },
    );
    expect(result.outcomes[0]!.translation).toBe(HINDI["Apply Now"]);
    expect(result.source).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
    expect(memory.saved).toHaveLength(0);
  });

  it("refuses to store private text even when the caller asks for it", async () => {
    const memory = new MemoryStore();
    const lookup = vi.spyOn(memory, "lookup");
    const result = await runTranslationPipeline(
      { texts: ["Apply Now"], source: "en", target: "hi", namespace: "chat", persist: true },
      { engine: engineWith(dictionaryProvider()), memory },
    );
    expect(result.outcomes[0]!.translation).toBe(HINDI["Apply Now"]);
    expect(lookup).not.toHaveBeenCalled();
    expect(memory.saved).toHaveLength(0);
  });

  it("honours mayPersist", async () => {
    const memory = new MemoryStore();
    await runTranslationPipeline(
      {
        texts: ["Apply Now", "Language"],
        source: "en",
        target: "hi",
        persist: true,
        mayPersist: (t) => t === "Language",
      },
      { engine: engineWith(dictionaryProvider()), memory },
    );
    expect(memory.saved.map((r) => r.sourceText)).toEqual(["Language"]);
  });

  it("protects locked glossary terms from the engine", async () => {
    const provider = dictionaryProvider();
    const locked: GlossaryTerm = {
      sourceTerm: "Language",
      targetTerm: null,
      sourceLanguage: "en",
      targetLanguage: null,
      rule: "locked",
      caseSensitive: true,
      namespace: null,
    };
    const result = await runTranslationPipeline(
      { texts: ["Open Language settings"], source: "en", target: "hi" },
      { engine: engineWith(provider), glossary: { load: async () => [locked] } },
    );
    // The term reaches the engine as a token it must return untouched.
    expect(provider.calls[0]!.segments[0]!.text).toBe("Open ⟦T0⟧ settings");
    expect(result.outcomes[0]!.status).not.toBe("source");
  });

  it("stops before the engine when the caller is over quota", async () => {
    const provider = dictionaryProvider();
    const quota = vi.fn(async () => false);
    await expect(
      runTranslationPipeline(
        { texts: ["Apply Now"], source: "en", target: "hi" },
        { engine: engineWith(provider), quota },
      ),
    ).rejects.toMatchObject({ reason: "quota_exceeded" });
    expect(quota).toHaveBeenCalledWith("Apply Now".length);
    expect(provider.calls).toHaveLength(0);
  });

  it("answers from memory and reports the rest pending when no engine is available", async () => {
    const memory = new MemoryStore();
    await runTranslationPipeline(
      { texts: ["Language"], source: "en", target: "hi", persist: true },
      { engine: engineWith(dictionaryProvider()), memory },
    );
    const noEngine = new TranslationEngine([unconfigured("owned-engine", "owned")], {
      allowExternal: true,
    });
    const partial = await runTranslationPipeline(
      { texts: ["Language", "Apply Now"], source: "en", target: "hi", persist: true },
      { engine: noEngine, memory },
    );
    expect(partial.pendingReason).toBe("engine_unavailable");
    expect(partial.outcomes).toMatchObject([
      { status: "machine", origin: "memory" },
      { status: "pending", translation: null },
    ]);
    await expect(
      runTranslationPipeline(
        { texts: ["Apply Now"], source: "en", target: "hi" },
        { engine: noEngine },
      ),
    ).rejects.toMatchObject({ reason: "engine_unavailable" });
  });

  it("answers from memory only when asked to", async () => {
    const provider = dictionaryProvider();
    const result = await runTranslationPipeline(
      { texts: ["Apply Now"], source: "en", target: "hi", memoryOnly: true },
      { engine: engineWith(provider) },
    );
    expect(result.pendingReason).toBe("memory_only");
    expect(provider.calls).toHaveLength(0);
  });
});

describe("translation engine", () => {
  const request: EngineRequest = {
    mode: "realtime",
    source: getLanguage("en")!,
    target: getLanguage("hi")!,
    segments: [{ id: "0", text: "Apply Now", namespace: "ui", context: null }],
    glossary: [],
  };

  it("uses the first configured provider", async () => {
    const owned = dictionaryProvider("owned-engine", "owned");
    const external = dictionaryProvider("ai-api-manager", "external");
    const response = await engineWith(owned, external).translate(request);
    expect(response.provider).toBe("owned-engine");
    expect(external.calls).toHaveLength(0);
  });

  it("moves to the next provider when one is not configured or fails", async () => {
    const failing: TranslationProvider = {
      ...dictionaryProvider("owned-engine"),
      translate: () => Promise.reject(new Error("down")),
    };
    const external = dictionaryProvider("ai-api-manager", "external");
    const engine = engineWith(unconfigured("first", "owned"), failing, external);
    const response = await engine.translate(request);
    expect(response).toMatchObject({ provider: "ai-api-manager", providerKind: "external" });
  });

  it("never uses an external provider when external use is off", async () => {
    const external = dictionaryProvider("ai-api-manager", "external");
    const engine = new TranslationEngine([unconfigured("owned-engine", "owned"), external], {
      allowExternal: false,
    });
    expect(engine.isAvailable()).toBe(false);
    const error = await engine.translate(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EngineUnavailableError);
    expect((error as EngineUnavailableError).attempts.map((a) => a.outcome)).toEqual([
      "not_configured",
      "skipped_external",
    ]);
    expect(external.calls).toHaveLength(0);
  });

  it("drops answers for segments that were not asked", async () => {
    const chatty: TranslationProvider = {
      ...dictionaryProvider(),
      translate: async () => ({
        provider: "owned-engine",
        providerKind: "owned",
        model: null,
        version: null,
        segments: [
          { id: "0", text: HINDI["Apply Now"]!, confidence: null },
          { id: "99", text: "extra", confidence: null },
        ],
      }),
    };
    const response = await engineWith(chatty).translate(request);
    expect(response.segments.map((s) => s.id)).toEqual(["0"]);
  });
});

describe("owned engine provider", () => {
  it("is not configured without a valid endpoint", () => {
    expect(createOwnedEngineProvider({}).isConfigured()).toBe(false);
    expect(createOwnedEngineProvider({ endpoint: "not a url" }).isConfigured()).toBe(false);
    expect(createOwnedEngineProvider({ endpoint: "ftp://mt.internal" }).isConfigured()).toBe(false);
    expect(
      createOwnedEngineProvider({ endpoint: "https://mt.internal/v1/translate" }).isConfigured(),
    ).toBe(true);
  });

  it("speaks the documented contract", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        source: "en",
        target: "hi",
        target_script: "Deva",
        target_direction: "ltr",
      });
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
      return Response.json({
        model: "sv-mt",
        version: "2026.09",
        segments: [
          { id: "0", text: HINDI["Apply Now"], confidence: 0.97 },
          { id: 1, text: "malformed id" },
          { id: "2", text: "bad confidence", confidence: 7 },
        ],
      });
    });
    const provider = createOwnedEngineProvider({
      endpoint: "https://mt.internal/v1/translate",
      token: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const response = await provider.translate({
      mode: "quality",
      source: getLanguage("en")!,
      target: getLanguage("hi")!,
      segments: [{ id: "0", text: "Apply Now", namespace: "ui", context: null }],
      glossary: [],
    });
    expect(response).toMatchObject({
      provider: "owned-engine",
      providerKind: "owned",
      model: "sv-mt",
      version: "2026.09",
    });
    expect(response.segments).toEqual([
      { id: "0", text: HINDI["Apply Now"], confidence: 0.97 },
      { id: "2", text: "bad confidence", confidence: null },
    ]);
  });

  it("fails on an HTTP error so the engine can move on", async () => {
    const provider = createOwnedEngineProvider({
      endpoint: "https://mt.internal",
      fetchImpl: (async () => new Response("no", { status: 502 })) as unknown as typeof fetch,
    });
    await expect(
      provider.translate({
        mode: "realtime",
        source: null,
        target: getLanguage("hi")!,
        segments: [{ id: "0", text: "Apply Now", namespace: "ui", context: null }],
        glossary: [],
      }),
    ).rejects.toThrow("502");
  });
});

describe("AI API Manager provider (external adapter)", () => {
  const request: EngineRequest = {
    mode: "realtime",
    source: getLanguage("en")!,
    target: getLanguage("es-AR")!,
    segments: [
      { id: "0", text: "Apply Now", namespace: "ui", context: null },
      { id: "1", text: "Language", namespace: "ui", context: "settings" },
    ],
    glossary: [{ source: "Checkout", target: "Finalizar compra" }],
  };

  it("describes the language unambiguously instead of passing a raw code", () => {
    const prompt = buildTranslationPrompt(request, request.segments[1]!);
    expect(prompt.system).toContain("Spanish (Argentina) [es-AR]");
    expect(prompt.system).toContain("Latn script");
    expect(prompt.system).toContain("region AR");
    expect(prompt.system).toContain('"Checkout" -> "Finalizar compra"');
    expect(prompt.system).toContain("ui - settings");
    expect(prompt.user).toBe("<source>Language</source>");
  });

  it("sends one request per segment", async () => {
    const complete = vi.fn(async (options: { messages: { content: string }[] }) => ({
      text: options.messages[1]!.content.includes("Apply Now")
        ? SPANISH["Apply Now"]!
        : SPANISH.Language!,
      model: "model-x",
      service: "svc",
    }));
    const provider = createAiApiManagerProvider({ complete, concurrency: 2 });
    expect(provider.kind).toBe("external");
    const response = await provider.translate(request);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(response.segments.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "0", text: SPANISH["Apply Now"], confidence: null },
      { id: "1", text: SPANISH.Language, confidence: null },
    ]);
  });

  it("throws when nothing could be translated, so the engine reports it unavailable", async () => {
    const provider = createAiApiManagerProvider({
      complete: async () => {
        throw new Error("No active AI service is configured in AI API Manager.");
      },
    });
    await expect(provider.translate(request)).rejects.toThrow("No active AI service");
  });
});

describe("glossary-only strings", () => {
  const locked: GlossaryTerm = {
    sourceTerm: "Software Vala",
    targetTerm: null,
    sourceLanguage: "en",
    targetLanguage: null,
    rule: "locked",
    caseSensitive: true,
    namespace: null,
  };

  it("answers a brand name without the engine and without review", async () => {
    const provider = dictionaryProvider();
    const memory = new MemoryStore();
    const result = await runTranslationPipeline(
      { texts: ["Software Vala"], source: "en", target: "hi", persist: true },
      { engine: engineWith(provider), memory, glossary: { load: async () => [locked] } },
    );
    expect(result.outcomes[0]).toMatchObject({
      translation: "Software Vala",
      status: "machine",
      origin: "identity",
      qualityScore: 1,
    });
    expect(provider.calls).toHaveLength(0);
    expect(result.stats.needsReview).toBe(0);
  });

  it("still translates the words around a protected term", async () => {
    const provider = dictionaryProvider("owned-engine", "owned", { "⟦T0⟧ Language": "⟦T0⟧ भाषा" });
    const result = await runTranslationPipeline(
      { texts: ["Software Vala Language"], source: "en", target: "hi" },
      { engine: engineWith(provider), glossary: { load: async () => [locked] } },
    );
    expect(provider.calls).toHaveLength(1);
    expect(result.outcomes[0]!.translation).toBe("Software Vala भाषा");
  });
});

describe("product names", () => {
  it("recognises a coined name and leaves a sentence alone", () => {
    for (const name of ["OTScheduler", "EduNex Pro", "InventoryEdu Suite", "PharmaStock 2026"]) {
      expect(looksLikeProductName(name)).toBe(true);
    }
    for (const sentence of [
      "12,000+ Software Solutions",
      "Verified sellers only",
      "Your order has been confirmed.",
      "Trusted Software Marketplace",
      "Open the checkout page",
    ]) {
      expect(looksLikeProductName(sentence)).toBe(false);
    }
  });

  it("answers a product name without the engine and without review", async () => {
    const provider = dictionaryProvider();
    const memory = new MemoryStore();
    const result = await runTranslationPipeline(
      { texts: ["EduNex Pro"], source: "en", target: "ug", persist: true },
      { engine: engineWith(provider), memory },
    );
    expect(result.outcomes[0]).toMatchObject({
      translation: "EduNex Pro",
      status: "machine",
      origin: "identity",
      qualityScore: 1,
      issues: ["name_kept"],
    });
    expect(provider.calls).toHaveLength(0);
    expect(result.stats.needsReview).toBe(0);
    // Nothing is stored: the answer costs nothing to produce again, and a row
    // per product name per language would fill memory with names.
    expect(memory.saved).toHaveLength(0);
  });
});
