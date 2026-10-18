import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetch } = vi.hoisted(() => ({ safeFetch: vi.fn() }));

vi.mock("@/lib/demo/safe-fetch.server", () => ({ safeFetch }));

import { checkUrl } from "@/lib/demo/url-check.server";

describe("checkUrl", () => {
  beforeEach(() => safeFetch.mockReset());

  it("uses the shared public-address fetcher and reports its status and TLS metadata", async () => {
    safeFetch.mockResolvedValue({
      url: "https://demo.example/",
      status: 200,
      contentType: "text/html",
      body: "",
      redirects: [],
      sslValid: true,
      sslDays: 30,
    });

    await expect(checkUrl("https://demo.example/")).resolves.toMatchObject({
      status: 200,
      result: "working",
      ssl_valid: true,
      ssl_days: 30,
      error: null,
    });
    expect(safeFetch).toHaveBeenCalledWith("https://demo.example/", {
      maxBytes: 64_000,
      timeoutMs: 10_000,
      maxRedirects: 5,
    });
  });

  it("reports HTTP failures as offline instead of successful checks", async () => {
    safeFetch.mockResolvedValue({
      url: "https://demo.example/missing",
      status: 404,
      contentType: "text/html",
      body: "",
      redirects: [],
      sslValid: true,
      sslDays: 30,
    });

    await expect(checkUrl("https://demo.example/missing")).resolves.toMatchObject({
      status: 404,
      result: "offline",
      error: "HTTP 404",
    });
  });

  it("returns a truthful invalid-address result without making a request", async () => {
    await expect(checkUrl("not a URL")).resolves.toMatchObject({
      status: 0,
      ms: 0,
      result: "offline",
      error: "Not a valid address",
    });
    expect(safeFetch).not.toHaveBeenCalled();
  });
});
