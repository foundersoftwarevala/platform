import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DICTIONARY_LANGUAGES,
  LANGUAGE_REGISTRY,
  SOURCE_LANGUAGE,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_COUNT,
  getDirection,
  getFallbackChain,
  getLanguage,
  isRtl,
  normalizeLanguageCode,
  resolveLanguage,
} from "../registry";
import { UI_DICTIONARY } from "../ui-dictionary";

const BCP47 = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/;

describe("language registry", () => {
  it("supports exactly 140 languages, with unique canonical codes", () => {
    expect(SUPPORTED_LANGUAGE_COUNT).toBe(140);
    expect(SUPPORTED_LANGUAGES).toHaveLength(140);
    expect(SUPPORTED_LANGUAGES.every((l) => l.enabled && l.replacedBy === null)).toBe(true);
    const codes = LANGUAGE_REGISTRY.map((l) => l.code.toLowerCase());
    expect(new Set(codes).size).toBe(LANGUAGE_REGISTRY.length);
  });

  it("keeps retired languages only as redirects to an active language", () => {
    const retired = LANGUAGE_REGISTRY.filter((l) => !l.enabled);
    expect(retired.map((l) => [l.code, l.replacedBy])).toEqual([
      ["yue", "zh-Hant"],
      ["ng", "en"],
      ["ku", "ckb"],
      ["qu", "es"],
      ["ay", "es"],
    ]);
    for (const language of retired) {
      expect(language.translationStatus).toBe("retired");
      expect(getLanguage(language.replacedBy!)!.enabled).toBe(true);
    }
    expect(normalizeLanguageCode("yue")).toBe("zh-Hant");
    expect(normalizeLanguageCode("yue-HK")).toBe("zh-Hant");
    expect(normalizeLanguageCode("ng")).toBe("en");
    expect(resolveLanguage("yue", { includeDisabled: true })!.code).toBe("yue");
    // Their places were taken by Javanese, Oromo, Tatar and Maithili, each of
    // which the translation engine actually supports.
    for (const code of ["jv", "om", "tt", "mai", "dv"])
      expect(getLanguage(code)!.enabled, code).toBe(true);
    expect(normalizeLanguageCode("ku")).toBe("ckb");
    expect(normalizeLanguageCode("qu")).toBe("es");
  });

  it("uses valid BCP 47 tags, ISO codes, ISO 15924 scripts and formatting locales", () => {
    for (const language of LANGUAGE_REGISTRY) {
      expect(language.code, language.name).toMatch(BCP47);
      expect(language.iso639_3).toMatch(/^[a-z]{3}$/);
      if (language.iso639_1 !== null) expect(language.iso639_1).toMatch(/^[a-z]{2}$/);
      expect(language.script).toMatch(/^[A-Z][a-z]{3}$/);
      expect(["ltr", "rtl"]).toContain(language.direction);
      if (language.region !== null) {
        expect(language.region).toMatch(/^[A-Z]{2}$/);
        expect(language.code.endsWith(`-${language.region}`)).toBe(true);
      }
      expect(() => new Intl.Locale(language.code)).not.toThrow();
      expect(() => new Intl.Locale(language.locale)).not.toThrow();
      expect(() => new Intl.NumberFormat(language.formatLocale)).not.toThrow();
      if (language.pluralLocale !== null)
        expect(() => new Intl.PluralRules(language.pluralLocale!)).not.toThrow();
      expect(language.name.length).toBeGreaterThan(0);
      expect(language.nativeName.length).toBeGreaterThan(0);
    }
  });

  it("agrees with CLDR likely subtags on script", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(new Intl.Locale(language.code).maximize().script, language.code).toBe(language.script);
    }
  });

  it("never lets an alias shadow a code or another alias", () => {
    const seen = new Map<string, string>();
    for (const language of LANGUAGE_REGISTRY) {
      for (const key of [language.code.toLowerCase(), ...language.aliases]) {
        expect(
          seen.get(key),
          `${key} used by ${seen.get(key)} and ${language.code}`,
        ).toBeUndefined();
        seen.set(key, language.code);
      }
    }
  });

  it("has fallback chains that exist, end at the source language and never loop", () => {
    for (const language of LANGUAGE_REGISTRY) {
      for (const next of language.fallback)
        expect(getLanguage(next), `${language.code} -> ${next}`).toBeDefined();
      const chain = getFallbackChain(language.code);
      expect(chain[0]).toBe(language.code);
      expect(chain[chain.length - 1]).toBe(SOURCE_LANGUAGE);
      expect(new Set(chain).size).toBe(chain.length);
    }
    expect(getFallbackChain("pt-BR")).toEqual(["pt-BR", "pt", "en"]);
    expect(getFallbackChain("en-AU")).toEqual(["en-AU", "en-GB", "en"]);
    expect(getFallbackChain("mai")).toEqual(["mai", "hi", "en"]);
    expect(getFallbackChain("tt")).toEqual(["tt", "ru", "en"]);
    expect(getFallbackChain("en")).toEqual(["en"]);
    expect(getFallbackChain("not-a-language")).toEqual(["en"]);
  });

  it("marks exactly the right-to-left languages", () => {
    const rtl = SUPPORTED_LANGUAGES.filter((l) => l.direction === "rtl")
      .map((l) => l.code)
      .sort();
    expect(rtl).toEqual(
      [
        "ar",
        "ar-AE",
        "ar-EG",
        "ar-MA",
        "ckb",
        "dv",
        "fa",
        "he",
        "ps",
        "sd",
        "ug",
        "ur",
        "yi",
      ].sort(),
    );
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("ur")).toBe(true);
    expect(isRtl("he")).toBe(true);
    expect(isRtl("ckb")).toBe(true); // Sorani Kurdish is written in Arabic script.
    expect(getDirection("es-AR")).toBe("ltr"); // Spanish in Argentina is not Arabic.
    expect(getDirection("unknown")).toBe("ltr");
  });

  it("keeps translation status in step with the UI dictionary", () => {
    expect(new Set(Object.keys(UI_DICTIONARY))).toEqual(new Set(DICTIONARY_LANGUAGES));
    for (const language of SUPPORTED_LANGUAGES) {
      const expected =
        language.code === SOURCE_LANGUAGE
          ? "source"
          : DICTIONARY_LANGUAGES.includes(language.code)
            ? "partial"
            : "machine";
      expect(language.translationStatus, language.code).toBe(expected);
    }
    const source = new Set(Object.keys(UI_DICTIONARY.en!));
    for (const [code, entries] of Object.entries(UI_DICTIONARY)) {
      for (const key of Object.keys(entries)) expect(source.has(key), `${code}: ${key}`).toBe(true);
    }
  });

  it("gives languages without CLDR plural data an explicit rule", () => {
    const otherOnly = SUPPORTED_LANGUAGES.filter((l) => l.pluralLocale === null)
      .map((l) => l.code)
      .sort();
    expect(otherOnly).toEqual(["fj", "gn", "ht", "mi", "sm"]);
    expect(getLanguage("tg")!.pluralLocale).toBe("fa");
    expect(getLanguage("rw")!.pluralLocale).toBe("sw");
    expect(getLanguage("la")!.pluralLocale).toBe("en");
    expect(getLanguage("tt")!.pluralLocale).toBe("tr");
    expect(getLanguage("mai")!.pluralLocale).toBe("hi");
    expect(getLanguage("dv")!.formatLocale).toBe("en-MV"); // CLDR has no dv number or date data
    expect(getLanguage("dv")!.script).toBe("Thaa");
    expect(getLanguage("sm")!.formatLocale).toBe("en-WS");
    expect(getLanguage("gn")!.formatLocale).toBe("es-PY");
  });
});

describe("previous catalogue codes", () => {
  const legacy: Record<string, string> = {
    EN: "en",
    AM: "hy",
    AM2: "am",
    BE: "be",
    BE2: "nl-BE",
    BR: "pt-BR",
    PT: "pt",
    AR: "ar",
    AR2: "ar-EG",
    AR3: "ar-AE",
    AR4: "ar-MA",
    AR5: "es-AR",
    MX: "es-MX",
    CO: "es-CO",
    CL: "es-CL",
    PE: "es-PE",
    ZH: "zh-Hans",
    ZT: "zh-Hant",
    // Retired languages read as the language that replaced them.
    YU: "zh-Hant",
    NG: "en",
    QU: "es",
    AY: "es",
    TL: "fil",
    NO: "nb",
    KU: "ckb",
    EN2: "en-GB",
    EN5: "en-IN",
    FR2: "fr-CA",
    DE3: "de-CH",
    HAW: "haw",
  };

  it("maps every one of the 136 old codes to a distinct registry entry", () => {
    const withLegacy = LANGUAGE_REGISTRY.filter((l) => l.legacyCode);
    expect(withLegacy).toHaveLength(136);
    expect(new Set(withLegacy.map((l) => l.legacyCode)).size).toBe(136);
  });

  it.each(Object.entries(legacy))("reads stored %s as %s", (old, code) => {
    expect(normalizeLanguageCode(old, { legacy: true })).toBe(code);
  });

  it("reads bare ISO codes as ISO, not as the old meaning", () => {
    expect(normalizeLanguageCode("AM")).toBe("am"); // Amharic, not Armenian
    expect(normalizeLanguageCode("am")).toBe("am");
    expect(normalizeLanguageCode("hy")).toBe("hy");
    expect(normalizeLanguageCode("BE")).toBe("be"); // Belarusian
    expect(normalizeLanguageCode("BR")).toBeNull(); // Breton: not supported
    expect(normalizeLanguageCode("CO")).toBeNull(); // Corsican: not supported
  });

  it("accepts old codes that cannot mean anything else", () => {
    expect(normalizeLanguageCode("AR5")).toBe("es-AR");
    expect(normalizeLanguageCode("BE2")).toBe("nl-BE");
    expect(normalizeLanguageCode("MX")).toBe("es-MX");
    expect(normalizeLanguageCode("ZT")).toBe("zh-Hant");
    expect(normalizeLanguageCode("YU")).toBe("zh-Hant");
  });
});

describe("resolveLanguage", () => {
  it.each([
    ["hi", "hi"],
    ["HI", "hi"],
    [" hi ", "hi"],
    ["hi-IN", "hi"],
    ["hin", "hi"],
    ["pt-BR", "pt-BR"],
    ["pt-br", "pt-BR"],
    ["pt_BR", "pt-BR"],
    ["pt-PT", "pt"],
    ["pt-AO", "pt"],
    ["es-MX", "es-MX"],
    ["es-419", "es"],
    ["es-US", "es"],
    ["zh", "zh-Hans"],
    ["zh-CN", "zh-Hans"],
    ["zh-TW", "zh-Hant"],
    ["zh-HK", "zh-Hant"],
    ["zh-Hant-HK", "zh-Hant"],
    ["zh-Hans-SG", "zh-Hans"],
    ["en-US", "en"],
    ["en-GB", "en-GB"],
    ["en-ZA", "en"],
    ["fr-CA", "fr-CA"],
    ["fr-LU", "fr"],
    ["de-CH", "de-CH"],
    ["ar-EG", "ar-EG"],
    ["ar-SA", "ar"],
    ["ar-KW", "ar-AE"],
    ["iw", "he"],
    ["in", "id"],
    ["tl", "fil"],
    ["no", "nb"],
    ["nb-NO", "nb"],
    ["ji", "yi"],
    ["jv-ID", "jv"],
    ["om-KE", "om"],
    ["sr-Latn-RS", "sr"],
    ["ku-Arab", "ckb"],
    ["ku", "ckb"],
    ["tt-RU", "tt"],
    ["mai-IN", "mai"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected);
  });

  it("matches names only when asked", () => {
    expect(normalizeLanguageCode("Hindi")).toBeNull();
    expect(normalizeLanguageCode("Hindi", { names: true })).toBe("hi");
    expect(normalizeLanguageCode("हिन्दी", { names: true })).toBe("hi");
    expect(normalizeLanguageCode("Chinese (Simplified)", { names: true })).toBe("zh-Hans");
    expect(normalizeLanguageCode("portuguese (brazil)", { names: true })).toBe("pt-BR");
    expect(normalizeLanguageCode("Cantonese", { names: true })).toBe("zh-Hant");
  });

  it.each([
    ["", null],
    ["   ", null],
    ["xx", null],
    ["english-ish", null],
    ["en;drop table", null],
    ["a".repeat(80), null],
  ])("refuses %j", (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected);
  });

  it("refuses non-strings", () => {
    expect(resolveLanguage(null)).toBeUndefined();
    expect(resolveLanguage(undefined)).toBeUndefined();
    expect(resolveLanguage(42 as unknown as string)).toBeUndefined();
  });

  it("resolves hi, HI and Hindi to one canonical language", () => {
    const codes = new Set(
      ["hi", "HI", "Hindi"].map((v) => normalizeLanguageCode(v, { names: true })),
    );
    expect(codes).toEqual(new Set(["hi"]));
  });
});

describe("database seed", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260919000000_i18n_language_foundation.sql"),
    "utf8",
  );
  const q = "'((?:[^']|'')*)'";
  const qn = `(NULL|${q})`;
  const arr = "ARRAY\\[([^\\]]*)\\]::text\\[\\]";
  const row = new RegExp(
    `^\\s*\\(${q}, ${qn}, ${q}, ${q}, ${q}, ${qn}, ${q}, ${q}, ${q}, ${q}, ${qn}, ${q}, ${qn}, ${arr}, ${arr}, ${qn}, (\\d+)\\),?\\r?$`,
    "gm",
  );
  const rows = Array.from(sql.matchAll(row));
  const text = (v: string) => v.replace(/''/g, "'");
  const nullable = (whole: string, inner: string | undefined) =>
    whole === "NULL" ? null : text(inner ?? "");
  const list = (v: string) => (v ? v.split(",").map((s) => s.slice(1, -1)) : []);

  it("seeds the same languages as the registry, in the same order", () => {
    expect(rows).toHaveLength(LANGUAGE_REGISTRY.length);
    rows.forEach((m, index) => {
      const language = LANGUAGE_REGISTRY[index]!;
      expect({
        code: text(m[1]!),
        iso639_1: nullable(m[2]!, m[3]),
        iso639_3: text(m[4]!),
        locale: text(m[5]!),
        formatLocale: text(m[6]!),
        pluralLocale: nullable(m[7]!, m[8]),
        name: text(m[9]!),
        nativeName: text(m[10]!),
        script: text(m[11]!),
        direction: text(m[12]!),
        region: nullable(m[13]!, m[14]),
        flag: text(m[15]!),
        legacyCode: nullable(m[16]!, m[17]),
        fallback: list(m[18]!),
        aliases: list(m[19]!),
        replacedBy: nullable(m[20]!, m[21]),
        sortOrder: Number(m[22]),
      }).toEqual({
        code: language.code,
        iso639_1: language.iso639_1,
        iso639_3: language.iso639_3,
        locale: language.locale,
        formatLocale: language.formatLocale,
        pluralLocale: language.pluralLocale,
        name: language.name,
        nativeName: language.nativeName,
        script: language.script,
        direction: language.direction,
        region: language.region,
        flag: language.flag,
        legacyCode: language.legacyCode,
        fallback: [...language.fallback],
        aliases: [...language.aliases],
        replacedBy: language.replacedBy,
        sortOrder: index + 1,
      });
    });
  });

  it("marks the same languages as partially translated", () => {
    const partial = sql.match(/when v\.code in \(([^)]*)\) then 'partial'/);
    expect(partial).not.toBeNull();
    const codes = partial![1]!.split(",").map((s) => s.trim().slice(1, -1));
    expect(new Set(["en", ...codes])).toEqual(new Set(DICTIONARY_LANGUAGES));
  });
});

describe("translation engine routing", () => {
  const routing = JSON.parse(
    readFileSync(join(process.cwd(), "services/translation-engine/routing.json"), "utf8"),
  ) as {
    languages: Record<
      string,
      {
        script: string;
        direction: string;
        madlad: string;
        detect: string;
        plural: string | null;
        neighbours: string[];
      }
    >;
    retired: Record<string, string>;
  };

  it("routes every supported language to the platform's own model", () => {
    expect(Object.keys(routing.languages).sort()).toEqual(
      SUPPORTED_LANGUAGES.map((l) => l.code).sort(),
    );
    for (const language of SUPPORTED_LANGUAGES) {
      const route = routing.languages[language.code]!;
      expect(route.madlad, language.code).toBeTruthy();
      expect(route.script, language.code).toBe(language.script);
      expect(route.direction, language.code).toBe(language.direction);
      expect(route.plural, language.code).toBe(language.pluralLocale);
    }
  });

  it("lists the retired languages with the same replacements", () => {
    const retired = Object.fromEntries(
      LANGUAGE_REGISTRY.filter((l) => l.replacedBy).map((l) => [l.code, l.replacedBy]),
    );
    expect(routing.retired).toEqual(retired);
  });

  it("never treats a language's own detector label as a wrong-language suspect", () => {
    for (const [code, route] of Object.entries(routing.languages)) {
      expect(route.neighbours, code).not.toContain(route.detect);
    }
  });
});
