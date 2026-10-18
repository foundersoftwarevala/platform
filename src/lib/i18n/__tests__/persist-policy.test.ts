import { describe, expect, it, vi } from "vitest";

import { TranslationEngine } from "../engine/engine";
import type { EngineRequest, EngineResponse, TranslationProvider } from "../engine/types";
import { clientAddress } from "../limits";
import { persistenceRule, requiresOwnedEngine } from "../persist-policy";
import {
  runTranslationPipeline,
  type MemoryRecord,
  type TranslationMemoryStore,
} from "../pipeline";
import { UI_DICTIONARY } from "../ui-dictionary";

const HINDI = UI_DICTIONARY.hi!;
const isCatalogue = (text: string) => text in (UI_DICTIONARY.en ?? {});

// Text a dashboard puts on screen: not interface wording, and private.
const PAGE_TEXT = "Apply Now for order 4411";

function provider(): TranslationProvider & { calls: EngineRequest[] } {
  const calls: EngineRequest[] = [];
  return {
    id: "owned-engine",
    kind: "owned",
    calls,
    isConfigured: () => true,
    supports: () => true,
    async translate(request): Promise<EngineResponse> {
      calls.push(request);
      return {
        provider: "owned-engine",
        providerKind: "owned",
        model: "test-model",
        version: "1",
        segments: request.segments.flatMap((segment) => {
          const text =
            segment.text === PAGE_TEXT ? `${HINDI["Apply Now"]} 4411` : HINDI[segment.text];
          return text === undefined ? [] : [{ id: segment.id, text, confidence: 0.9 }];
        }),
      };
    },
  };
}

class Memory implements TranslationMemoryStore {
  saved: MemoryRecord[] = [];
  async lookup() {
    return new Map();
  }
  async save(records: MemoryRecord[]) {
    this.saved.push(...records);
  }
}

describe("persistence rule", () => {
  it("keeps only catalogue text from page text, for every tier", () => {
    for (const tier of ["anonymous", "user", "operator"] as const) {
      const rule = persistenceRule("ui", tier, isCatalogue);
      expect(rule).toBeTypeOf("function");
      expect(rule!("Apply Now")).toBe(true);
      expect(rule!(PAGE_TEXT)).toBe(false);
    }
  });

  it("lets only an operator keep a non-page namespace", () => {
    expect(persistenceRule("chat", "operator", isCatalogue)).toBeUndefined();
    expect(persistenceRule("chat", "user", isCatalogue)!("Apply Now")).toBe(false);
    expect(persistenceRule("chat", "anonymous", isCatalogue)!("Apply Now")).toBe(false);
  });

  it("an operator's page text is translated but never written to memory", async () => {
    const memory = new Memory();
    const result = await runTranslationPipeline(
      {
        texts: ["Apply Now", PAGE_TEXT],
        source: "en",
        target: "hi",
        persist: true,
        mayPersist: persistenceRule("ui", "operator", isCatalogue),
      },
      { engine: new TranslationEngine([provider()], { allowExternal: false }), memory },
    );
    expect(result.outcomes.map((o) => o.translation)).toEqual([
      HINDI["Apply Now"],
      `${HINDI["Apply Now"]} 4411`,
    ]);
    expect(memory.saved.map((r) => r.sourceText)).toEqual(["Apply Now"]);
  });

  it("keeps non-catalogue page text on the owned engine", () => {
    expect(requiresOwnedEngine("ui", ["Apply Now"], isCatalogue)).toBe(false);
    expect(requiresOwnedEngine("ui", ["Apply Now", ` ${PAGE_TEXT} `], isCatalogue)).toBe(true);
    expect(requiresOwnedEngine("chat", [PAGE_TEXT], isCatalogue)).toBe(false);
  });
});

describe("quota refund", () => {
  it("gives the reserved quota back when no engine can run", async () => {
    const down: TranslationProvider = {
      id: "owned-engine",
      kind: "owned",
      isConfigured: () => true,
      supports: () => true,
      translate: () => Promise.reject(new Error("connection refused")),
    };
    const quota = vi.fn(async () => true);
    const refundQuota = vi.fn();
    await expect(
      runTranslationPipeline(
        { texts: ["Apply Now"], source: "en", target: "hi" },
        {
          engine: new TranslationEngine([down], { allowExternal: false }),
          quota,
          refundQuota,
        },
      ),
    ).rejects.toMatchObject({ reason: "engine_unavailable" });
    expect(quota).toHaveBeenCalledWith("Apply Now".length);
    expect(refundQuota).toHaveBeenCalledWith("Apply Now".length);
  });
});

describe("client address", () => {
  const headers = new Headers({
    "cf-connecting-ip": "203.0.113.7",
    "x-forwarded-for": "198.51.100.1, 203.0.113.9",
  });
  const trusted = new Set(["127.0.0.1", "::1"]);

  it("believes forwarding headers only from a trusted proxy", () => {
    expect(clientAddress(headers, "127.0.0.1", trusted)).toBe("203.0.113.7");
    expect(clientAddress(headers, "::ffff:127.0.0.1", trusted)).toBe("203.0.113.7");
  });

  it("uses the socket address for anyone else", () => {
    expect(clientAddress(headers, "192.0.2.50", trusted)).toBe("192.0.2.50");
    expect(clientAddress(new Headers(), null, trusted)).toBe("unknown");
  });
});
