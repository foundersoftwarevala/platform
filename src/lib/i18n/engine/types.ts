import type { LanguageDefinition } from "../registry";

/**
 * The contract between the translation pipeline and whatever produces a
 * translation.
 *
 * The pipeline only ever talks to a TranslationEngine, and the engine only
 * ever talks to TranslationProviders. A provider is an adapter: the platform's
 * own translation service is one, a model reached through AI API Manager is
 * another. Nothing above this layer knows which one answered, so a provider can
 * be added, reordered or removed without touching the application.
 */

export type TranslationSegment = {
  /** Stable within one request; used to match answers to questions. */
  id: string;
  /** Text to translate. Protected terms are already replaced by tokens. */
  text: string;
  namespace: string;
  context: string | null;
};

export type GlossaryHint = {
  source: string;
  target: string;
};

export type TranslationMode = "realtime" | "quality";

export type EngineRequest = {
  /** realtime: answer fast (interactive). quality: take longer for a better result (background jobs). */
  mode: TranslationMode;
  /** Null when the source language is not known and must be detected. */
  source: LanguageDefinition | null;
  target: LanguageDefinition;
  segments: TranslationSegment[];
  /** Renderings the translation should use for terms found in the text. */
  glossary: GlossaryHint[];
};

export type EngineSegmentResult = {
  id: string;
  text: string;
  /** 0..1 when the provider reports one. */
  confidence: number | null;
};

export type EngineResponse = {
  /** Provider id, e.g. "owned-engine" or "ai-api-manager". */
  provider: string;
  providerKind: ProviderKind;
  model: string | null;
  version: string | null;
  /** May omit segments the provider could not translate. */
  segments: EngineSegmentResult[];
};

/**
 * owned: infrastructure this platform runs and controls.
 * external: a third-party service. Allowed only while the engine is
 * configured to allow it, and always removable.
 */
export type ProviderKind = "owned" | "external";

export interface TranslationProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  /** Whether the provider is configured at all. Cheap; no network. */
  isConfigured(): boolean;
  /** Whether it handles this language pair. */
  supports(source: LanguageDefinition | null, target: LanguageDefinition): boolean;
  translate(request: EngineRequest): Promise<EngineResponse>;
}

export type ProviderAttempt = {
  provider: string;
  kind: ProviderKind;
  outcome: "skipped_external" | "not_configured" | "unsupported" | "failed";
  detail?: string;
};

export class EngineUnavailableError extends Error {
  readonly reason = "engine_unavailable" as const;
  constructor(readonly attempts: ProviderAttempt[]) {
    super(
      attempts.length === 0
        ? "No translation provider is registered."
        : `No translation provider could handle the request (${attempts
            .map((a) => `${a.provider}: ${a.outcome}`)
            .join("; ")}).`,
    );
    this.name = "EngineUnavailableError";
  }
}
