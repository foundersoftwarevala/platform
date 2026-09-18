import { SOURCE_LANGUAGE, getLanguage, type LanguageDefinition } from "./registry";

/**
 * Interface text with values in it.
 *
 * Supports the part of ICU MessageFormat the interface uses: simple arguments
 * ({name}), numbers and dates ({total, number, percent}), plural, selectordinal
 * and select blocks with `#` inside plural branches, `offset:n`, and '' for a
 * literal apostrophe. The same subset is understood by the translation engine
 * (services/translation-engine/sv_translate/icu.py), which translates each
 * branch and produces the categories the target language actually needs.
 *
 * Numbers, dates and plural categories come from the language's own CLDR data:
 * `formatLocale` for formatting and `pluralLocale` for plural rules - null
 * there means the language does not inflect for count, so every count uses the
 * "other" branch.
 */

export type MessageValues = Record<string, unknown>;

type Node = string | Simple | Block | Pound;
type Simple = { kind: "simple"; name: string; type?: string; style?: string };
type Block = {
  kind: "plural" | "selectordinal" | "select";
  name: string;
  offset: number;
  options: Map<string, Node[]>;
};
type Pound = { kind: "pound" };

const CACHE = new Map<string, Node[]>();

export function parseMessage(message: string): Node[] {
  const cached = CACHE.get(message);
  if (cached) return cached;
  const [nodes] = readMessage(message, 0, false);
  if (CACHE.size > 2000) CACHE.clear();
  CACHE.set(message, nodes);
  return nodes;
}

/** True when the message needs values (it has arguments or branches). */
export function hasArguments(message: string): boolean {
  return message.includes("{");
}

function readMessage(source: string, start: number, inPlural: boolean): [Node[], number] {
  const nodes: Node[] = [];
  let text = "";
  let i = start;
  const flush = () => {
    if (text) nodes.push(text);
    text = "";
  };
  while (i < source.length) {
    const char = source[i]!;
    if (char === "'" && source[i + 1] === "'") {
      text += "'";
      i += 2;
    } else if (char === "{") {
      flush();
      const [node, next] = readArgument(source, i);
      nodes.push(node);
      i = next;
    } else if (char === "}") {
      break;
    } else if (char === "#" && inPlural) {
      flush();
      nodes.push({ kind: "pound" });
      i += 1;
    } else {
      text += char;
      i += 1;
    }
  }
  flush();
  return [nodes, i];
}

function readArgument(source: string, start: number): [Node, number] {
  let i = start + 1;
  let header = "";
  while (i < source.length && source[i] !== "}" && source[i] !== "{") header += source[i++]!;
  const parts = header.split(",").map((p) => p.trim());
  const name = parts[0] ?? "";
  const type = parts[1];
  if (type === "plural" || type === "selectordinal" || type === "select") {
    const block: Block = { kind: type, name, offset: 0, options: new Map() };
    // Re-read from the second comma: branches contain nested messages.
    i = start + 1 + header.indexOf(",", header.indexOf(",") + 1) + 1;
    while (i < source.length) {
      while (i < source.length && /\s/.test(source[i]!)) i += 1;
      if (source[i] === "}") return [block, i + 1];
      let key = "";
      while (i < source.length && !/[\s{]/.test(source[i]!)) key += source[i++]!;
      if (key.startsWith("offset:")) {
        block.offset = Number(key.slice(7)) || 0;
        continue;
      }
      while (i < source.length && /\s/.test(source[i]!)) i += 1;
      if (source[i] !== "{") throw new Error(`branch "${key}" has no message`);
      const [branch, next] = readMessage(source, i + 1, type !== "select");
      if (source[next] !== "}") throw new Error(`branch "${key}" is not closed`);
      block.options.set(key, branch);
      i = next + 1;
    }
    // Ran out of text before the closing brace: not a message we can fill.
    throw new Error(`${type} is not closed`);
  }
  const simple: Simple = {
    kind: "simple",
    name,
    ...(type ? { type } : {}),
    ...(parts[2] ? { style: parts[2] } : {}),
  };
  return [simple, source[i] === "}" ? i + 1 : i];
}

function pluralCategory(language: LanguageDefinition, value: number, ordinal: boolean): string {
  if (language.pluralLocale === null) return "other";
  try {
    return new Intl.PluralRules(language.pluralLocale, {
      type: ordinal ? "ordinal" : "cardinal",
    }).select(value);
  } catch {
    return "other";
  }
}

function formatValue(value: unknown, node: Simple, language: LanguageDefinition): string {
  if (value === undefined || value === null) return `{${node.name}}`;
  if (node.type === "number") return formatNumber(value as number, language, node.style);
  if (node.type === "date" || node.type === "time") {
    return formatDate(value as Date | string | number, language, {
      [node.type === "date" ? "dateStyle" : "timeStyle"]: (node.style as "short") ?? "medium",
    });
  }
  return String(value);
}

function render(
  nodes: Node[],
  values: MessageValues,
  language: LanguageDefinition,
  pound: number | null,
): string {
  let out = "";
  for (const node of nodes) {
    if (typeof node === "string") {
      out += node;
    } else if (node.kind === "pound") {
      out += pound === null ? "#" : formatNumber(pound, language);
    } else if (node.kind === "simple") {
      out += formatValue(values[node.name], node, language);
    } else {
      const raw = values[node.name];
      if (node.kind === "select") {
        const branch = node.options.get(String(raw)) ?? node.options.get("other");
        out += branch ? render(branch, values, language, pound) : "";
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        const other = node.options.get("other");
        out += other ? render(other, values, language, null) : "";
        continue;
      }
      const shown = value - node.offset;
      const exact = node.options.get(`=${value}`);
      const branch =
        exact ??
        node.options.get(pluralCategory(language, shown, node.kind === "selectordinal")) ??
        node.options.get("other");
      out += branch ? render(branch, values, language, shown) : "";
    }
  }
  return out;
}

/** Fill a message with values, in the given language. */
export function formatMessage(message: string, values: MessageValues, code: string): string {
  const language = getLanguage(code) ?? getLanguage(SOURCE_LANGUAGE)!;
  try {
    return render(parseMessage(message), values, language, null);
  } catch {
    // A message the parser cannot read is shown as it is rather than lost.
    return message;
  }
}

/* ------------------------------------------------------------- formatters */

const NUMBER_STYLES: Record<string, Intl.NumberFormatOptions> = {
  integer: { maximumFractionDigits: 0 },
  percent: { style: "percent" },
};

export function formatNumber(
  value: number,
  language: LanguageDefinition | string,
  style?: string,
): string {
  const entry = typeof language === "string" ? getLanguage(language) : language;
  const locale = entry?.formatLocale ?? "en-US";
  const options = style ? NUMBER_STYLES[style] : undefined;
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

export function formatCurrency(
  value: number,
  currency: string,
  language: LanguageDefinition | string,
): string {
  const entry = typeof language === "string" ? getLanguage(language) : language;
  try {
    return new Intl.NumberFormat(entry?.formatLocale ?? "en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function formatDate(
  value: Date | string | number,
  language: LanguageDefinition | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const entry = typeof language === "string" ? getLanguage(language) : language;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(entry?.formatLocale ?? "en-US", options).format(date);
  } catch {
    return date.toISOString();
  }
}

/** The plural categories a language actually uses, for tooling and the admin console. */
// Intl returns the categories alphabetically; translators and the language
// manager expect them in CLDR order.
const CLDR_CATEGORY_ORDER = ["zero", "one", "two", "few", "many", "other"];

export function pluralCategories(code: string): string[] {
  const language = getLanguage(code);
  if (!language || language.pluralLocale === null) return ["other"];
  try {
    const resolved = new Intl.PluralRules(language.pluralLocale).resolvedOptions().pluralCategories;
    return CLDR_CATEGORY_ORDER.filter((category) => resolved.includes(category));
  } catch {
    return ["other"];
  }
}
