import { describe, expect, it } from "vitest";

import {
  isAiPricingTierAllowed,
  orderAiServicesByCost,
  providerCouldBeSwapped,
} from "@/lib/ai-gateway.server";
import { isConfiguredLocalAiService } from "@/lib/ai-local-services.server";

describe("AI provider fallback routing", () => {
  it("tries Ollama, Founder AI, free, paid, then unknown-cost services", () => {
    const services = orderAiServicesByCost([
      { name: "OpenAI", slug: "openai", pricing_tier: "paid" },
      { name: "Groq", slug: "groq", pricing_tier: "free-tier" },
      { name: "Founder AI", slug: "founder-ai-local", pricing_tier: "local" },
      { name: "Ollama", slug: "ollama-local", pricing_tier: "local" },
      { name: "Unknown", pricing_tier: "unknown" },
    ]);

    expect(services.map((service) => service.name)).toEqual([
      "Ollama",
      "Founder AI",
      "Groq",
      "OpenAI",
      "Unknown",
    ]);
  });

  it("caps test calls at local providers without admitting free or paid services", () => {
    expect(isAiPricingTierAllowed("local", "local")).toBe(true);
    expect(isAiPricingTierAllowed("free-tier", "local")).toBe(false);
    expect(isAiPricingTierAllowed("paid", "local")).toBe(false);
    expect(isAiPricingTierAllowed("paid", "free")).toBe(false);
    expect(isAiPricingTierAllowed("paid", "paid")).toBe(true);
    expect(isAiPricingTierAllowed("unknown", "paid")).toBe(false);
  });

  it("allows failover for provider outages and quota failures, not invalid requests", () => {
    expect(providerCouldBeSwapped(503, "Service unavailable")).toBe(true);
    expect(providerCouldBeSwapped(0, "fetch failed")).toBe(true);
    expect(providerCouldBeSwapped(401, "Invalid provider credential")).toBe(true);
    expect(providerCouldBeSwapped(400, "Your credit balance is too low")).toBe(true);
    expect(providerCouldBeSwapped(404, "Model qwen is not found")).toBe(true);
    expect(providerCouldBeSwapped(400, "Invalid model request")).toBe(false);
  });

  it("only accepts the exact registered loopback endpoints for local services", () => {
    expect(
      isConfiguredLocalAiService(
        "ollama-local",
        "local",
        "http://127.0.0.1:11434/v1/chat/completions",
      ),
    ).toBe(true);
    expect(
      isConfiguredLocalAiService(
        "founder-ai-local",
        "local",
        "http://127.0.0.1:5200/v1/chat/completions",
      ),
    ).toBe(true);
    expect(
      isConfiguredLocalAiService(
        "ollama-local",
        "local",
        "http://169.254.169.254/latest/meta-data",
      ),
    ).toBe(false);
    expect(
      isConfiguredLocalAiService(
        "unregistered-local",
        "local",
        "http://127.0.0.1:11434/v1/chat/completions",
      ),
    ).toBe(false);
  });
});
