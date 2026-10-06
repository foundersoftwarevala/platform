import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_COOKIE, demoCookiePath, issueDemoTicket, ticketFromRequest } from "./ticket";

describe("demo asset tickets", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_TICKET_SECRET", "test-only-demo-ticket-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function token(slug: string): string {
    const value = issueDemoTicket(slug, "verified-visitor");
    if (!value) throw new Error("Test ticket issuance failed");
    return value;
  }

  function request(slug: string, values: string[], query = ""): Request {
    return new Request(`https://softwarevala.net/api/proxy/demo/${slug}/assets/app.js${query}`, {
      headers: { cookie: values.map((value) => `${DEMO_COOKIE}=${value}`).join("; ") },
    });
  }

  it("scopes each cookie to its product rather than the shared proxy root", () => {
    expect(demoCookiePath("art-drawing-classes")).toBe("/api/proxy/demo/art-drawing-classes");
    expect(demoCookiePath("food-truck-pos")).toBe("/api/proxy/demo/food-truck-pos");
    expect(demoCookiePath("a;b")).toBe("/api/proxy/demo/a%3Bb");
  });

  it("keeps simultaneous product asset requests independent of cookie ordering", () => {
    const art = token("art");
    const food = token("food");
    for (const cookies of [
      [art, food],
      [food, art],
    ]) {
      expect(ticketFromRequest(request("art", cookies), "art")?.slug).toBe("art");
      expect(ticketFromRequest(request("food", cookies), "food")?.slug).toBe("food");
    }
  });

  it("accepts a still-valid legacy cookie for the same product", () => {
    expect(ticketFromRequest(request("art", [token("art")]), "art")?.slug).toBe("art");
  });

  it("does not authorize another product's assets", () => {
    expect(ticketFromRequest(request("art", [token("food")]), "art")).toBeNull();
  });

  it("ignores malformed and invalid cookies without hiding a valid matching pass", () => {
    expect(
      ticketFromRequest(request("art", ["%broken", "invalid", token("art")]), "art")?.slug,
    ).toBe("art");
  });

  it("accepts a matching query ticket and rejects a different product's query ticket", () => {
    const art = token("art");
    expect(ticketFromRequest(request("art", [], `?t=${art}`), "art")?.slug).toBe("art");
    expect(ticketFromRequest(request("art", [art], `?t=${token("food")}`), "art")).toBeNull();
  });

  it("rejects expired and tampered tickets", () => {
    vi.useFakeTimers();
    const art = token("art");
    expect(ticketFromRequest(request("art", [`${art}x`]), "art")).toBeNull();
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(ticketFromRequest(request("art", [art]), "art")).toBeNull();
  });
});
