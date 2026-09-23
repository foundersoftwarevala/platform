import { describe, expect, it } from "vitest";

import { RATE_LIMITS, rateLimited } from "./rate-limit";

const req = (ip: string) =>
  new Request("https://softwarevala.net/api/marketplace/search?q=x", {
    headers: { "cf-connecting-ip": ip },
  });

describe("public API rate limit", () => {
  it("lets an ordinary visitor through, well above normal use", () => {
    expect(RATE_LIMITS.catalog).toBeGreaterThanOrEqual(200);
    for (let i = 0; i < 100; i++) expect(rateLimited(req("198.51.100.1"), "catalog")).toBeNull();
  });

  it("refuses a flood from one address with 429 and Retry-After", async () => {
    let refused: Response | null = null;
    for (let i = 0; i <= RATE_LIMITS.search && !refused; i++) refused = rateLimited(req("198.51.100.2"), "search");
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Retry-After")).toBe("30");
    expect(refused?.headers.get("Cache-Control")).toBe("no-store");
    expect((await refused!.json()).reason).toBe("rate_limited");
  });

  it("does not punish other visitors for one address's flood", () => {
    for (let i = 0; i <= RATE_LIMITS.search + 5; i++) rateLimited(req("198.51.100.3"), "search");
    expect(rateLimited(req("198.51.100.4"), "search")).toBeNull();
  });

  it("counts each bucket separately", () => {
    for (let i = 0; i <= RATE_LIMITS.search + 5; i++) rateLimited(req("198.51.100.5"), "search");
    expect(rateLimited(req("198.51.100.5"), "catalog")).toBeNull();
  });
});
