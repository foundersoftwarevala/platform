import type { AiTarget } from "@/lib/ai-gateway.server";

export const MARKETPLACE_SEO_OLLAMA_FAILURE_LIMIT = 3;
export const MARKETPLACE_SEO_FREE_FAILURE_LIMIT = 10;
export const MARKETPLACE_SEO_RATE_LIMIT_RETRY_DELAY_MS = 60_000;
export const MARKETPLACE_SEO_PROVIDER_RETRY_DELAY_MS = 15_000;
export const MARKETPLACE_SEO_WORKER_DELAY_MS = 2500;
export const MARKETPLACE_SEO_WORKER_MIN_AVAILABLE_MEMORY_BYTES = 1536 * 1024 * 1024;
export const MARKETPLACE_SEO_WORKER_MAX_LOAD_PER_CPU = 0.85;

export function isMarketplaceSeoFreeTextTarget(target: AiTarget): boolean {
  const providerSlug = target.providerSlug.toLowerCase();
  const modelId = target.modelId?.toLowerCase() ?? "";
  const verifiedFreeModel =
    (providerSlug === "groq" && modelId === "qwen/qwen3.8-27b") ||
    (providerSlug === "openrouter" && modelId.endsWith(":free"));

  return (
    target.isLocal === false &&
    verifiedFreeModel &&
    ["free", "free-tier", "freemium"].includes(String(target.pricingTier ?? "").toLowerCase())
  );
}

export function isMarketplaceSeoRateLimitError(message: string): boolean {
  return /\b429\b|rate[\s_-]*limit|too many requests|output.tokens per minute|throttl/i.test(
    message,
  );
}

export function nextMarketplaceSeoFreeFailureCount(current: number): number {
  return Math.min(MARKETPLACE_SEO_FREE_FAILURE_LIMIT, Math.max(0, current) + 1);
}

export function nextMarketplaceSeoProviderServiceId(
  targets: AiTarget[],
  currentServiceId: string | null,
): string | null {
  if (targets.length === 0) return null;
  if (targets.length === 1) return targets[0].serviceId;
  const currentIndex = targets.findIndex((target) => target.serviceId === currentServiceId);
  return targets[(currentIndex < 0 ? 0 : currentIndex + 1) % targets.length].serviceId;
}

export function marketplaceSeoWorkerHostPauseReason(input: {
  loadAverage1m: number;
  cpuCount: number;
  availableMemoryBytes: number;
}): string | null {
  if (
    Number.isFinite(input.loadAverage1m) &&
    Number.isFinite(input.cpuCount) &&
    input.cpuCount > 0 &&
    input.loadAverage1m / input.cpuCount >= MARKETPLACE_SEO_WORKER_MAX_LOAD_PER_CPU
  ) {
    return "Paused automatically because system load is above the safe threshold.";
  }
  if (
    Number.isFinite(input.availableMemoryBytes) &&
    input.availableMemoryBytes < MARKETPLACE_SEO_WORKER_MIN_AVAILABLE_MEMORY_BYTES
  ) {
    return "Paused automatically because available memory is below 1.5 GiB.";
  }
  return null;
}

export function nextMarketplaceSeoOllamaFailureCount(current: number): number {
  return Math.min(MARKETPLACE_SEO_OLLAMA_FAILURE_LIMIT, Math.max(0, current) + 1);
}
