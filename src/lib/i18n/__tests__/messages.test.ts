import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatMessage, parseMessage } from "../format";
import { MODULES, allMessages, isMessageKey, messageContext, messageText } from "../messages";
import { richText } from "../use-translation";

// The server translator reaches the database through service.server; the
// pipeline call is replaced here so these tests need neither.
const translateForCaller = vi.fn();
vi.mock("../service.server", () => ({
  log: () => undefined,
  translateForCaller: (...args: unknown[]) => translateForCaller(...args),
}));

const { englishTranslator, languageOf, serverTranslator } =
  await import("../server-translate.server");
// @ts-expect-error - plain JavaScript module without type declarations
const { icuVariables } = await import("../../../../scripts/i18n-catalogue-check.mjs");

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

describe("message catalogue", () => {
  it("keys start with their module, and the module is the context", () => {
    for (const [module, messages] of Object.entries(MODULES)) {
      for (const key of Object.keys(messages)) {
        expect(key.startsWith(`${module}.`)).toBe(true);
        expect(messageContext(key)).toBe(module);
        expect(isMessageKey(key)).toBe(true);
      }
    }
    expect(isMessageKey("Sign in")).toBe(false);
    expect(messageText("no.such.key")).toBeUndefined();
  });

  it("every message parses and formats in English, Russian and Arabic", () => {
    for (const { key, text } of allMessages()) {
      expect(() => parseMessage(text), key).not.toThrow();
      const values = Object.fromEntries([...icuVariables(text)].map((name: string) => [name, 3]));
      for (const code of ["en", "ru", "ar"]) {
        const out = formatMessage(text, values, code);
        expect(out.trim().length, `${key} in ${code}`).toBeGreaterThan(0);
        expect(out, `${key} in ${code} left a placeholder unfilled`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("selects pick their branch and fall back to other", () => {
    expect(
      formatMessage(messageText("account.status")!, { status: "awaiting_payment" }, "en"),
    ).toBe("Awaiting payment");
    expect(formatMessage(messageText("account.status")!, { status: "refunded" }, "en")).toBe(
      "refunded",
    );
  });

  it("the catalogue is English only", () => {
    for (const { key, text } of allMessages()) {
      const letters = text.match(/\p{L}/gu) ?? [];
      const latin = text.match(/\p{Script=Latin}/gu) ?? [];
      expect(latin.length, key).toBe(letters.length);
    }
  });
});

describe("ICU validation used by the CI check", () => {
  it("returns the variables of a valid message", () => {
    expect([...icuVariables("Hi {name}, {count, plural, one {# item} other {# items}}")]).toEqual([
      "name",
      "count",
    ]);
  });

  it.each([
    ["{count, plural, one {# item}}", "other"],
    ["{count, plural, several {#} other {#}}", "plural category"],
    ["Hello {name", "unclosed"],
    ["Hello name}", "unbalanced"],
    ["# items", "outside a plural"],
  ])("rejects %s", (message, reason) => {
    expect(() => icuVariables(message)).toThrow(reason);
  });
});

describe("richText", () => {
  it("puts elements where the translation has the placeholders", () => {
    const parts = richText("Bienvenido, {name}. {link}", { name: "N", link: "L" });
    const flat = parts.map((p) => (p as { props: { children: unknown } }).props.children);
    expect(flat).toEqual(["Bienvenido, ", "N", ". ", "L", ""]);
  });
});

describe("server translation", () => {
  beforeEach(() => {
    translateForCaller.mockReset();
  });

  const request = (headers: Record<string, string>) =>
    new Request("https://example.test/", { headers });

  it("reads the language from the site cookie, then Accept-Language", () => {
    expect(languageOf(request({ cookie: "a=1; sv_locale=pt-BR" }))).toBe("pt-BR");
    expect(languageOf(request({ "accept-language": "ar,en;q=0.5" }))).toBe("ar");
    // A regional variant the registry has is kept; one it does not have falls back.
    expect(languageOf(request({ "accept-language": "pt-BR,pt;q=0.9" }))).toBe("pt-BR");
    expect(languageOf(request({ "accept-language": "pt-AO" }))).toBe("pt");
    expect(languageOf(request({ cookie: "sv_locale=xx-nonsense", "accept-language": "hi" }))).toBe(
      "hi",
    );
    expect(languageOf(request({}))).toBe("en");
  });

  it("prioritizes valid explicit locale URLs and preserves cookie fallback for invalid ones", () => {
    expect(
      languageOf(
        new Request("https://example.test/?lang=ar", { headers: { cookie: "sv_locale=hi" } }),
      ),
    ).toBe("ar");
    expect(
      languageOf(
        new Request("https://example.test/?lang=unknown", { headers: { cookie: "sv_locale=hi" } }),
      ),
    ).toBe("hi");
  });
  it("English needs no pipeline call", async () => {
    const t = await serverTranslator("en", ["email"]);
    expect(t("email.hello", { name: "Asha" })).toBe("Hello Asha,");
    expect(translateForCaller).not.toHaveBeenCalled();
    expect(englishTranslator()("email.licence.heading")).toBe("Your licence is ready");
  });

  it("resolves normalized real catalogue text and retains source spacing", async () => {
    const entry = allMessages().find((message) => message.text !== message.text.trim());
    if (!entry || !isMessageKey(entry.key))
      throw new Error("Expected a real whitespace-bearing catalogue message.");
    translateForCaller.mockResolvedValue({
      outcomes: [{ text: entry.text.trim(), translation: "Software Vala", status: "verified" }],
    });
    const t = await serverTranslator("hi", [entry.context]);
    expect(t(entry.key)).toBe(
      (entry.text.match(/^\s*/)?.[0] ?? "") +
        "Software Vala" +
        (entry.text.match(/\s*$/)?.[0] ?? ""),
    );
  });
  it("uses accepted translations and English for the rest; never anything else", async () => {
    translateForCaller.mockResolvedValue({
      outcomes: [
        {
          text: messageText("email.licence.heading"),
          translation: "आपका लाइसेंस तैयार है",
          status: "machine",
        },
        { text: messageText("email.hello"), translation: "नमस्ते {name},", status: "verified" },
        { text: messageText("email.lead.heading"), translation: "rubbish", status: "needs_review" },
      ],
    });
    const t = await serverTranslator("hi", ["email"]);
    const [request] = translateForCaller.mock.calls[0] as [{ context: string; target: string }];
    expect(request.context).toBe("email");
    expect(request.target).toBe("hi");
    expect(t("email.licence.heading")).toBe("आपका लाइसेंस तैयार है");
    expect(t("email.hello", { name: "Asha" })).toBe("नमस्ते Asha,");
    // Held for review: not used.
    expect(t("email.lead.heading")).toBe("We have your request");
  });

  it("does not wait longer than asked when the engine is slow", async () => {
    translateForCaller.mockReturnValue(new Promise(() => undefined));
    const started = Date.now();
    const t = await serverTranslator("fr", ["email"], { waitMs: 50 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(t("email.licence.heading")).toBe("Your licence is ready");
  });
});

describe("CI check", () => {
  it("extracts identical source text from Windows and Unix line endings", () => {
    const samples = ["First\r\nSecond\rThird\n", 'const text = "First\\r\\nSecond";'];
    const result = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { normalizeSourceLineEndings } from "./scripts/i18n-audit.mjs";
         console.log(JSON.stringify(${JSON.stringify(samples)}.map(normalizeSourceLineEndings)));`,
      ],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(JSON.parse(result)).toEqual(["First\nSecond\nThird\n", samples[1]]);
  });
  it("passes on the current code: no new hardcoded text, a valid catalogue", () => {
    const run = () =>
      execFileSync(process.execPath, ["scripts/i18n-audit.mjs", "--check"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: "pipe",
      });
    expect(run).not.toThrow();
  }, 120_000);
});
