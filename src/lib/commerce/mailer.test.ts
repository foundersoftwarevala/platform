import { afterEach, describe, expect, it, vi } from "vitest";
import { queue } from "./mailer";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("mail queue idempotency", () => {
  it("does not require the new column for existing unkeyed messages", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{ id: "mail-1" }], { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      queue({ to: "owner@example.test", subject: "Alert", html: "<p>Alert</p>" }),
    ).resolves.toBe("mail-1");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.has("on_conflict")).toBe(false);
    expect(JSON.parse(String(init.body))).not.toHaveProperty("idempotency_key");
  });

  it("returns the prior outbox row when the same keyed message is retried", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([], { status: 201 }))
      .mockResolvedValueOnce(Response.json([{ id: "mail-existing" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      queue({
        to: "owner@example.test",
        subject: "Alert",
        html: "<p>Alert</p>",
        idempotencyKey: "aa44a251-742a-4a95-a256-45d735812809",
      }),
    ).resolves.toBe("mail-existing");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("on_conflict")).toBe("idempotency_key");
    expect(new Headers(init.headers).get("prefer")).toContain("resolution=ignore-duplicates");
    expect(JSON.parse(String(init.body)).idempotency_key).toBe(
      "aa44a251-742a-4a95-a256-45d735812809",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
