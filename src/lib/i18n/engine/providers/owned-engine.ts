import type { EngineRequest, EngineResponse, TranslationProvider } from "../types";

/**
 * The platform's own translation service.
 *
 * This adapter speaks the HTTP contract of the platform's translation engine,
 * services/translation-engine (MADLAD-400 through CTranslate2, plus the
 * self-hosted LibreTranslate models), which runs on the application host.
 * Point TRANSLATE_PROVIDER_URL at its /v1/translate endpoint.
 *
 * Request (POST, JSON):
 *   {
 *     "mode": "realtime" | "quality",
 *     "source": "en" | null,          // canonical code; null = detect
 *     "target": "pt-BR",
 *     "target_script": "Latn",
 *     "target_direction": "ltr",
 *     "segments": [{ "id": "0", "text": "...", "namespace": "ui", "context": null }],
 *     "glossary": [{ "source": "Checkout", "target": "Finalizar compra" }]
 *   }
 * Response (200, JSON):
 *   {
 *     "model": "sv-mt-base", "version": "2026.09.0",
 *     "segments": [{ "id": "0", "text": "...", "confidence": 0.93 }]
 *   }
 * Segments the service cannot translate are left out of the response.
 * Tokens of the form ⟦T0⟧ must be returned unchanged.
 */

export const OWNED_ENGINE_ID = "owned-engine";

export type OwnedEngineConfig = {
  endpoint?: string | null;
  token?: string | null;
  /** How long an interactive request may take. */
  timeoutMs?: number;
  /** How long a background "quality" batch may take; these are much slower. */
  qualityTimeoutMs?: number;
  fetchImpl?: typeof fetch;
};

function parseEndpoint(endpoint: string | null | undefined): URL | null {
  if (!endpoint?.trim()) return null;
  try {
    const url = new URL(endpoint.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

type OwnedEngineReply = {
  model?: unknown;
  version?: unknown;
  segments?: unknown;
};

export function createOwnedEngineProvider(config: OwnedEngineConfig): TranslationProvider {
  const endpoint = parseEndpoint(config.endpoint);
  const timeoutMs = config.timeoutMs ?? 60_000;
  const qualityTimeoutMs = config.qualityTimeoutMs ?? 600_000;

  return {
    id: OWNED_ENGINE_ID,
    kind: "owned",
    isConfigured: () => endpoint !== null,
    // The service reports what it cannot translate by leaving segments out.
    supports: () => true,
    async translate(request: EngineRequest): Promise<EngineResponse> {
      if (!endpoint) throw new Error("TRANSLATE_PROVIDER_URL is not set.");
      const doFetch = config.fetchImpl ?? fetch;
      const controller = new AbortController();
      const budget = request.mode === "quality" ? qualityTimeoutMs : timeoutMs;
      const timer = setTimeout(() => controller.abort(), budget);
      try {
        const response = await doFetch(endpoint.toString(), {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
          },
          body: JSON.stringify({
            mode: request.mode,
            source: request.source?.code ?? null,
            target: request.target.code,
            target_script: request.target.script,
            target_direction: request.target.direction,
            segments: request.segments,
            glossary: request.glossary,
          }),
        });
        if (!response.ok) throw new Error(`Translation service returned HTTP ${response.status}.`);
        const reply = (await response.json()) as OwnedEngineReply;
        if (!Array.isArray(reply.segments))
          throw new Error("Translation service reply has no segments.");
        return {
          provider: OWNED_ENGINE_ID,
          providerKind: "owned",
          model: typeof reply.model === "string" ? reply.model : null,
          version: typeof reply.version === "string" ? reply.version : null,
          segments: reply.segments.flatMap((segment) => {
            const s = segment as { id?: unknown; text?: unknown; confidence?: unknown };
            if (typeof s.id !== "string" || typeof s.text !== "string") return [];
            const confidence =
              typeof s.confidence === "number" && s.confidence >= 0 && s.confidence <= 1
                ? s.confidence
                : null;
            return [{ id: s.id, text: s.text, confidence }];
          }),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
