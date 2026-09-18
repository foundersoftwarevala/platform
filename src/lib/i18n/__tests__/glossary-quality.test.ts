import { describe, expect, it } from "vitest";

import {
  checkTerminology,
  glossaryHints,
  protectLockedTerms,
  restoreLockedTerms,
  selectTerms,
  type GlossaryTerm,
} from "../glossary";
import { assessTranslation, extractPlaceholders } from "../quality";
import { getLanguage } from "../registry";

const term = (overrides: Partial<GlossaryTerm>): GlossaryTerm => ({
  sourceTerm: "Software Vala",
  targetTerm: null,
  sourceLanguage: "en",
  targetLanguage: null,
  rule: "locked",
  caseSensitive: true,
  namespace: null,
  ...overrides,
});

describe("glossary", () => {
  it("selects terms for the language pair and namespace", () => {
    const terms = [
      term({}),
      term({
        sourceTerm: "Checkout",
        rule: "preferred",
        targetTerm: "चेकआउट",
        targetLanguage: "hi",
      }),
      term({
        sourceTerm: "Checkout",
        rule: "preferred",
        targetTerm: "Finalizar compra",
        targetLanguage: "pt-BR",
      }),
      term({
        sourceTerm: "Seat",
        rule: "preferred",
        targetTerm: "सीट",
        targetLanguage: "hi",
        namespace: "billing",
      }),
      term({ sourceTerm: "Hola", sourceLanguage: "es" }),
    ];
    const selected = selectTerms(terms, { source: "en", target: "hi", namespace: "ui" });
    expect(selected.map((t) => t.sourceTerm)).toEqual(["Software Vala", "Checkout"]);
  });

  it("protects locked terms as whole words and restores them", () => {
    const terms = [term({}), term({ sourceTerm: "Vala TV" })];
    const guarded = protectLockedTerms("Watch Vala TV on Software Vala today", terms);
    expect(guarded.text).toBe("Watch ⟦T1⟧ on ⟦T0⟧ today");
    const restored = restoreLockedTerms("आज ⟦T0⟧ पर ⟦T1⟧ देखें", guarded.tokens);
    expect(restored).toEqual({ text: "आज Software Vala पर Vala TV देखें", missing: [] });
  });

  it("does not protect the same letters inside a longer word", () => {
    const guarded = protectLockedTerms("SoftwareValaX and Software Valas", [term({})]);
    expect(guarded.tokens).toHaveLength(0);
  });

  it("uses the fixed rendering of a locked term when one is set", () => {
    const guarded = protectLockedTerms("Open Vala AI", [
      term({ sourceTerm: "Vala AI", targetTerm: "VALA AI" }),
    ]);
    expect(restoreLockedTerms(guarded.text.replace("Open", "खोलें"), guarded.tokens).text).toBe(
      "खोलें VALA AI",
    );
  });

  it("reports tokens the provider dropped", () => {
    const guarded = protectLockedTerms("Software Vala", [term({})]);
    expect(restoreLockedTerms("सॉफ्टवेयर वाला", guarded.tokens).missing).toEqual(["⟦T0⟧"]);
  });

  it("hints and checks preferred and forbidden terms", () => {
    const terms = [
      term({ sourceTerm: "cart", rule: "preferred", targetTerm: "कार्ट", caseSensitive: false }),
      term({ sourceTerm: "cart", rule: "forbidden", targetTerm: "गाड़ी", caseSensitive: false }),
    ];
    expect(glossaryHints("Your Cart is empty", terms)).toEqual([
      { source: "cart", target: "कार्ट" },
    ]);
    expect(checkTerminology("Your Cart", "आपकी कार्ट", terms)).toEqual([]);
    expect(checkTerminology("Your Cart", "आपकी गाड़ी", terms)).toEqual([
      "glossary_missing:cart",
      "glossary_forbidden:गाड़ी",
    ]);
  });
});

describe("quality", () => {
  const hi = getLanguage("hi")!;
  const ar = getLanguage("ar")!;
  const fr = getLanguage("fr")!;

  it("finds placeholders of every supported form", () => {
    expect(
      extractPlaceholders(
        "Hi {name}, {{count}} items, %s and %1$d <b>bold</b> https://softwarevala.com/x.",
      ),
    ).toEqual(
      ["%1$d", "%s", "</b>", "<b>", "https://softwarevala.com/x", "{name}", "{{count}}"].sort(),
    );
  });

  it("accepts a real translation", () => {
    // From the reviewed Hindi dictionary.
    const result = assessTranslation({
      source: "Apply Now",
      translated: "अभी आवेदन करें",
      target: hi,
    });
    expect(result.accepted).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects empty output", () => {
    expect(
      assessTranslation({ source: "Apply Now", translated: "  ", target: hi }).errors,
    ).toContain("empty");
  });

  it("rejects output that lost a placeholder", () => {
    const result = assessTranslation({ source: "Hello {name}", translated: "नमस्ते", target: hi });
    expect(result.accepted).toBe(false);
    expect(result.errors).toContain("placeholder_mismatch");
  });

  it("rejects output in the wrong script", () => {
    const result = assessTranslation({
      source: "Language",
      translated: "Language please",
      target: ar,
    });
    expect(result.errors).toContain("wrong_script");
  });

  it("rejects the model talking about the task", () => {
    expect(
      assessTranslation({
        source: "Try again",
        translated: "Here is the translation: Réessayer",
        target: fr,
      }).errors,
    ).toContain("meta_text");
  });

  it("rejects an untranslated sentence but allows an unchanged short label", () => {
    expect(
      assessTranslation({
        source: "Browse all software products",
        translated: "Browse all software products",
        target: fr,
      }).errors,
    ).toContain("untranslated");
    const label = assessTranslation({ source: "SEO", translated: "SEO", target: fr });
    expect(label.accepted).toBe(true);
    expect(label.warnings).toContain("unchanged");
  });

  it("rejects a lost protected term", () => {
    expect(
      assessTranslation({
        source: "Software Vala",
        translated: "वाला",
        target: hi,
        lostTokens: ["⟦T0⟧"],
      }).errors,
    ).toContain("protected_term_lost");
  });

  it("lowers the score for warnings and respects engine confidence", () => {
    const clean = assessTranslation({
      source: "Apply Now",
      translated: "अभी आवेदन करें",
      target: hi,
      engineConfidence: 0.9,
    });
    const warned = assessTranslation({
      source: "Apply Now",
      translated: "अभी आवेदन करें",
      target: hi,
      engineConfidence: 0.9,
      terminologyIssues: ["glossary_missing:Apply"],
    });
    expect(clean.score).toBe(0.9);
    expect(warned.score).toBeLessThan(clean.score);
    expect(
      assessTranslation({
        source: "Apply Now",
        translated: "अभी आवेदन करें",
        target: hi,
        engineConfidence: 0.2,
      }).accepted,
    ).toBe(false);
  });
});

describe("quality of ICU messages", () => {
  const ar = getLanguage("ar")!;
  const hi = getLanguage("hi")!;
  const fr = getLanguage("fr")!;
  const select =
    "{status, select, paid {Paid} awaiting_payment {Awaiting payment} failed {Failed} other {{status}}}";

  it("a select's one-word branches are text, not placeholders", () => {
    // Real engine output (MADLAD, quality mode) that the old check refused.
    const result = assessTranslation({
      source: select,
      translated:
        "{status, select, paid {مدفوعة} awaiting_payment {في انتظار الدفع} failed {فشلت} other {{status}}}",
      target: ar,
    });
    expect(result.errors).not.toContain("placeholder_mismatch");
    expect(result.accepted).toBe(true);
    expect(
      assessTranslation({
        source: select,
        translated:
          "{status, select, paid {Payé} awaiting_payment {En attente de paiement} failed {Échoué} other {{status}}}",
        target: fr,
      }).accepted,
    ).toBe(true);
  });

  it("a plural with more branches in the target keeps its variables", () => {
    const source = "{count, plural, one {{names} is typing…} other {{names} are typing…}}";
    const arabic =
      "{count, plural, zero {{names} يكتبون…} one {{names} يكتب…} two {{names} يكتبان…} few {{names} يكتبون…} many {{names} يكتبون…} other {{names} يكتبون…}}";
    expect(assessTranslation({ source, translated: arabic, target: ar }).accepted).toBe(true);
    // A variable lost from the translation is still caught.
    const lost = "{count, plural, one {कोई टाइप कर रहा है…} other {कई लोग टाइप कर रहे हैं…}}";
    expect(assessTranslation({ source, translated: lost, target: hi }).errors).toContain(
      "placeholder_mismatch",
    );
  });

  it("a select whose argument was renamed is caught", () => {
    const renamed =
      "{estado, select, paid {Payé} awaiting_payment {En attente} failed {Échoué} other {{estado}}}";
    expect(assessTranslation({ source: select, translated: renamed, target: fr }).errors).toContain(
      "placeholder_mismatch",
    );
  });
});
