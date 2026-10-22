const LOCAL_AI_SERVICES = {
  "ollama-local": {
    endpoint: "http://127.0.0.1:11434/v1/chat/completions",
    modelsEndpoint: "http://127.0.0.1:11434/v1/models",
    healthEndpoint: "http://127.0.0.1:11434/api/tags",
  },
  "founder-ai-local": {
    endpoint: "http://127.0.0.1:5200/v1/chat/completions",
    modelsEndpoint: "http://127.0.0.1:5200/v1/models",
    healthEndpoint: "http://127.0.0.1:5200/health",
  },
} as const;

export type LocalAiServiceSlug = keyof typeof LOCAL_AI_SERVICES;
export type LocalAiService = (typeof LOCAL_AI_SERVICES)[LocalAiServiceSlug];

export function getLocalAiService(slug: unknown): LocalAiService | null {
  if (typeof slug !== "string" || !(slug in LOCAL_AI_SERVICES)) return null;
  return LOCAL_AI_SERVICES[slug as LocalAiServiceSlug];
}

export function isConfiguredLocalAiService(
  slug: unknown,
  type: unknown,
  endpoint: unknown,
): boolean {
  const service = getLocalAiService(slug);
  return (
    service !== null &&
    type === "local" &&
    typeof endpoint === "string" &&
    endpoint === service.endpoint
  );
}
