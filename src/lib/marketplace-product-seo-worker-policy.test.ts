import { describe, expect, it } from "vitest";

import type { AiTarget } from "@/lib/ai-gateway.server";
import {
  MARKETPLACE_SEO_OLLAMA_FAILURE_LIMIT,
  MARKETPLACE_SEO_FREE_FAILURE_LIMIT,
  MARKETPLACE_SEO_RATE_LIMIT_RETRY_DELAY_MS,
  isMarketplaceSeoFreeTextTarget,
  isMarketplaceSeoRateLimitError,
  marketplaceSeoWorkerHostPauseReason,
  nextMarketplaceSeoFreeFailureCount,
  nextMarketplaceSeoOllamaFailureCount,
  nextMarketplaceSeoProviderServiceId,
} from "./marketplace-product-seo-worker-policy";

function target(overrides: Partial<AiTarget>): AiTarget {
  return {
    serviceId: "service-id",
    serviceName: "Provider",
    endpoint: "https://provider.example/v1/chat/completions",
    credential: "credential",
    providerSlug: "groq",
    modelId: "qwen/qwen3.8-27b",
    modelRowId: "model-row",
    isAnthropic: false,
    isLocal: false,
    pricingTier: "free",
    ...overrides,
  };
}

describe("Marketplace SEO worker safety policy", () => {
  it("allows only explicitly non-local providers registered with a free tier", () => {
    expect(isMarketplaceSeoFreeTextTarget(target({ pricingTier: "free" }))).toBe(true);
    expect(
      isMarketplaceSeoFreeTextTarget(
        target({
          providerSlug: "openrouter",
          modelId: "xingchen-agi/xing4.0-29b-a4b:free",
          pricingTier: "free-tier",
        }),
      ),
    ).toBe(true);
    expect(isMarketplaceSeoFreeTextTarget(target({ isLocal: true }))).toBe(false);
    expect(isMarketplaceSeoFreeTextTarget(target({ isLocal: undefined }))).toBe(false);
    expect(isMarketplaceSeoFreeTextTarget(target({ pricingTier: "paid" }))).toBe(false);
    expect(isMarketplaceSeoFreeTextTarget(target({ pricingTier: "unknown" }))).toBe(false);
    expect(isMarketplaceSeoFreeTextTarget(target({ providerSlug: "google-gemini" }))).toBe(false);
    expect(
      isMarketplaceSeoFreeTextTarget(
        target({ providerSlug: "openrouter", modelId: "openai/gpt-4o" }),
      ),
    ).toBe(false);
    expect(
      isMarketplaceSeoFreeTextTarget(
        target({ providerSlug: "huggingface", modelId: "Qwen/Qwen2.5-7B-Instruct" }),
      ),
    ).toBe(false);
  });

  it("recognizes rate-limit status and provider text", () => {
    expect(isMarketplaceSeoRateLimitError("The AI provider returned HTTP 429.")).toBe(true);
    expect(
      isMarketplaceSeoRateLimitError("Groq rate limit reached for output tokens per minute."),
    ).toBe(true);
    expect(isMarketplaceSeoRateLimitError("Too many requests; retry later.")).toBe(true);
    expect(isMarketplaceSeoRateLimitError("The provider returned invalid JSON.")).toBe(false);
    expect(MARKETPLACE_SEO_RATE_LIMIT_RETRY_DELAY_MS).toBe(60_000);
  });

  it("counts consecutive free-provider failures up to the pause threshold", () => {
    expect(nextMarketplaceSeoFreeFailureCount(0)).toBe(1);
    expect(nextMarketplaceSeoFreeFailureCount(9)).toBe(MARKETPLACE_SEO_FREE_FAILURE_LIMIT);
    expect(nextMarketplaceSeoFreeFailureCount(20)).toBe(MARKETPLACE_SEO_FREE_FAILURE_LIMIT);
  });

  it("rotates the next preferred free service after a complete failed round", () => {
    const groq = target({ serviceId: "groq-service" });
    const openrouter = target({
      serviceId: "openrouter-service",
      providerSlug: "openrouter",
      modelId: "xingchen-agi/xing4.0-29b-a4b:free",
    });
    expect(nextMarketplaceSeoProviderServiceId([groq, openrouter], "groq-service")).toBe(
      "openrouter-service",
    );
    expect(nextMarketplaceSeoProviderServiceId([openrouter, groq], "openrouter-service")).toBe(
      "groq-service",
    );
    expect(nextMarketplaceSeoProviderServiceId([], null)).toBeNull();
  });

  it("caps consecutive Ollama failures at the failover threshold", () => {
    expect(nextMarketplaceSeoOllamaFailureCount(0)).toBe(1);
    expect(nextMarketplaceSeoOllamaFailureCount(2)).toBe(MARKETPLACE_SEO_OLLAMA_FAILURE_LIMIT);
    expect(nextMarketplaceSeoOllamaFailureCount(8)).toBe(MARKETPLACE_SEO_OLLAMA_FAILURE_LIMIT);
  });

  it("pauses at configured host load or memory thresholds", () => {
    expect(
      marketplaceSeoWorkerHostPauseReason({
        loadAverage1m: 3.4,
        cpuCount: 4,
        availableMemoryBytes: 8 * 1024 ** 3,
      }),
    ).toContain("system load");
    expect(
      marketplaceSeoWorkerHostPauseReason({
        loadAverage1m: 0,
        cpuCount: 4,
        availableMemoryBytes: 1 * 1024 ** 3,
      }),
    ).toContain("available memory");
    expect(
      marketplaceSeoWorkerHostPauseReason({
        loadAverage1m: 0.1,
        cpuCount: 4,
        availableMemoryBytes: 4 * 1024 ** 3,
      }),
    ).toBeNull();
  });
});
