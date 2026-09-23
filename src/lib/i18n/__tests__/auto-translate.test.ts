import { describe, expect, it } from "vitest";

import {
  applyTranslations,
  isTranslatableText,
  restoreOriginals,
  uniqueStrings,
  type Target,
} from "../auto-translate";

/**
 * The page translator's rules, tested without a browser: which strings it
 * touches, and that writing and restoring keep the surrounding whitespace.
 * The DOM walk itself is covered by the browser test in
 * services/translation-engine/... see tests/browser in the deployment notes.
 */

describe("isTranslatableText", () => {
  it.each([
    ["Apply Now", true],
    ["Your cart is empty.", true],
    ["a b", true],
    ["Go", true],
    ["  Sign in  ", true],
    ["", false],
    ["  ", false],
    ["7", false],
    ["42 %", false],
    ["₹1,299", false],
    ["—", false],
    ["EN", false],
    ["USD", false],
    ["v1", false],
    ["#12", false],
    ["⟦P0⟧", false],
    // Already in the visitor's language: never sent back as English.
    ["החל עכשיו", false],
    ["לוח שנה", false],
    ["केवल सत्यापित विक्रेता", false],
    ["計算器", false],
    ["Software Vala ארנק דיגיטלי חכם", false],
    // English with a foreign word in it is still English.
    ["Welcome to Kathmandu, नेपाल", true],
  ])("%j -> %s", (value, expected) => {
    expect(isTranslatableText(value)).toBe(expected);
  });

  it("leaves very long text alone", () => {
    expect(isTranslatableText("word ".repeat(500))).toBe(false);
  });
});

function textNode(value: string) {
  return { nodeValue: value } as unknown as Text;
}

function element(attributes: Record<string, string>) {
  const store = new Map(Object.entries(attributes));
  return {
    getAttribute: (name: string) => store.get(name) ?? null,
    setAttribute: (name: string, value: string) => void store.set(name, value),
  } as unknown as Element;
}

describe("applying and restoring", () => {
  it("writes translations and keeps the whitespace around them", () => {
    const node = textNode("\n  Apply Now  ");
    const targets: Target[] = [{ kind: "text", node, original: "\n  Apply Now  " }];
    const originals = new WeakMap<object, Map<string, string>>();
    const written = applyTranslations(
      targets,
      (s) => (s === "Apply Now" ? "अभी आवेदन करें" : undefined),
      originals,
    );
    expect(written).toBe(1);
    expect(node.nodeValue).toBe("\n  अभी आवेदन करें  ");
    expect(restoreOriginals(targets, originals)).toBe(1);
    expect(node.nodeValue).toBe("\n  Apply Now  ");
  });

  it("writes readable attributes", () => {
    const el = element({ placeholder: "Search language…", "aria-label": "Language" });
    const targets: Target[] = [
      { kind: "attribute", element: el, attribute: "placeholder", original: "Search language…" },
      { kind: "attribute", element: el, attribute: "aria-label", original: "Language" },
    ];
    const originals = new WeakMap<object, Map<string, string>>();
    const table: Record<string, string> = { "Search language…": "भाषा खोजें…", Language: "भाषा" };
    expect(applyTranslations(targets, (s) => table[s], originals)).toBe(2);
    expect(el.getAttribute("placeholder")).toBe("भाषा खोजें…");
    expect(el.getAttribute("aria-label")).toBe("भाषा");
    restoreOriginals(targets, originals);
    expect(el.getAttribute("placeholder")).toBe("Search language…");
  });

  it("leaves a string with no translation exactly as it was", () => {
    const node = textNode("Not translated yet");
    const targets: Target[] = [{ kind: "text", node, original: "Not translated yet" }];
    expect(applyTranslations(targets, () => undefined, new WeakMap())).toBe(0);
    expect(node.nodeValue).toBe("Not translated yet");
  });

  it("does not rewrite a node that already holds the translation", () => {
    const node = textNode("अभी आवेदन करें");
    const targets: Target[] = [{ kind: "text", node, original: "Apply Now" }];
    const originals = new WeakMap<object, Map<string, string>>();
    applyTranslations(targets, () => "अभी आवेदन करें", originals);
    expect(applyTranslations(targets, () => "अभी आवेदन करें", originals)).toBe(0);
  });

  it("collects the distinct strings to ask for", () => {
    const targets: Target[] = [
      { kind: "text", node: textNode("Apply Now"), original: " Apply Now " },
      { kind: "text", node: textNode("Apply Now"), original: "Apply Now" },
      {
        kind: "attribute",
        element: element({ title: "Language" }),
        attribute: "title",
        original: "Language",
      },
    ];
    expect(uniqueStrings(targets)).toEqual(["Apply Now", "Language"]);
  });
});
