import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { icuVariables } from "./i18n-catalogue-check.mjs";

const compiled = ts.transpileModule(readFileSync(resolve("src/lib/i18n/registry.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { SUPPORTED_LANGUAGES } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const source = ts.createSourceFile(
  "email.ts",
  readFileSync(resolve("src/lib/i18n/messages/email.ts"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const messages = new Map();
function visit(node) {
  if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) {
    const value = ts.isArrayLiteralExpression(node.initializer)
      ? node.initializer.elements[0]
      : node.initializer;
    if (value && ts.isStringLiteral(value)) messages.set(node.name.text, value.text);
  }
  ts.forEachChild(node, visit);
}
visit(source);
const cases = [
  { name: "placeholder", text: messages.get("email.hello") },
  { name: "icu_select", text: messages.get("email.lead.thanks_product") },
  { name: "html", text: `<p>${messages.get("email.lead.follow_up")}</p>` },
];
if (cases.some(({ text }) => !text || text.includes("undefined")))
  throw new Error("Real source messages are missing.");
const base = process.env.I18N_VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
if (!process.env.INTERNAL_API_TOKEN)
  throw new Error("A real authorized operator token is required for the complete format matrix.");
const authorization = await fetch(new URL("/api/i18n/admin", base), {
  headers: { "x-internal-token": process.env.INTERNAL_API_TOKEN },
  signal: AbortSignal.timeout(30000),
  redirect: "error",
});
if (authorization.status !== 200)
  throw new Error(`Operator authorization verification HTTP ${authorization.status}`);
const out = process.argv.find((arg) => arg.startsWith("--out="))?.slice(6);
const selection = process.argv
  .find((arg) => arg.startsWith("--languages="))
  ?.slice(12)
  .split(",");
if (selection?.some((code) => !SUPPORTED_LANGUAGES.some((language) => language.code === code)))
  throw new Error("Requested format verification language is not in the real registry.");
const languages = selection
  ? SUPPORTED_LANGUAGES.filter((language) => selection.includes(language.code))
  : SUPPORTED_LANGUAGES;
const report = {
  at: new Date().toISOString(),
  persist: false,
  limitations: ["Checks structure and accepted output, not human semantic quality or all fonts."],
  languages: [],
};
for (const language of languages) {
  const record = { code: language.code, cases: [], failures: [] };
  for (const probe of cases) {
    const started = Date.now();
    try {
      let response, body;
      let attempts = 0;
      const transportErrors = [];
      do {
        attempts++;
        try {
          response = await fetch(new URL("/api/marketplace/translate", base), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(process.env.INTERNAL_API_TOKEN
                ? { "x-internal-token": process.env.INTERNAL_API_TOKEN }
                : {}),
            },
            body: JSON.stringify({
              source: "en",
              target: language.code,
              texts: [probe.text],
              namespace: "ui",
              context: "language-format-verification",
              persist: false,
            }),
            signal: AbortSignal.timeout(Math.max(1, 90000 - (Date.now() - started))),
            redirect: "error",
          });
        } catch (error) {
          transportErrors.push(error.message);
          const delay = Math.min(5000, attempts * 1000);
          if (Date.now() - started + delay >= 90000) throw error;
          await new Promise((done) => setTimeout(done, delay));
          continue;
        }
        body = await response.json();
        if (
          body.translations?.[probe.text] ||
          (!["in_progress", "engine_unavailable"].includes(body.pending_reason) &&
            response.status !== 429 &&
            response.status !== 503)
        )
          break;
        await new Promise((done) =>
          setTimeout(done, Math.min(30, Number(response.headers.get("retry-after")) || 3) * 1000),
        );
      } while (Date.now() - started < 90000);
      const text = body.translations?.[probe.text] ?? null;
      let shape = false;
      if (text) {
        if (probe.name === "html")
          shape =
            JSON.stringify(text.match(/<\/?[a-z][^>]*>/gi)) ===
            JSON.stringify(probe.text.match(/<\/?[a-z][^>]*>/gi));
        else
          shape =
            JSON.stringify([...icuVariables(text)].sort()) ===
            JSON.stringify([...icuVariables(probe.text)].sort());
      }
      record.cases.push({
        name: probe.name,
        status: response.status,
        accepted: Boolean(text),
        shape,
        attempts,
        milliseconds: Date.now() - started,
        reason: body.pending_reason ?? body.reason ?? null,
        outcomes: body.results ?? [],
        transportErrors,
      });
      if (!text || !shape)
        record.failures.push(`${probe.name}:${text ? "shape_mismatch" : "unavailable"}`);
    } catch (error) {
      record.cases.push({
        name: probe.name,
        milliseconds: Date.now() - started,
        error: error.message,
      });
      record.failures.push(`${probe.name}:verification_error`);
    }
  }
  report.languages.push(record);
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ code: record.code, failures: record.failures }));
}
if (report.languages.some(({ failures }) => failures.length)) process.exitCode = 1;
