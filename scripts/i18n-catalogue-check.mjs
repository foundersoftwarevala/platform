/**
 * Checks the keyed message catalogue (src/lib/i18n/messages) and every place
 * that uses it. Run by `node scripts/i18n-audit.mjs --check` (npm run
 * i18n:check); each problem is one line, and any problem fails the check.
 *
 *   - a catalogue file that is not listed in messages/index.ts, or a key that
 *     does not start with its module's name
 *   - the same key twice
 *   - text that is not English (the catalogue is the English source; other
 *     languages come from translation memory)
 *   - malformed ICU: unbalanced braces, a plural/select without `other`, an
 *     unknown plural category, `#` outside a plural
 *   - t("key") / <Msg k="key"> with a key the catalogue does not have
 *   - t("key", { ... }) that leaves out a variable the message needs, or passes
 *     one it does not use
 *   - a language code written into the code that the registry does not have
 *
 * Keys the code never uses are listed as a warning, not a failure: they are
 * still translated, which costs engine time for nothing.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const MESSAGES = join(SRC, "lib", "i18n", "messages");
const REGISTRY = join(SRC, "lib", "i18n", "registry.ts");

const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);
const SKIP_DIRS = new Set(["node_modules", "__tests__", ".output", "integrations"]);

const rel = (file) => relative(ROOT, file).split(sep).join("/");

function sourceFile(file) {
  const text = readFileSync(file, "utf8");
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function line(node) {
  return ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1;
}

function literalText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

/* ------------------------------------------------------------ ICU checks */

/**
 * Validates an ICU message and returns the variable names it uses. Throws with
 * a reason when the message is malformed.
 */
export function icuVariables(message) {
  const names = new Set();
  let i = 0;

  const readText = (inPlural) => {
    while (i < message.length) {
      const c = message[i];
      if (c === "'") {
        // '{' and '}' are quoted literally; '' is an apostrophe.
        const close = message.indexOf("'", i + 1);
        if (close === i + 1) {
          i += 2;
          continue;
        }
        if (close > i && /[{}#]/.test(message[i + 1] ?? "")) {
          i = close + 1;
          continue;
        }
        i += 1;
        continue;
      }
      if (c === "}") return;
      if (c === "{") {
        readArgument();
        continue;
      }
      if (c === "#" && !inPlural) throw new Error("# outside a plural");
      i += 1;
    }
  };

  const readArgument = () => {
    i += 1; // {
    const start = i;
    while (i < message.length && !/[,}]/.test(message[i])) i += 1;
    const name = message.slice(start, i).trim();
    if (!/^[A-Za-z_][\w.]*$/.test(name)) throw new Error(`bad argument name "${name}"`);
    names.add(name);
    if (message[i] === "}") {
      i += 1;
      return;
    }
    if (message[i] !== ",") throw new Error(`unclosed argument {${name}`);
    i += 1;
    const typeStart = i;
    while (i < message.length && !/[,}]/.test(message[i])) i += 1;
    const type = message.slice(typeStart, i).trim();
    if (message[i] === "}") {
      if (!/^(number|date|time)$/.test(type)) throw new Error(`unknown argument type "${type}"`);
      i += 1;
      return;
    }
    i += 1; // ,
    if (type === "number" || type === "date" || type === "time") {
      while (i < message.length && message[i] !== "}") i += 1;
      if (message[i] !== "}") throw new Error(`unclosed argument {${name}`);
      i += 1;
      return;
    }
    if (!/^(plural|selectordinal|select)$/.test(type))
      throw new Error(`unknown argument type "${type}"`);
    const plural = type !== "select";
    const branches = new Set();
    for (;;) {
      while (/\s/.test(message[i] ?? "")) i += 1;
      if (message[i] === "}") {
        i += 1;
        break;
      }
      if (i >= message.length) throw new Error(`unclosed ${type} {${name}`);
      const keyStart = i;
      while (i < message.length && !/[\s{}]/.test(message[i])) i += 1;
      const key = message.slice(keyStart, i);
      if (!key) throw new Error(`${type} {${name}} has a branch without a name`);
      if (plural && key.startsWith("offset:")) continue;
      if (plural && !PLURAL_CATEGORIES.has(key) && !/^=\d+$/.test(key))
        throw new Error(`"${key}" is not a plural category`);
      if (branches.has(key)) throw new Error(`${type} {${name}} has "${key}" twice`);
      branches.add(key);
      while (/\s/.test(message[i] ?? "")) i += 1;
      if (message[i] !== "{") throw new Error(`${type} {${name}} branch "${key}" has no text`);
      i += 1;
      readText(plural);
      if (message[i] !== "}") throw new Error(`${type} {${name}} branch "${key}" is not closed`);
      i += 1;
    }
    if (!branches.has("other")) throw new Error(`${type} {${name}} has no "other" branch`);
  };

  readText(false);
  if (i < message.length) throw new Error("unbalanced }");
  return names;
}

/* ----------------------------------------------------------- catalogue */

function readCatalogue(problems) {
  const entries = new Map(); // key -> { text, file, line, variables }
  const index = readFileSync(join(MESSAGES, "index.ts"), "utf8");
  for (const name of readdirSync(MESSAGES)) {
    if (!name.endsWith(".ts") || name === "index.ts") continue;
    const module = basename(name, ".ts");
    const file = join(MESSAGES, name);
    if (!new RegExp(`from "\\./${module}"`).test(index))
      problems.push(`${rel(file)}: module "${module}" is not listed in messages/index.ts`);
    const source = sourceFile(file);
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
        const key = literalText(node.name) ?? node.name.getText();
        const where = `${rel(file)}:${line(node)}`;
        let text = literalText(node.initializer);
        if (text === null && ts.isArrayLiteralExpression(node.initializer)) {
          text = literalText(node.initializer.elements[0]);
          if (!literalText(node.initializer.elements[1]))
            problems.push(`${where}: "${key}" needs [text, description] with a description`);
        }
        if (text === null) {
          problems.push(`${where}: "${key}" must be a string or [text, description]`);
          return;
        }
        if (!key.startsWith(`${module}.`))
          problems.push(`${where}: key "${key}" must start with "${module}."`);
        if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(key))
          problems.push(`${where}: key "${key}" must be lower-case words joined by dots`);
        if (entries.has(key))
          problems.push(`${where}: duplicate key "${key}" (also ${entries.get(key).where})`);
        const letters = text.match(/\p{L}/gu) ?? [];
        const latin = text.match(/\p{Script=Latin}/gu) ?? [];
        if (letters.length > latin.length)
          problems.push(
            `${where}: "${key}" is not English - the catalogue holds the English source only`,
          );
        let variables = new Set();
        try {
          variables = icuVariables(text);
        } catch (error) {
          problems.push(`${where}: "${key}" is not a valid ICU message: ${error.message}`);
        }
        entries.set(key, { text, where, variables });
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return entries;
}

function registryCodes() {
  const text = readFileSync(REGISTRY, "utf8");
  return new Set([...text.matchAll(/^ {2}L\(\s*\n\s*"([^"]+)",/gm)].map((m) => m[1]));
}

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

/** Calls that take a language code as their first argument. */
const LANGUAGE_ARGUMENT = new Set([
  "setLanguage",
  "serverTranslator",
  "getLanguage",
  "setCurrentLanguage",
]);

export function checkCatalogue() {
  const problems = [];
  const warnings = [];
  const catalogue = readCatalogue(problems);
  const codes = registryCodes();
  const used = new Set();
  // Files that use the keyed API. Older components call the provider's
  // translate() with English wording (also named `t` in some of them); those
  // are not catalogue keys and are not checked here.
  const usesTranslation = /i18n\/use-translation["']|server-translate\.server["']|MailLanguage/;

  for (const file of files(SRC)) {
    if (file.startsWith(MESSAGES)) continue;
    const raw = readFileSync(file, "utf8");
    const source = sourceFile(file);
    const where = (node) => `${rel(file)}:${line(node)}`;

    const checkKey = (node, keyNode, valuesNode) => {
      const key = literalText(keyNode);
      if (key === null) {
        // A template key ("payment.title.${status}"): its fixed start must
        // name keys that exist.
        if (keyNode && ts.isTemplateExpression(keyNode)) {
          const prefix = keyNode.head.text;
          const matches = [...catalogue.keys()].filter((k) => k.startsWith(prefix));
          if (matches.length === 0)
            problems.push(`${where(node)}: no catalogue key starts with "${prefix}"`);
          matches.forEach((k) => used.add(k));
        }
        return;
      }
      const entry = catalogue.get(key);
      if (!entry) {
        problems.push(
          `${where(node)}: "${key}" is not in the message catalogue (src/lib/i18n/messages)`,
        );
        return;
      }
      used.add(key);
      if (!valuesNode || !ts.isObjectLiteralExpression(valuesNode)) {
        // No values: the message must not need any, unless its placeholders
        // are filled with elements (richText).
        const richText =
          ts.isCallExpression(node.parent) && node.parent.expression.getText() === "richText";
        if (!valuesNode && entry.variables.size > 0 && !richText)
          problems.push(
            `${where(node)}: "${key}" needs ${[...entry.variables].map((v) => `{${v}}`).join(", ")}`,
          );
        return;
      }
      if (valuesNode.properties.some((p) => ts.isSpreadAssignment(p))) return;
      const given = new Set(valuesNode.properties.map((p) => p.name?.getText()).filter(Boolean));
      for (const name of entry.variables)
        if (!given.has(name))
          problems.push(`${where(node)}: "${key}" needs {${name}}, which is not passed`);
      for (const name of given)
        if (!entry.variables.has(name))
          problems.push(`${where(node)}: "${key}" does not use {${name}}`);
    };

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : "";
        if (name === "t" && usesTranslation.test(raw))
          checkKey(node, node.arguments[0], node.arguments[1]);
        if (LANGUAGE_ARGUMENT.has(name)) {
          const code = literalText(node.arguments[0]);
          if (code !== null && !codes.has(code))
            problems.push(`${where(node)}: "${code}" is not a language code in the registry`);
        }
      }
      if (
        (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
        node.tagName.getText() === "Msg"
      ) {
        let keyNode = null;
        let valuesNode = null;
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
          const value = ts.isJsxExpression(attribute.initializer)
            ? attribute.initializer.expression
            : attribute.initializer;
          if (attribute.name.getText() === "k") keyNode = value;
          if (attribute.name.getText() === "values") valuesNode = value;
        }
        checkKey(node, keyNode, valuesNode);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  // Module-level lists of keys ("auth.pulse.regions") used through a variable.
  for (const file of files(SRC)) {
    if (file.startsWith(MESSAGES)) continue;
    const raw = readFileSync(file, "utf8");
    for (const key of catalogue.keys())
      if (!used.has(key) && (raw.includes(`"${key}"`) || raw.includes(`'${key}'`))) used.add(key);
  }
  for (const key of catalogue.keys())
    if (!used.has(key))
      warnings.push(`warning: "${key}" (${catalogue.get(key).where}) is not used anywhere`);

  if (warnings.length) console.warn(warnings.join("\n"));
  return problems;
}

if (process.argv[1]?.endsWith("i18n-catalogue-check.mjs")) {
  const problems = checkCatalogue();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("message catalogue check passed");
}
