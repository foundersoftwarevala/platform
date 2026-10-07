import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage, translateText } from "../../language-catalog";
import { languagePackPayload, type LanguageBootstrap } from "../bootstrap";
import { formatMessage, formatNumber } from "../format";
import { messageText } from "../messages";
import { homeSeo } from "../public-seo.functions";

const empty = (code: string): LanguageBootstrap => ({
  code,
  entries: {},
  withheld: [],
  locked: [],
  tag: null,
  reason: null,
});
function Label({ text = "publicseo.home_generic_title" }: { text?: string }) {
  const { translate, language, serviceReason } = useLanguage();
  return createElement(
    "span",
    { lang: language.code, "data-reason": serviceReason },
    translate(text),
  );
}
function render(initial: LanguageBootstrap, text?: string) {
  return renderToString(
    createElement(LanguageProvider, { initial, children: createElement(Label, { text }) }),
  );
}
describe("native SSR language bootstrap", () => {
  it("serializes locale-formatted catalogue counts with the server metadata", () => {
    const seo = homeSeo(
      { products: 7557, categories: 91, liveDemos: 200, bootstrap: empty("be") },
      (key, values) => formatMessage(messageText(key) ?? key, values ?? {}, "be"),
    );
    expect(seo.language).toBe("be");
    expect(seo.formattedCounts).toEqual({
      7557: formatNumber(7557, "be"),
      91: formatNumber(91, "be"),
      200: formatNumber(200, "be"),
    });
    expect(seo.title).toContain(seo.formattedCounts[7557]);
    expect(seo.description).toContain(seo.formattedCounts[91]);
    expect(
      homeSeo({ products: null, categories: null, bootstrap: empty("be") }, (key) => key)
        .formattedCounts,
    ).toEqual({});
  });
  it("uses the same reviewed regional fallback as the first client render", () => {
    expect(render(empty("ar-EG"), "Share")).toContain(translateText("Share", "ar-EG"));
  });
  it("does not translate a coined product name from a historical pack on the server", () => {
    expect(
      render(
        { ...empty("hi"), entries: { [`${String.fromCharCode(1)}EduNex Pro`]: "Software Vala" } },
        "EduNex Pro",
      ),
    ).toContain(">EduNex Pro</span>");
  });
  it("uses normalized memory keys without removing intentional source spacing", () => {
    expect(
      render(
        { ...empty("hi"), entries: { [`${String.fromCharCode(1)}Share`]: "Software Vala" } },
        " Share ",
      ),
    ).toContain("> Software Vala </span>");
  });
  it("renders accepted keyed pack text without sharing one request's pack with another", () => {
    const source = "Software Vala — Software Solutions Marketplace";
    const accepted = "Software Vala";
    const key = `publicseo${String.fromCharCode(1)}${source}`;
    expect(render({ ...empty("hi"), entries: { [key]: accepted } })).toContain(
      ">Software Vala</span>",
    );
    expect(render({ ...empty("hi"), entries: { [key]: accepted }, withheld: [key] })).toContain(
      source,
    );
    expect(render(empty("hi"))).toContain(source);
    expect(render(empty("en"))).toContain('lang="en"');
  });
  it("retains an explicit pack failure rather than representing it as success", () => {
    expect(render({ ...empty("hi"), reason: "language_pack_unavailable" })).toContain(
      'data-reason="language_pack_unavailable"',
    );
  });
  it("rejects malformed native pack payloads", () => {
    expect(() =>
      languagePackPayload.parse({ entries: { text: 1 }, withheld: [], locked: [] }),
    ).toThrow();
  });
});
