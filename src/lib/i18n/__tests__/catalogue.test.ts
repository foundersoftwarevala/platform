import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

import { STATIC_CATALOGUE, publicCatalogue, invalidatePublicCatalogue } from "../catalogue.server";

function client(rows: { source_text: string }[]) {
  const query = vi.fn<(strings: TemplateStringsArray) => Promise<{ source_text: string }[]>>(
    async () => rows,
  );
  return { query, sql: query as unknown as Sql };
}

beforeEach(() => {
  invalidatePublicCatalogue();
});

describe("trusted native source catalogue", () => {
  it("includes existing unkeyed UI strings without trusting visitor text", () => {
    expect(STATIC_CATALOGUE.has("Share")).toBe(true);
    expect(STATIC_CATALOGUE.has("Private customer order 7744")).toBe(false);
  });

  it("reads only the explicit public-copy database function and deduplicates", async () => {
    const { query, sql } = client([
      { source_text: "Published product description" },
      { source_text: " Published product description " },
    ]);
    const texts = await publicCatalogue(sql);
    expect(texts.has("Published product description")).toBe(true);
    expect(texts.has("Private customer order 7744")).toBe(false);
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain("i18n_public_catalogue_texts");
    expect(await publicCatalogue(sql)).toBe(texts);
    expect(query).toHaveBeenCalledOnce();
  });

  it("does not cache a failed read or silently broaden allowed text", async () => {
    const { query, sql } = client([]);
    query.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(publicCatalogue(sql)).rejects.toThrow("database unavailable");
    expect((await publicCatalogue(sql)).has("Share")).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("removes unpublished text after invalidation rather than merging old snapshots", async () => {
    const { query, sql } = client([{ source_text: "Published description" }]);
    expect((await publicCatalogue(sql)).has("Published description")).toBe(true);
    invalidatePublicCatalogue();
    query.mockResolvedValue([]);
    expect((await publicCatalogue(sql)).has("Published description")).toBe(false);
  });
});
