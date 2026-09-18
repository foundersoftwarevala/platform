import { TranslationEngine } from "./engine/engine";
import {
  EngineUnavailableError,
  type TranslationMode,
  type TranslationSegment,
} from "./engine/types";
import {
  checkTerminology,
  glossaryHints,
  protectLockedTerms,
  restoreLockedTerms,
  selectTerms,
  type GlossaryTerm,
  type ProtectedToken,
} from "./glossary";
import { contextHash as computeContextHash, sourceHash as computeSourceHash } from "./hash";
import { assessTranslation } from "./quality";
import { resolveLanguage, type LanguageDefinition } from "./registry";

/**
 * The translation pipeline.
 *
 *   input text
 *   -> resolve and validate both languages against the registry
 *   -> translation memory (verified first, then validated machine output)
 *   -> glossary: protect locked terms, collect preferred renderings
 *   -> translation engine (provider-independent)
 *   -> restore terms, validate the output, score it
 *   -> store the result with its status
 *   -> response
 *
 * Every dependency is passed in, so the same pipeline runs against the real
 * database and engine in production and against in-memory ones in tests.
 * Nothing here returns text that failed validation: such a segment comes back
 * with no translation and the reason, and the caller shows its fallback.
 */

export const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,47}$/;

/** Namespaces whose text is private and must never be written to, or read
 * from, shared translation memory. */
export const PRIVATE_NAMESPACES = new Set(["chat"]);

export const MAX_CONTEXT_LENGTH = 500;

const TERM_TOKEN = /⟦T\d+⟧/g;

/**
 * Does this text still have a word in it? Protected glossary terms are ⟦T0⟧
 * tokens by this point, so a string made only of brand names has nothing left
 * to translate and must not be sent to a model or held for review.
 */
function hasWordsToTranslate(masked: string): boolean {
  return /\p{L}/u.test(masked.replace(TERM_TOKEN, " "));
}

/** A word carrying a capital inside it: EduNex, OTScheduler, PharmaStock. */
const COINED_WORD = /^\p{Lu}[\p{L}\d]*\p{Lu}[\p{L}\d]*$/u;
/** A plain capitalised word or something with no letters at all (2026, +, ·). */
const NAME_COMPANION = /^(\p{Lu}[\p{Ll}\d]*|[^\p{L}]+)$/u;

/**
 * Is the whole string the name of a product?
 *
 * The marketplace lists names its sellers coined — "OTScheduler", "EduNex
 * Pro", "InventoryEdu Suite" — and those are not translated in any language:
 * a model asked to translate them returns them unchanged, which the quality
 * gate then reports as an untranslated answer in the wrong script. Every
 * visit in such a language paid for that again and filled the review queue
 * with names no reviewer can act on.
 *
 * A name is recognised conservatively: at most four words, none of them
 * lower-case, at least one carrying a capital inside it, and no sentence
 * punctuation. "12,000+ Software Solutions" is a sentence by that measure and
 * is still translated; the glossary remains the place for names without an
 * inner capital, such as "Software Vala".
 */
export function looksLikeProductName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /[.,;:!?]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;
  let coined = false;
  for (const word of words) {
    if (COINED_WORD.test(word)) {
      coined = true;
      continue;
    }
    if (!NAME_COMPANION.test(word)) return false;
  }
  return coined;
}

/** Statuses a memory row can have (see the migration for their meaning). */
export type MemoryStatus =
  "machine" | "verified" | "needs_review" | "rejected" | "legacy" | "stale";

export type MemoryEntry = {
  sourceHash: string;
  contextHash: string;
  translatedText: string;
  status: MemoryStatus;
  qualityScore: number | null;
  version: number;
  engine: string | null;
};

export type MemoryRecord = {
  sourceHash: string;
  sourceLanguage: string;
  targetLanguage: string;
  contextHash: string;
  namespace: string;
  context: string | null;
  translationKey: string | null;
  sourceText: string;
  translatedText: string;
  status: "machine" | "needs_review";
  qualityScore: number;
  qualityFlags: string[];
  engine: string;
  engineVersion: string | null;
  providerKind: "owned" | "external";
};

export interface TranslationMemoryStore {
  /**
   * Rows for these source hashes in one language pair, keyed
   * `${sourceHash}:${contextHash}`. When several rows share a key the store
   * returns the most authoritative one (verified before anything else).
   */
  lookup(query: {
    sourceLanguage: string;
    targetLanguage: string;
    sourceHashes: string[];
  }): Promise<Map<string, MemoryEntry>>;
  save(records: MemoryRecord[]): Promise<void>;
}

export interface GlossaryStore {
  load(scope: { source: string; target: string; namespace: string }): Promise<GlossaryTerm[]>;
}

/** Reserve `units` of engine work. False when the caller is over its limit. */
export type QuotaGuard = (units: number) => Promise<boolean>;

export type PipelineDeps = {
  engine: TranslationEngine;
  memory?: TranslationMemoryStore | null;
  glossary?: GlossaryStore | null;
  quota?: QuotaGuard | null;
  /** Operator overrides from i18n_languages; false disables a language. */
  isLanguageEnabled?: (code: string) => boolean;
  log?: (message: string, detail?: unknown) => void;
};

export type PipelineRequest = {
  texts: readonly string[];
  /** Registry code, alias or name. Null = unknown, detected by the engine. */
  source: string | null;
  target: string;
  namespace?: string;
  context?: string | null;
  /** Write results to translation memory. Off for private text. */
  persist?: boolean;
  /** Further restricts which texts may be written. */
  mayPersist?: (text: string) => boolean;
  /** Skip the engine; answer from memory only. */
  memoryOnly?: boolean;
  /** realtime (default) for interactive requests, quality for background work. */
  mode?: TranslationMode;
  /**
   * Translate again even where memory holds an unreviewed machine translation.
   * Reviewed decisions (verified, rejected, needs_review) are still respected.
   */
  refresh?: boolean;
};

export type SegmentStatus =
  | "source" // target is the source language; returned unchanged
  | "verified" // reviewed translation from memory
  | "machine" // validated machine translation (memory or engine)
  | "needs_review" // engine output failed validation; not returned
  | "rejected" // refused by a reviewer; not returned
  | "pending"; // not translated in this request (no engine, quota, memory-only)

export type SegmentOutcome = {
  text: string;
  translation: string | null;
  status: SegmentStatus;
  origin: "identity" | "memory" | "engine" | null;
  qualityScore: number | null;
  issues: string[];
};

export type PipelineResult = {
  source: LanguageDefinition | null;
  target: LanguageDefinition;
  namespace: string;
  outcomes: SegmentOutcome[];
  engine: {
    provider: string;
    kind: "owned" | "external";
    model: string | null;
    version: string | null;
  } | null;
  /** Why some segments are pending, when they are. */
  pendingReason: "engine_unavailable" | "quota_exceeded" | "memory_only" | null;
  stats: { fromMemory: number; translated: number; needsReview: number; pending: number };
};

export type PipelineErrorReason =
  "invalid_language" | "invalid_request" | "engine_unavailable" | "quota_exceeded";

export class PipelineError extends Error {
  constructor(
    readonly reason: PipelineErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

function resolveEnabled(input: string, deps: PipelineDeps): LanguageDefinition | undefined {
  const language = resolveLanguage(input, { names: true });
  if (!language) return undefined;
  if (deps.isLanguageEnabled && !deps.isLanguageEnabled(language.code)) return undefined;
  return language;
}

export async function runTranslationPipeline(
  request: PipelineRequest,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const log = deps.log ?? (() => undefined);

  // 1. Languages.
  const target = resolveEnabled(request.target, deps);
  if (!target) throw new PipelineError("invalid_language", "Unsupported target language.");
  let source: LanguageDefinition | null = null;
  if (request.source !== null) {
    source = resolveEnabled(request.source, deps) ?? null;
    if (!source) throw new PipelineError("invalid_language", "Unsupported source language.");
  }

  // 2. Request shape.
  const namespace = request.namespace ?? "ui";
  if (!NAMESPACE_PATTERN.test(namespace))
    throw new PipelineError("invalid_request", "Invalid namespace.");
  const context = request.context?.trim() || null;
  if (context && context.length > MAX_CONTEXT_LENGTH) {
    throw new PipelineError("invalid_request", "Context is too long.");
  }
  const texts = Array.from(new Set(request.texts.map((t) => t.trim()).filter(Boolean)));
  // Private namespaces never reach shared translation memory, whoever asks:
  // chat messages belong to the two people in the conversation. The chat
  // server function already asks for persist: false, but an operator calling
  // the public endpoint could otherwise store a message, so the rule is
  // enforced here, where every caller passes.
  const persist = Boolean(request.persist) && source !== null && !PRIVATE_NAMESPACES.has(namespace);
  const byText = new Map<string, SegmentOutcome>();
  const outcomesInOrder = () => texts.map((text) => byText.get(text) ?? pendingOutcome(text));

  const result = (partial: Partial<PipelineResult>): PipelineResult => {
    const outcomes = outcomesInOrder();
    return {
      source,
      target,
      namespace,
      outcomes,
      engine: null,
      pendingReason: null,
      ...partial,
      stats: {
        fromMemory: outcomes.filter((o) => o.origin === "memory").length,
        translated: outcomes.filter((o) => o.origin === "engine" && o.translation !== null).length,
        needsReview: outcomes.filter((o) => o.status === "needs_review").length,
        pending: outcomes.filter((o) => o.status === "pending").length,
      },
    };
  };

  // 3. Same language, or a regional variety of it written in the same script
  //    (en -> en-GB): nothing to translate.
  if (
    source &&
    (source.code === target.code ||
      (source.iso639_3 === target.iso639_3 && source.script === target.script))
  ) {
    for (const text of texts) {
      byText.set(text, {
        text,
        translation: text,
        status: "source",
        origin: "identity",
        qualityScore: null,
        issues: [],
      });
    }
    return result({});
  }

  // 4. Translation memory. Private (non-persisted) text is not looked up either.
  const ctxHash = await computeContextHash(namespace, context);
  const hashes = new Map<string, string>();
  for (const text of texts) hashes.set(text, await computeSourceHash(text));

  if (deps.memory && source && persist) {
    try {
      const found = await deps.memory.lookup({
        sourceLanguage: source.code,
        targetLanguage: target.code,
        sourceHashes: Array.from(new Set(hashes.values())),
      });
      for (const text of texts) {
        const entry = found.get(`${hashes.get(text)}:${ctxHash}`);
        if (!entry) continue;
        if (entry.status === "machine" && request.refresh) continue;
        if (entry.status === "verified" || entry.status === "machine") {
          byText.set(text, {
            text,
            translation: entry.translatedText,
            status: entry.status,
            origin: "memory",
            qualityScore: entry.qualityScore,
            issues: [],
          });
        } else if (entry.status === "needs_review" || entry.status === "rejected") {
          // Waiting for a person. Asking the engine again would pay for the
          // same answer and could not be served either.
          byText.set(text, {
            text,
            translation: null,
            status: entry.status,
            origin: "memory",
            qualityScore: entry.qualityScore,
            issues: [],
          });
        }
        // legacy and stale rows are re-translated below.
      }
    } catch (error) {
      log("[i18n] memory lookup failed", error);
    }
  }

  const misses = texts.filter((text) => !byText.has(text));
  if (misses.length === 0) return result({});
  if (request.memoryOnly) return result({ pendingReason: "memory_only" });

  // 5. Cost control, before any engine work.
  if (deps.quota) {
    const units = misses.reduce((sum, text) => sum + text.length, 0);
    if (!(await deps.quota(units))) {
      if (byText.size === 0)
        throw new PipelineError("quota_exceeded", "Translation limit reached.");
      return result({ pendingReason: "quota_exceeded" });
    }
  }

  // 6. Terminology.
  let terms: GlossaryTerm[] = [];
  if (deps.glossary && source) {
    try {
      terms = selectTerms(
        await deps.glossary.load({ source: source.code, target: target.code, namespace }),
        { source: source.code, target: target.code, namespace },
      );
    } catch (error) {
      log("[i18n] glossary load failed", error);
    }
  }

  const segments: TranslationSegment[] = [];
  const protectedTokens = new Map<string, ProtectedToken[]>();
  const hintSet = new Map<string, string>();
  misses.forEach((text, index) => {
    const id = String(index);
    const guarded = protectLockedTerms(text, terms);
    protectedTokens.set(id, guarded.tokens);
    for (const hint of glossaryHints(text, terms)) hintSet.set(hint.source, hint.target);
    // A string that is only protected terms ("Software Vala") has nothing to
    // translate: it is answered here, with no engine call and no review, since
    // an unchanged brand name is the correct result.
    if (!hasWordsToTranslate(guarded.text)) {
      byText.set(text, {
        text,
        translation: restoreLockedTerms(guarded.text, guarded.tokens).text,
        status: "machine",
        origin: "identity",
        qualityScore: 1,
        issues: ["glossary_only"],
      });
      return;
    }
    // The name of a product is the same in every language.
    if (looksLikeProductName(text)) {
      byText.set(text, {
        text,
        translation: text,
        status: "machine",
        origin: "identity",
        qualityScore: 1,
        issues: ["name_kept"],
      });
      return;
    }
    segments.push({ id, text: guarded.text, namespace, context });
  });
  if (segments.length === 0) return result({});

  // 7. Engine.
  let response;
  try {
    response = await deps.engine.translate({
      mode: request.mode ?? "realtime",
      source,
      target,
      segments,
      glossary: Array.from(hintSet, ([s, t]) => ({ source: s, target: t })),
    });
  } catch (error) {
    if (!(error instanceof EngineUnavailableError)) throw error;
    log("[i18n] engine unavailable", error.attempts);
    if (byText.size === 0) {
      throw new PipelineError("engine_unavailable", "No translation engine is available.");
    }
    return result({ pendingReason: "engine_unavailable" });
  }

  // 8. Validate, score, collect for storage.
  const answers = new Map(response.segments.map((segment) => [segment.id, segment]));
  const records: MemoryRecord[] = [];
  for (const [index, text] of misses.entries()) {
    const id = String(index);
    const answer = answers.get(id);
    if (!answer) continue; // stays pending
    const restored = restoreLockedTerms(answer.text, protectedTokens.get(id) ?? []);
    const assessment = assessTranslation({
      source: text,
      translated: restored.text,
      target,
      lostTokens: restored.missing,
      terminologyIssues: checkTerminology(text, restored.text, terms),
      engineConfidence: answer.confidence,
      sourceUnknown: source === null,
    });
    const issues = [...assessment.errors, ...assessment.warnings];
    const status = assessment.accepted ? "machine" : "needs_review";
    byText.set(text, {
      text,
      translation: assessment.accepted ? restored.text.trim() : null,
      status,
      origin: "engine",
      qualityScore: assessment.score,
      issues,
    });

    if (persist && source && (request.mayPersist?.(text) ?? true)) {
      records.push({
        sourceHash: hashes.get(text)!,
        sourceLanguage: source.code,
        targetLanguage: target.code,
        contextHash: ctxHash,
        namespace,
        context,
        translationKey: namespace === "ui" ? text : null,
        sourceText: text,
        translatedText: restored.text.trim() || "",
        status,
        qualityScore: assessment.score,
        qualityFlags: issues,
        engine: response.provider,
        engineVersion: [response.model, response.version].filter(Boolean).join("@") || null,
        providerKind: response.providerKind,
      });
    }
  }

  // 9. Store. An empty translation cannot be stored (the column is required
  // and it would say nothing a reviewer could use).
  const storable = records.filter((record) => record.translatedText.length > 0);
  if (deps.memory && storable.length > 0) {
    try {
      await deps.memory.save(storable);
    } catch (error) {
      log("[i18n] memory save failed", error);
    }
  }

  return result({
    engine: {
      provider: response.provider,
      kind: response.providerKind,
      model: response.model,
      version: response.version,
    },
    pendingReason: misses.some((text) => !byText.has(text)) ? "engine_unavailable" : null,
  });
}

function pendingOutcome(text: string): SegmentOutcome {
  return {
    text,
    translation: null,
    status: "pending",
    origin: null,
    qualityScore: null,
    issues: [],
  };
}
