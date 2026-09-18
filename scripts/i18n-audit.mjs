#!/usr/bin/env node
/**
 * Finds the user-facing text in the application and says, for every string,
 * whether it goes through the translation API.
 *
 *   node scripts/i18n-audit.mjs                 summary by module
 *   node scripts/i18n-audit.mjs --json out.json every finding
 *   node scripts/i18n-audit.mjs --check         CI: fail on new hardcoded text
 *   node scripts/i18n-audit.mjs --update-baseline
 *
 * What counts as user-facing text (TSX/TS under src/):
 *   - JSX text with a letter in it:            <h1>Orders</h1>
 *   - string literals rendered as JSX children: {busy ? "Saving…" : "Save"}
 *   - user-facing attributes given a literal:  placeholder="Search", title, alt,
 *                                              aria-label, aria-description, label
 *   - messages given to toast(), toast.success/error/info/warning(), alert(),
 *     confirm()
 *   - error messages API routes send back:     Response.json({ error: "..." })
 *
 * Every string is one of
 *   keyed      inside t(...) / translate(...), or <Msg k="...">  -> translated by key
 *   exempt     marked as not for translation: inside an element with
 *              data-no-translate or translate="no", or on a line carrying
 *              an `i18n-ignore` comment (brand names, code, sample data)
 *   hardcoded  everything else. Rendered text is still translated at run time
 *              by the page translator (src/components/i18n/PageTranslator.tsx);
 *              text outside the page (toasts shown later are in the page,
 *              emails and API responses read elsewhere are not) is not.
 *
 * --check compares the hardcoded count of every file with
 * scripts/i18n-baseline.json and fails when a file has more than it had:
 * existing text can be moved to t() at any pace, new untranslated text is
 * caught. It also fails on duplicate or malformed catalogue entries and on
 * t() keys the catalogue does not have (see checkCatalogue).
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const BASELINE = join(ROOT, "scripts", "i18n-baseline.json");

const USER_ATTRIBUTES = new Set([
  "placeholder",
  "title",
  "alt",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "label",
]);
const TRANSLATE_CALLS = new Set(["t", "translate", "translateText"]);
const MESSAGE_CALLS = new Set(["alert", "confirm", "toast"]);
const TOAST_METHODS = new Set(["success", "error", "info", "warning", "message", "loading"]);
const SKIP_DIRS = new Set(["node_modules", "__tests__", ".output", "integrations"]);

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...files(path));
    } else if (
      /\.(tsx|ts)$/.test(name) &&
      !/\.(test|spec|d)\.tsx?$/.test(name) &&
      name !== "routeTree.gen.ts"
    ) {
      out.push(path);
    }
  }
  return out;
}

/** Module a file belongs to: src/components/<m>/..., src/routes/<m>[.-/]..., src/lib/<m>/... */
export function moduleOf(file) {
  const parts = relative(SRC, file).split(sep);
  if (parts[0] === "routes") {
    const name = (parts[1] ?? "").replace(/\.(tsx|ts)$/, "");
    if (name === "__root" || name === "index") return "root";
    if (name === "api") return `api/${(parts[2] ?? "").replace(/\.(tsx|ts)$/, "").split(".")[0]}`;
    return name.split(/[.$-]/)[0] || "root";
  }
  if (parts.length > 2) return parts[1];
  return parts[0].replace(/\.(tsx|ts)$/, "");
}

function hasLetter(text) {
  return /\p{L}/u.test(text);
}

function isUserText(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < 2 || !hasLetter(trimmed)) return false;
  // Code-like tokens and entities are not prose.
  if (/^[&#][a-z0-9]+;?$/i.test(trimmed)) return false;
  return true;
}

function insideTranslateCall(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const callee = p.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : "";
      if (TRANSLATE_CALLS.has(name)) return true;
    }
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isFunctionLike(p)) {
      if (ts.isFunctionLike(p)) return false;
    }
  }
  return false;
}

/**
 * A string literal that ends up as a child of a JSX element: directly
 * ({"Save"}) or as a branch of ?:, &&, || or ?? ({busy ? "Saving" : "Save"}).
 * Not attribute values, not arguments of calls.
 */
function renderedAsChild(node) {
  let child = node;
  for (let p = node.parent; p; child = p, p = p.parent) {
    if (ts.isParenthesizedExpression(p)) continue;
    if (ts.isConditionalExpression(p)) {
      if (child === p.condition) return false;
      continue;
    }
    if (ts.isBinaryExpression(p)) {
      const op = p.operatorToken.kind;
      const logical =
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken;
      if (!logical || child !== p.right) return false;
      continue;
    }
    if (ts.isJsxExpression(p))
      return Boolean(p.parent) && (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent));
    return false;
  }
  return false;
}

function attr(element, name) {
  const attrs = ts.isJsxElement(element)
    ? element.openingElement.attributes
    : ts.isJsxSelfClosingElement(element)
      ? element.attributes
      : null;
  if (!attrs) return undefined;
  for (const a of attrs.properties) {
    if (ts.isJsxAttribute(a) && a.name.getText() === name) {
      if (!a.initializer) return true;
      if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
      return a.initializer.getText();
    }
  }
  return undefined;
}

function exempt(node, sourceText, lineStarts) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) {
      if (attr(p, "data-no-translate") !== undefined) return true;
      const tr = attr(p, "translate");
      if (tr === "no" || tr === '"no"') return true;
      const cls = attr(p, "className");
      if (typeof cls === "string" && /\bnotranslate\b/.test(cls)) return true;
    }
  }
  const pos = node.getStart();
  const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), pos).line;
  const start = lineStarts[line];
  const end = lineStarts[line + 1] ?? sourceText.length;
  const prevStart = line > 0 ? lineStarts[line - 1] : start;
  return /i18n-ignore/.test(sourceText.slice(prevStart, end));
}

function scan(file) {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lineStarts = source.getLineStarts();
  const isApiRoute = /[\\/]routes[\\/]api[\\/]/.test(file);
  const findings = [];
  const add = (node, kind, value, forced) => {
    const status =
      forced ??
      (insideTranslateCall(node)
        ? "keyed"
        : exempt(node, text, lineStarts)
          ? "exempt"
          : "hardcoded");
    const { line } = ts.getLineAndCharacterOfPosition(source, node.getStart());
    findings.push({
      file: relative(ROOT, file).split(sep).join("/"),
      line: line + 1,
      kind,
      status,
      text: value.replace(/\s+/g, " ").trim().slice(0, 120),
    });
  };
  const visit = (node) => {
    if (ts.isJsxText(node) && isUserText(node.text)) add(node, "jsx-text", node.text);
    else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      renderedAsChild(node) &&
      isUserText(node.text)
    )
      add(node, "jsx-expression", node.text);
    else if (
      ts.isJsxAttribute(node) &&
      node.name.getText() === "k" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      node.parent?.parent &&
      (ts.isJsxSelfClosingElement(node.parent.parent) ||
        ts.isJsxOpeningElement(node.parent.parent)) &&
      node.parent.parent.tagName.getText() === "Msg"
    )
      add(node.initializer, "t-call", node.initializer.text, "keyed");
    else if (
      ts.isJsxAttribute(node) &&
      USER_ATTRIBUTES.has(node.name.getText()) &&
      node.initializer
    ) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) && isUserText(init.text))
        add(init, `attr:${node.name.getText()}`, init.text);
      else if (
        ts.isJsxExpression(init) &&
        init.expression &&
        (ts.isStringLiteral(init.expression) ||
          ts.isNoSubstitutionTemplateLiteral(init.expression)) &&
        isUserText(init.expression.text)
      )
        add(init.expression, `attr:${node.name.getText()}`, init.expression.text);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const first = node.arguments[0];
      const literal =
        first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
          ? first
          : null;
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : "";
      if (TRANSLATE_CALLS.has(calleeName) && literal && isUserText(literal.text)) {
        add(literal, "t-call", literal.text);
        ts.forEachChild(node, visit);
        return;
      }
      const isMessage =
        (ts.isIdentifier(callee) && MESSAGE_CALLS.has(callee.text)) ||
        (ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === "toast" &&
          TOAST_METHODS.has(callee.name.text));
      if (isMessage && literal && isUserText(literal.text)) add(literal, "message", literal.text);
    } else if (
      isApiRoute &&
      ts.isPropertyAssignment(node) &&
      node.name.getText() === "error" &&
      (ts.isStringLiteral(node.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(node.initializer)) &&
      isUserText(node.initializer.text)
    ) {
      add(node.initializer, "api-error", node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

export function audit() {
  const all = [];
  for (const file of files(SRC)) all.push(...scan(file));
  return all;
}

function summarise(findings) {
  const byModule = new Map();
  const totals = { keyed: 0, exempt: 0, hardcoded: 0 };
  for (const f of findings) {
    totals[f.status] += 1;
    const m = moduleOf(join(ROOT, f.file));
    const row = byModule.get(m) ?? { keyed: 0, exempt: 0, hardcoded: 0, files: new Set() };
    row[f.status] += 1;
    row.files.add(f.file);
    byModule.set(m, row);
  }
  return { totals, byModule };
}

function perFile(findings) {
  const counts = {};
  for (const f of findings)
    if (f.status === "hardcoded") counts[f.file] = (counts[f.file] ?? 0) + 1;
  return counts;
}

const args = process.argv.slice(2);
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("i18n-audit.mjs")
) {
  const findings = audit();
  const { totals, byModule } = summarise(findings);
  const total = totals.keyed + totals.exempt + totals.hardcoded;

  if (args[0] === "--json") {
    writeFileSync(args[1] ?? "i18n-audit.json", JSON.stringify(findings, null, 1));
  }
  if (args[0] === "--update-baseline") {
    writeFileSync(BASELINE, JSON.stringify(perFile(findings), null, 1) + "\n");
    console.log(
      `baseline written: ${totals.hardcoded} hardcoded strings in ${Object.keys(perFile(findings)).length} files`,
    );
    process.exit(0);
  }
  if (args[0] === "--check") {
    const { checkCatalogue } = await import("./i18n-catalogue-check.mjs");
    const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
    const now = perFile(findings);
    const grown = Object.entries(now).filter(([file, n]) => n > (baseline[file] ?? 0));
    const problems = [
      ...grown.map(
        ([file, n]) =>
          `${file}: ${n} hardcoded user-facing strings (baseline ${baseline[file] ?? 0}). Use t() from useTranslation(), or mark text that is not for translation with data-no-translate / an i18n-ignore comment.`,
      ),
      ...checkCatalogue(findings),
    ];
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exit(1);
    }
    console.log(
      `i18n check passed: ${totals.keyed} keyed, ${totals.exempt} exempt, ${totals.hardcoded} hardcoded (none new).`,
    );
    process.exit(0);
  }

  console.log(
    `user-facing strings: ${total}  keyed: ${totals.keyed}  exempt: ${totals.exempt}  hardcoded: ${totals.hardcoded}`,
  );
  console.log(
    `files with user-facing text: ${new Set(findings.map((f) => f.file)).size}  modules: ${byModule.size}`,
  );
  const rows = [...byModule.entries()].sort((a, b) => b[1].hardcoded - a[1].hardcoded);
  for (const [m, r] of rows.slice(0, Number(args[1] ?? 60))) {
    console.log(
      `${m.padEnd(28)} files ${String(r.files.size).padStart(4)}  keyed ${String(r.keyed).padStart(5)}  exempt ${String(r.exempt).padStart(4)}  hardcoded ${String(r.hardcoded).padStart(5)}`,
    );
  }
}
