import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  LANGUAGE_SESSION_COOKIE,
  languageAuthorization,
  sameOriginMutation,
} from "../session-contract";
import { createOwnedEngineProvider } from "../engine/providers/owned-engine";
import { SUPPORTED_LANGUAGES, getLanguage } from "../registry";
import { checkRequestShape } from "../limits";

describe("native language architecture", () => {
  it("does not publish historical non-catalogue page text in public packs", () => {
    const service = readFileSync(resolve("src/lib/i18n/service.server.ts"), "utf8");
    expect(service).toContain("if (!isCatalogueText(row.source_text)) continue;");
    expect(service).not.toContain("const page = new Map<string, string>()");
  });
  it("accepts visible paragraph text without increasing the anonymous total work budget", () => {
    expect(
      checkRequestShape("anonymous", { namespace: "ui", texts: ["x".repeat(2000)] }),
    ).toBeNull();
    expect(checkRequestShape("anonymous", { namespace: "ui", texts: ["x".repeat(2001)] })).toBe(
      "item_too_long",
    );
    expect(
      checkRequestShape("anonymous", { namespace: "ui", texts: Array(4).fill("x".repeat(2000)) }),
    ).toBe("too_much_text");
  });
  it("has no transitive database gateway, external AI runtime, or browser persistence dependency", () => {
    const root = resolve("src");
    const visited = new Set<string>();
    function visit(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/(?:SUPABASE_[A-Z_]+|localStorage|\/rest\/v1|\.rpc\s*\()/);
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      function node(n: ts.Node) {
        let specifier: string | undefined;
        if (
          (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
          n.moduleSpecifier &&
          ts.isStringLiteral(n.moduleSpecifier)
        )
          specifier = n.moduleSpecifier.text;
        if (
          ts.isCallExpression(n) &&
          n.expression.kind === ts.SyntaxKind.ImportKeyword &&
          n.arguments[0] &&
          ts.isStringLiteral(n.arguments[0])
        )
          specifier = n.arguments[0].text;
        if (specifier) {
          expect(specifier, file).not.toMatch(/supabase|ai-api-manager/);
          const base = specifier.startsWith("@/")
            ? resolve(root, specifier.slice(2))
            : specifier.startsWith(".")
              ? resolve(dirname(file), specifier)
              : null;
          if (base) {
            const target = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find(
              (path) => existsSync(path) && /\.[tj]sx?$/.test(path),
            );
            if (target) visit(target);
          }
        }
        ts.forEachChild(n, node);
      }
      node(parsed);
    }
    for (const file of readdirSync(resolve("src/lib/i18n")).filter((file) =>
      file.endsWith(".server.ts"),
    ))
      visit(resolve("src/lib/i18n", file));
    for (const file of [
      "src/lib/language-catalog.ts",
      "src/components/i18n/PageTranslator.tsx",
      "src/components/language-manager/LanguageManagerConsole.tsx",
      "src/routes/api/marketplace/translate.ts",
      "src/lib/translate.functions.ts",
    ])
      visit(resolve(file));
    for (const file of readdirSync(resolve("src/routes/api/i18n")).filter((file) =>
      file.endsWith(".ts"),
    ))
      visit(resolve("src/routes/api/i18n", file));
    expect(visited.size).toBeGreaterThan(30);
    expect(
      readFileSync(resolve("deploy/postgres/20261006220000_i18n_native_sessions.sql"), "utf8"),
    ).not.toMatch(/supabase|http/i);
    for (const script of ["i18n-backup.sh", "i18n-restore-test.sh"]) {
      const contents = readFileSync(resolve("services/translation-engine/deploy", script), "utf8");
      expect(contents).not.toMatch(/supabase|DB_HOST|DB_PASSWORD|dbname=postgres/i);
    }
    expect(readFileSync(resolve("scripts/ops/sv-deploy.sh"), "utf8")).toContain(
      "I18N_DATABASE_URL",
    );
  });

  it("only permits opaque native cookie sessions and same-origin mutation", () => {
    const token = "a".repeat(64);
    const request = new Request("https://softwarevala.net/api/i18n/admin", {
      headers: {
        cookie: `${LANGUAGE_SESSION_COOKIE}=${token}`,
        origin: "https://softwarevala.net",
      },
    });
    expect(languageAuthorization(request)).toBe(`Bearer ${token}`);
    expect(sameOriginMutation(request)).toBe(true);
    expect(
      sameOriginMutation(
        new Request(request.url, { headers: { origin: "https://attacker.invalid" } }),
      ),
    ).toBe(false);
    expect(sameOriginMutation(new Request(request.url))).toBe(false);
    expect(
      languageAuthorization(
        new Request(request.url, { headers: { cookie: `${LANGUAGE_SESSION_COOKIE}=../../x` } }),
      ),
    ).toBeNull();
  });
});

describe("owned engine resilience", () => {
  const request = {
    mode: "realtime" as const,
    source: getLanguage("en")!,
    target: getLanguage("hi")!,
    segments: [{ id: "0", text: "Language", namespace: "ui", context: null }],
    glossary: [],
  };
  it("routes only registry language pairs", () => {
    const provider = createOwnedEngineProvider({ endpoint: "http://127.0.0.1:5100/v1/translate" });
    for (const language of SUPPORTED_LANGUAGES) {
      expect(provider.supports(getLanguage("en")!, language)).toBe(true);
      expect(provider.supports(language, getLanguage("en")!)).toBe(true);
    }
    expect(
      createOwnedEngineProvider({
        endpoint: "https://user:password@engine.invalid",
      }).isConfigured(),
    ).toBe(false);
    expect(() => createOwnedEngineProvider({ timeoutMs: NaN })).toThrow();
  });
  it("opens after repeated failures, recovers after cooldown, and refuses redirects", async () => {
    let now = 0;
    let calls = 0;
    const provider = createOwnedEngineProvider({
      endpoint: "http://127.0.0.1:5100/v1/translate",
      now: () => now,
      circuitFailures: 2,
      circuitCooldownMs: 100,
      fetchImpl: async (_url, options) => {
        calls += 1;
        expect(options?.redirect).toBe("error");
        return new Response("unavailable", { status: 503 });
      },
    });
    await expect(provider.translate(request)).rejects.toThrow("503");
    await expect(provider.translate(request)).rejects.toThrow("503");
    await expect(provider.translate(request)).rejects.toThrow("circuit");
    expect(calls).toBe(2);
    now = 101;
    await expect(provider.translate(request)).rejects.toThrow("503");
    expect(calls).toBe(3);
  });
});
