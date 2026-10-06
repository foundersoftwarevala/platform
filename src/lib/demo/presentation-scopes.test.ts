import { expect, it } from "vitest";
import { activeDemoRules, retainVerifiedScopes } from "./presentation";

const rules = { remove: [], rebrand: [], logos: [], links: [] };

it("continues presenting saved rules while an active demo is revalidated or a transient check fails", () => {
  const saved = { ...rules, remove: ["vendor@example.test"], brandLabels: ["CoachPro"] };
  expect(activeDemoRules({ rules: saved })).toBe(saved);
  expect(activeDemoRules(null)).toEqual(rules);
});

it("retains verified branding/contact scope after a fresh investigation", () => {
  expect(
    retainVerifiedScopes(
      rules,
      {
        brandLabels: ["CoachPro", "Obsolete brand"],
        brandMonograms: ["CP", 1],
        brandLabelPaths: ["/", "/login", "https://external.test", "/bad?query"],
        publicContactPaths: ["/contact"],
      },
      "CoachPro CP Student Records",
    ),
  ).toEqual({
    ...rules,
    brandLabels: ["CoachPro"],
    brandMonograms: ["CP"],
    brandLabelPaths: ["/", "/login"],
    publicContactPaths: ["/contact"],
  });
});

it("does not resurrect deleted contacts or arbitrary global text replacements", () => {
  expect(
    retainVerifiedScopes(
      rules,
      {
        remove: ["patient@example.test"],
        rebrand: ["lead"],
        brandLabels: [null, ""],
      },
      "patient@example.test leadership",
    ),
  ).toEqual(rules);
});

it.each([null, [], "invalid"])("ignores malformed previous rules: %s", (previous) => {
  expect(retainVerifiedScopes(rules, previous, "application")).toEqual(rules);
});
