import { describe, expect, it } from "vitest";

import {
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_COOKIE,
  LANGUAGE_STORAGE_KEY,
  LEGACY_LANGUAGE_STORAGE_KEY,
  applyDocumentLanguage,
  buildLanguageBootScript,
  detectBrowserLanguage,
  getCurrentLanguage,
  normalizeLanguage,
  readStoredLanguage,
  setCurrentLanguage,
  validateLanguage,
} from "../language-service";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function fakeDocument() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    cookie: "",
    documentElement: {
      lang: "",
      dir: "",
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
    },
  };
}

describe("normalizeLanguage / validateLanguage", () => {
  it("returns canonical codes and rejects unknown input", () => {
    expect(normalizeLanguage("HI")).toBe("hi");
    expect(normalizeLanguage("pt-br")).toBe("pt-BR");
    expect(normalizeLanguage("klingon")).toBeNull();
    expect(validateLanguage("es-AR")).toBe(true);
    expect(validateLanguage("")).toBe(false);
    expect(validateLanguage(null)).toBe(false);
  });
});

describe("detectBrowserLanguage", () => {
  it.each([
    [{ languages: ["pt-BR", "en"] }, "pt-BR"],
    [{ languages: ["zh-TW"] }, "zh-Hant"],
    [{ languages: ["zh-CN"] }, "zh-Hans"],
    [{ languages: ["es-MX"] }, "es-MX"],
    [{ languages: ["es-VE"] }, "es"],
    [{ languages: ["en-GB"] }, "en-GB"],
    [{ languages: ["en-US"] }, "en"],
    [{ languages: ["am-ET"] }, "am"],
    [{ languages: ["hy-AM"] }, "hy"],
    [{ languages: ["x-unknown", "fr-CA"] }, "fr-CA"],
    [{ language: "ar-EG" }, "ar-EG"],
    [{ languages: [], language: "he-IL" }, "he"],
  ])("%j -> %s", (nav, expected) => {
    expect(detectBrowserLanguage(nav)).toBe(expected);
  });

  it("returns null when nothing is supported or there is no navigator", () => {
    expect(detectBrowserLanguage({ languages: ["tlh", "x-pig-latin"] })).toBeNull();
    expect(detectBrowserLanguage(null)).toBeNull();
  });
});

describe("persistence", () => {
  it("prefers the stored choice over the browser", () => {
    const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: "ja" });
    expect(getCurrentLanguage(storage, { languages: ["de-DE"] })).toBe("ja");
  });

  it("falls back to the browser, then to English", () => {
    expect(getCurrentLanguage(memoryStorage(), { languages: ["de-AT"] })).toBe("de-AT");
    expect(getCurrentLanguage(memoryStorage(), { languages: ["tlh"] })).toBe("en");
    expect(getCurrentLanguage(null, null)).toBe("en");
  });

  it("ignores an invalid stored value", () => {
    const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: "nonsense" });
    expect(getCurrentLanguage(storage, { languages: ["it-IT"] })).toBe("it");
  });

  it("migrates a value written by the previous catalogue with its old meaning", () => {
    const storage = memoryStorage({ [LEGACY_LANGUAGE_STORAGE_KEY]: "AM" });
    expect(readStoredLanguage(storage)).toBe("hy"); // old AM = Armenian
    expect(storage.data.get(LANGUAGE_STORAGE_KEY)).toBe("hy");
    expect(storage.data.get(LEGACY_LANGUAGE_STORAGE_KEY)).toBe("AM"); // left untouched

    expect(readStoredLanguage(memoryStorage({ [LEGACY_LANGUAGE_STORAGE_KEY]: "AR5" }))).toBe(
      "es-AR",
    );
    expect(readStoredLanguage(memoryStorage({ [LEGACY_LANGUAGE_STORAGE_KEY]: "BE2" }))).toBe(
      "nl-BE",
    );
    expect(
      readStoredLanguage(memoryStorage({ [LEGACY_LANGUAGE_STORAGE_KEY]: "garbage" })),
    ).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredLanguage(broken)).toBeNull();
    expect(getCurrentLanguage(broken, { languages: ["ko-KR"] })).toBe("ko");
  });
});

describe("setCurrentLanguage", () => {
  it("stores, sets the cookie, updates <html> and announces the change", () => {
    const storage = memoryStorage();
    const doc = fakeDocument();
    const target = new EventTarget();
    const events: string[] = [];
    target.addEventListener(LANGUAGE_CHANGE_EVENT, (event) =>
      events.push((event as CustomEvent<string>).detail),
    );

    expect(setCurrentLanguage("UR", { storage, doc, target })).toBe("ur");
    expect(storage.data.get(LANGUAGE_STORAGE_KEY)).toBe("ur");
    expect(doc.cookie).toContain(`${LANGUAGE_COOKIE}=ur`);
    expect(doc.documentElement.lang).toBe("ur");
    expect(doc.documentElement.dir).toBe("rtl");
    expect(doc.attributes.get("data-lang")).toBe("ur");
    expect(events).toEqual(["ur"]);
  });

  it("changes nothing for an unsupported language", () => {
    const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: "fr" });
    const doc = fakeDocument();
    const target = new EventTarget();
    let fired = false;
    target.addEventListener(LANGUAGE_CHANGE_EVENT, () => (fired = true));

    expect(setCurrentLanguage("Elvish", { storage, doc, target })).toBeNull();
    expect(storage.data.get(LANGUAGE_STORAGE_KEY)).toBe("fr");
    expect(doc.documentElement.lang).toBe("");
    expect(fired).toBe(false);
  });
});

describe("applyDocumentLanguage", () => {
  it.each([
    ["ar", "ar", "rtl"],
    ["ur", "ur", "rtl"],
    ["he", "he", "rtl"],
    ["fa", "fa", "rtl"],
    ["ar-EG", "ar-EG", "rtl"],
    ["es-AR", "es-AR", "ltr"], // not lang="ar"
    ["nl-BE", "nl-BE", "ltr"], // not lang="be"
    ["pt-BR", "pt-BR", "ltr"], // not lang="br"
    ["zh-Hant", "zh-Hant", "ltr"],
    ["ku", "ckb", "rtl"], // Kurmanji is retired; Kurdish resolves to Sorani
    ["ckb", "ckb", "rtl"],
    ["bogus", "en", "ltr"],
  ])("%s -> lang=%s dir=%s", (input, lang, dir) => {
    const doc = fakeDocument();
    applyDocumentLanguage(input, doc);
    expect(doc.documentElement.lang).toBe(lang);
    expect(doc.documentElement.dir).toBe(dir);
  });
});

describe("buildLanguageBootScript", () => {
  function runBootScript(stored: Record<string, string>) {
    const doc = fakeDocument();
    const storage = memoryStorage(stored);
    const script = buildLanguageBootScript();
    // The script reads the page's globals; give it stand-ins.
    new Function("localStorage", "document", script)(storage, doc);
    return doc;
  }

  it("applies a stored choice before the app loads", () => {
    const doc = runBootScript({ [LANGUAGE_STORAGE_KEY]: "ar-EG" });
    expect(doc.documentElement.lang).toBe("ar-EG");
    expect(doc.documentElement.dir).toBe("rtl");
  });

  it("applies an old stored value with its old meaning", () => {
    const doc = runBootScript({ [LEGACY_LANGUAGE_STORAGE_KEY]: "AR5" });
    expect(doc.documentElement.lang).toBe("es-AR");
    expect(doc.documentElement.dir).toBe("ltr");
  });

  it("opens the replacement of a retired language", () => {
    const doc = runBootScript({ [LEGACY_LANGUAGE_STORAGE_KEY]: "YU" });
    expect(doc.documentElement.lang).toBe("zh-Hant");
    expect(readStoredLanguage(memoryStorage({ [LEGACY_LANGUAGE_STORAGE_KEY]: "YU" }))).toBe(
      "zh-Hant",
    );
    expect(readStoredLanguage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: "yue" }))).toBe("zh-Hant");
  });

  it("leaves the document alone when nothing valid is stored", () => {
    const doc = runBootScript({ [LANGUAGE_STORAGE_KEY]: "<script>" });
    expect(doc.documentElement.lang).toBe("");
  });

  it("cannot close the surrounding script element", () => {
    expect(buildLanguageBootScript()).not.toContain("<");
  });
});
