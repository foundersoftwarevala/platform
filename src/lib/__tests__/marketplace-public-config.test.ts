import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveMarketplacePublicConfig } from "../marketplace-public-config";

describe("marketplace public Supabase configuration", () => {
  it("uses only publishable or anonymous keys for public clients", () => {
    expect(
      resolveMarketplacePublicConfig(
        { VITE_SUPABASE_URL: "https://public.example", VITE_SUPABASE_ANON_KEY: "anon-key" },
        { SUPABASE_SERVICE_ROLE_KEY: "service-role-key" },
      ),
    ).toEqual({ url: "https://public.example", key: "anon-key" });
  });

  it("fails closed when only a service-role key is configured", () => {
    expect(() =>
      resolveMarketplacePublicConfig(
        { VITE_SUPABASE_URL: "https://public.example" },
        { SUPABASE_SERVICE_ROLE_KEY: "service-role-key" },
      ),
    ).toThrow("Missing Supabase environment configuration");
  });

  it("prefers the server URL and publishable key without selecting the service key", () => {
    expect(
      resolveMarketplacePublicConfig(
        { VITE_SUPABASE_URL: "https://hosted.example" },
        {
          SUPABASE_URL: "https://server.example",
          SUPABASE_PUBLISHABLE_KEY: "server-publishable",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        },
      ),
    ).toEqual({ url: "https://server.example", key: "server-publishable" });
  });
});

describe("Marketplace demo module bundle inputs", () => {
  it("contains no hardcoded demo login credentials", () => {
    const source = readFileSync(new URL("../marketplace-manager/demo.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/admin@demo\.io|sales@demo\.io|demo1234/);
  });
});
