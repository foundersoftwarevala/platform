import { describe, expect, it } from "vitest";

import { LANGUAGES } from "@/hooks/use-preferences";

import { SUPPORTED_LANGUAGES, SUPPORTED_LANGUAGE_COUNT } from "../registry";

describe("chat translation languages", () => {
  it("offers every supported language, once, with its own name", () => {
    expect(LANGUAGES).toHaveLength(SUPPORTED_LANGUAGE_COUNT);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(SUPPORTED_LANGUAGE_COUNT);
    expect(new Set(LANGUAGES.map((l) => l.label)).size).toBe(SUPPORTED_LANGUAGE_COUNT);
    expect(LANGUAGES.map((l) => l.code)).toEqual(SUPPORTED_LANGUAGES.map((l) => l.code));
  });

  it("includes the right-to-left and regional languages", () => {
    const codes = LANGUAGES.map((l) => l.code);
    for (const code of ["ar", "he", "ur", "fa", "sd", "ug", "dv", "pt-BR", "es-AR", "zh-Hant"]) {
      expect(codes).toContain(code);
    }
  });
});
