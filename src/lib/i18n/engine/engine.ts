import {
  EngineUnavailableError,
  type EngineRequest,
  type EngineResponse,
  type ProviderAttempt,
  type TranslationProvider,
} from "./types";

export type EngineOptions = {
  /**
   * Whether external providers may be used at all. When false the engine runs
   * on owned providers only, and says it is unavailable rather than falling
   * back to a third party.
   */
  allowExternal: boolean;
};

/**
 * Chooses a provider for each request.
 *
 * Providers are tried in the order given. One that is not configured, does not
 * support the pair, is external while external use is off, or fails, is
 * skipped and the next is tried. A provider that answers only some segments
 * is accepted; the rest are reported untranslated by the pipeline rather than
 * retried elsewhere, so one request never mixes engines.
 */
export class TranslationEngine {
  constructor(
    private readonly providers: readonly TranslationProvider[],
    private readonly options: EngineOptions,
  ) {}

  describe() {
    return this.providers.map((provider) => ({
      id: provider.id,
      kind: provider.kind,
      configured: provider.isConfigured(),
      usable: provider.isConfigured() && (provider.kind === "owned" || this.options.allowExternal),
    }));
  }

  /** True when at least one provider could be tried. */
  isAvailable(): boolean {
    return this.describe().some((provider) => provider.usable);
  }

  async translate(request: EngineRequest): Promise<EngineResponse> {
    const attempts: ProviderAttempt[] = [];
    for (const provider of this.providers) {
      const base = { provider: provider.id, kind: provider.kind };
      if (provider.kind === "external" && !this.options.allowExternal) {
        attempts.push({ ...base, outcome: "skipped_external" });
        continue;
      }
      if (!provider.isConfigured()) {
        attempts.push({ ...base, outcome: "not_configured" });
        continue;
      }
      if (!provider.supports(request.source, request.target)) {
        attempts.push({ ...base, outcome: "unsupported" });
        continue;
      }
      try {
        const response = await provider.translate(request);
        const known = new Set(request.segments.map((segment) => segment.id));
        return {
          ...response,
          provider: provider.id,
          providerKind: provider.kind,
          segments: response.segments.filter(
            (segment) => known.has(segment.id) && typeof segment.text === "string",
          ),
        };
      } catch (error) {
        attempts.push({
          ...base,
          outcome: "failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
    throw new EngineUnavailableError(attempts);
  }
}
