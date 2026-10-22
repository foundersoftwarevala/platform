import { afterEach, describe, expect, it, vi } from "vitest";

import {
  affiliateAttributionAllowed,
  isAffiliateSelfReferral,
} from "@/lib/affiliate/core.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("affiliate referral ownership", () => {
  it("blocks attribution when the buyer owns the affiliate account", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([{ user_id: "buyer-1" }])),
    );

    await expect(isAffiliateSelfReferral("partner-1", "buyer-1")).resolves.toBe(true);
    expect(affiliateAttributionAllowed("buyer-1", "buyer-1")).toBe(false);
  });

  it("allows attribution only when the affiliate belongs to another user", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([{ user_id: "affiliate-owner" }])),
    );

    await expect(isAffiliateSelfReferral("partner-1", "buyer-1")).resolves.toBe(false);
    expect(affiliateAttributionAllowed("affiliate-owner", "buyer-1")).toBe(true);
  });

  it("fails closed when affiliate ownership cannot be confirmed", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    await expect(isAffiliateSelfReferral("partner-1", "buyer-1")).rejects.toThrow(
      "Could not verify affiliate ownership",
    );
  });
});
