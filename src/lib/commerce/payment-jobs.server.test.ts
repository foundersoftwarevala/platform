import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { paymentHealth } from "@/lib/commerce/payment-jobs.server";

const endpoints = [
  "payment_event_outbox?status=eq.pending",
  "payment_event_outbox?status=eq.processing",
  "payment_event_outbox?status=eq.failed",
  "payment_event_outbox?status=eq.completed",
  "payment_event_outbox?status=eq.pending&available_at=lt.",
  "payment_intents?status=eq.pending",
];

function countedResponse(count: number, status = 200) {
  return new Response(null, {
    status,
    headers: { "content-range": `*/${count}` },
  });
}

beforeEach(() => {
  process.env.SUPABASE_URL = "http://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("payment health measurements", () => {
  it("reports measured database counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => countedResponse(0)),
    );

    const result = await paymentHealth();

    expect(result.ok).toBe(true);
    expect(result.outbox).toEqual({
      pending: 0,
      processing: 0,
      failed: 0,
      completed: 0,
      overdue: 0,
    });
    expect(result.intents.pending).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("does not report healthy when a database count request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        return countedResponse(0, url.includes(endpoints[0]) ? 503 : 200);
      }),
    );

    await expect(paymentHealth()).rejects.toThrow("HTTP 503");
  });

  it("does not treat a missing exact count as zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { headers: { "content-range": "*/" } })),
    );

    await expect(paymentHealth()).rejects.toThrow("Could not read the exact count");
  });
});
