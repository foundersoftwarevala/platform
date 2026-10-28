import { describe, expect, it, vi } from "vitest";

import {
  readScannerCount,
  readScannerProviderStatus,
  readScannerRows,
} from "./scanner-console.server";

const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

describe("scanner console reads", () => {
  it("rejects failed row reads instead of presenting an empty result", async () => {
    const fetcher = vi.fn(async () => response({ message: "unavailable" }, 503));

    await expect(
      readScannerRows("http://vps.local", {}, "security_scan_jobs", fetcher),
    ).rejects.toThrow("Scanner read failed (503)");
  });

  it("rejects failed exact counts instead of returning zero", async () => {
    const fetcher = vi.fn(async () => response({}, 503));

    await expect(
      readScannerCount("http://vps.local", {}, "security_scan_jobs", fetcher),
    ).rejects.toThrow("Scanner count failed (503)");
  });

  it("requires a real exact total in the count response", async () => {
    const fetcher = vi.fn(async () => response([], 200, { "content-range": "0-0/*" }));

    await expect(
      readScannerCount("http://vps.local", {}, "security_scan_jobs", fetcher),
    ).rejects.toThrow("did not include an exact total");
  });

  it("accepts an exact zero count", async () => {
    const fetcher = vi.fn(async () => response([], 200, { "content-range": "*/0" }));

    await expect(
      readScannerCount("http://vps.local", {}, "security_scan_jobs", fetcher),
    ).resolves.toBe(0);
  });

  it("rejects provider status failures rather than reporting no provider", async () => {
    const fetcher = vi.fn(async () => response({ message: "unavailable" }, 503));

    await expect(readScannerProviderStatus("http://vps.local", {}, fetcher)).rejects.toThrow(
      "Scanner provider status failed (503)",
    );
  });
});
