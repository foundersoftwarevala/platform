import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "../../language-catalog";
import { languagePackPayload, type LanguageBootstrap } from "../bootstrap";

const empty = (code: string): LanguageBootstrap => ({
  code,
  entries: {},
  withheld: [],
  locked: [],
  tag: null,
  reason: null,
});
function Label() {
  const { translate, language, serviceReason } = useLanguage();
  return createElement(
    "span",
    { lang: language.code, "data-reason": serviceReason },
    translate("publicseo.home_generic_title"),
  );
}
function render(initial: LanguageBootstrap) {
  return renderToString(
    createElement(LanguageProvider, { initial, children: createElement(Label) }),
  );
}
describe("native SSR language bootstrap", () => {
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
