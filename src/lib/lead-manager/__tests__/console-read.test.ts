import { describe, expect, it, vi } from "vitest";
import { readAllLeadConsoleRows } from "../console-read.server";

function page(
  rows: Record<string, unknown>[],
  first: number | null,
  last: number | null,
  total: number,
) {
  return new Response(JSON.stringify(rows), {
    status: total > rows.length ? 206 : 200,
    headers: {
      "content-range": `${first === null ? "*" : `${first}-${last}`}/${total}`,
      "content-type": "application/json",
    },
  });
}

describe("readAllLeadConsoleRows", () => {
  it("reads every row in stable, exact-count pages", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page([{ id: "lead-1" }, { id: "lead-2" }], 0, 1, 3))
      .mockResolvedValueOnce(page([{ id: "lead-3" }], 2, 2, 3));

    await expect(
      readAllLeadConsoleRows(
        "http://127.0.0.1:3010",
        { apikey: "test" },
        "leads?select=id",
        fetcher,
        2,
      ),
    ).resolves.toEqual([{ id: "lead-1" }, { id: "lead-2" }, { id: "lead-3" }]);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3010/rest/v1/leads?select=id&order=id.asc",
      expect.objectContaining({
        headers: expect.objectContaining({ Range: "0-1", Prefer: "count=exact" }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3010/rest/v1/leads?select=id&order=id.asc",
      expect.objectContaining({
        headers: expect.objectContaining({ Range: "2-3", Prefer: "count=exact" }),
      }),
    );
  });

  it("continues when the VPS gateway caps a requested page below its range", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page([{ id: "lead-1" }, { id: "lead-2" }], 0, 1, 4))
      .mockResolvedValueOnce(page([{ id: "lead-3" }, { id: "lead-4" }], 2, 3, 4));

    await expect(
      readAllLeadConsoleRows("http://127.0.0.1:3010", {}, "leads?select=id", fetcher, 3),
    ).resolves.toEqual([{ id: "lead-1" }, { id: "lead-2" }, { id: "lead-3" }, { id: "lead-4" }]);
  });

  it("returns an empty array only for a successful, exact empty result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(page([], null, null, 0));
    await expect(
      readAllLeadConsoleRows("http://127.0.0.1:3010", {}, "leads?select=id", fetcher),
    ).resolves.toEqual([]);
  });

  it("throws instead of presenting partial data as a complete breakdown", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page([{ id: "lead-1" }], 0, 0, 2))
      .mockResolvedValueOnce(page([], null, null, 2));
    await expect(
      readAllLeadConsoleRows("http://127.0.0.1:3010", {}, "leads?select=id", fetcher, 1),
    ).rejects.toThrow("Lead console returned an incomplete page.");
  });

  it("rejects failed reads and missing exact totals", async () => {
    const failed = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      readAllLeadConsoleRows("http://127.0.0.1:3010", {}, "leads?select=id", failed),
    ).rejects.toThrow("Lead console read failed (503).");

    const missingTotal = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("[]", { headers: { "content-range": "0-0/*" } }));
    await expect(
      readAllLeadConsoleRows("http://127.0.0.1:3010", {}, "leads?select=id", missingTotal),
    ).rejects.toThrow("Lead console read did not return an exact total.");
  });
});
