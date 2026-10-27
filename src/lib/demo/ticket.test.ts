import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_COOKIE,
  demoCookiePath,
  issueDemoTicket,
  readDemoTicket,
  ticketFromRequest,
} from "./ticket";

const SESSION_A = "54c1c6a9-2423-48b3-a26f-9879a8d75c83";
const SESSION_B = "8086cf05-5924-4d64-af0a-b75a06d251aa";
const DEMO_A = "6a193884-f46f-4f3d-af68-c005b43a2c89";
const DEMO_B = "4ea1f878-ea2c-4c33-9dad-0ae10fd27ce2";
const CATEGORY = "6b12d20f-f009-4f7b-aa18-29fdb9fd2fad";

describe("demo asset tickets", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_TICKET_SECRET", "test-only-demo-ticket-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function token(slug: string, sessionId = SESSION_A, demoId = DEMO_A): string {
    const value = issueDemoTicket(slug, sessionId, demoId, CATEGORY);
    if (!value) throw new Error("Test ticket issuance failed");
    return value;
  }

  function request(slug: string, sessionId: string, values: string[], query = ""): Request {
    return new Request(
      `https://softwarevala.net/api/proxy/demo/${slug}/${sessionId}/assets/app.js${query}`,
      { headers: { cookie: values.map((value) => `${DEMO_COOKIE}=${value}`).join("; ") } },
    );
  }

  it("scopes each cookie to one product and visitor session", () => {
    expect(demoCookiePath("art-drawing-classes", SESSION_A)).toBe(
      `/api/proxy/demo/art-drawing-classes/${SESSION_A}`,
    );
    expect(demoCookiePath("food-truck-pos", SESSION_B)).toBe(
      `/api/proxy/demo/food-truck-pos/${SESSION_B}`,
    );
    expect(demoCookiePath("a;b", SESSION_A)).toBe(`/api/proxy/demo/a%3Bb/${SESSION_A}`);
  });

  it("keeps simultaneous sessions for the same product independent", () => {
    const first = token("art", SESSION_A, DEMO_A);
    const second = token("art", SESSION_B, DEMO_B);
    expect(
      ticketFromRequest(request("art", SESSION_A, [second, first]), "art", SESSION_A),
    ).toMatchObject({
      sessionId: SESSION_A,
      demoId: DEMO_A,
    });
    expect(
      ticketFromRequest(request("art", SESSION_B, [first, second]), "art", SESSION_B),
    ).toMatchObject({
      sessionId: SESSION_B,
      demoId: DEMO_B,
    });
  });

  it("rejects a ticket from a different visitor session", () => {
    expect(
      ticketFromRequest(request("art", SESSION_B, [token("art", SESSION_A)]), "art", SESSION_B),
    ).toBeNull();
  });

  it("accepts a matching query ticket and rejects another product's ticket", () => {
    const art = token("art");
    expect(ticketFromRequest(request("art", SESSION_A, [], `?t=${art}`), "art")?.sessionId).toBe(
      SESSION_A,
    );
    expect(
      ticketFromRequest(request("art", SESSION_A, [art], `?t=${token("food")}`), "art"),
    ).toBeNull();
  });

  it("rejects expired, malformed and tampered tickets", () => {
    vi.useFakeTimers();
    const ticket = token("art");
    expect(readDemoTicket(`${ticket}x`)).toBeNull();
    expect(readDemoTicket("malformed")).toBeNull();
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(readDemoTicket(ticket)).toBeNull();
  });
});
