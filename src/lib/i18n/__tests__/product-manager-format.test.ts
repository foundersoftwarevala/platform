import { describe, expect, it } from "vitest";
import { LANGUAGE_REGISTRY, SUPPORTED_LANGUAGE_COUNT, isRtl } from "../registry";
import { formatDate, formatNumber } from "../format";

/**
 * Product Manager prints dates and counts through the canonical formatters
 * (useTranslation().formatDate / formatNumber). This runs them for every
 * configured language with the exact options the studio uses, so a language
 * whose locale the runtime cannot format shows up here rather than on screen.
 */
const enabled = LANGUAGE_REGISTRY.filter((l) => (l as { enabled?: boolean }).enabled !== false);
const when = "2026-10-02T09:30:00Z";

describe("Product Manager formatting across every configured language", () => {
  it("covers the 140 configured languages", () => {
    expect(enabled.length).toBe(SUPPORTED_LANGUAGE_COUNT);
  });

  it.each(enabled.map((l) => [l.code, l] as const))("%s formats a date, a timestamp and a count", (_code, language) => {
    const day = formatDate(when, language, { dateStyle: "medium" });
    const stamp = formatDate(when, language, { dateStyle: "medium", timeStyle: "short" });
    const count = formatNumber(7365, language);
    expect(day).not.toBe("");
    expect(day).not.toBe(new Date(when).toISOString());
    expect(stamp.length).toBeGreaterThanOrEqual(day.length);
    expect(count).not.toBe("");
    // Placeholder-free: a formatter never returns a template.
    expect(`${day}${stamp}${count}`).not.toMatch(/[{}]/);
  });

  it("uses the language's own script where the locale has one", () => {
    expect(formatDate(when, "zh-Hans", { dateStyle: "medium" })).toMatch(/2026年/);
    expect(formatDate(when, "zh-Hant", { dateStyle: "medium" })).toMatch(/2026年/);
    expect(formatDate(when, "hi", { dateStyle: "medium" })).toMatch(/[ऀ-ॿ]/);
    expect(formatDate(when, "ta", { dateStyle: "medium" })).toMatch(/[஀-௿]/);
    expect(formatDate(when, "he", { dateStyle: "medium" })).toMatch(/[֐-׿]/);
    expect(isRtl("he")).toBe(true);
    // English stays English.
    expect(formatDate(when, "en", { dateStyle: "medium" })).toMatch(/Oct/);
  });
});
