import { describe, expect, it } from "vitest";
import { DEFAULT_ACTIONS, resolveProductActions } from "../action-layer";
import { OWNER_LOCKED, OWNER_ONLY, OWNER_ROLES, ROLE_PERMISSIONS, resolveAction } from "../permission-guard";
import { csvCell, orSearchTerm } from "../../postgrest-safe";

describe("permission matrix: owner-only actions", () => {
  it("refuses configure to a role the matrix was edited to grant it to", () => {
    const edited = { ...ROLE_PERMISSIONS, developer: [...OWNER_ONLY] };
    const decision = resolveAction({ roles: ["developer"], action: "configure_permissions", permissions: edited });
    expect(decision.enabled).toBe(false);
    expect(decision.visible).toBe(false);
  });

  it("still lets the owner tier configure", () => {
    for (const role of OWNER_ROLES) {
      const decision = resolveAction({ roles: [role], action: "configure_permissions" });
      expect(decision.enabled).toBe(true);
    }
  });

  it("keeps the owner tier's lock-out protection in the shipped defaults", () => {
    for (const role of OWNER_ROLES) {
      for (const permission of OWNER_LOCKED) expect(ROLE_PERMISSIONS[role]).toContain(permission);
    }
  });
});

describe("action layer: DISABLED visibility", () => {
  const product = { id: "p", slug: "p", demo_url: "https://demo.example", visible: true, price_label: "$249", content_status: "published" };
  const env = { paymentConfigured: true, signedIn: true };

  it("turns a DISABLED action off, with its reason", () => {
    const actions = DEFAULT_ACTIONS.map((a) => (a.key === "BUY_NOW" ? { ...a, visibility: "DISABLED" as const } : a));
    const buy = resolveProductActions(actions, product, env).find((a) => a.key === "BUY_NOW");
    expect(buy?.available).toBe(false);
    expect(buy?.reason).toMatch(/Disabled/);
  });

  it("leaves a VISIBLE action available", () => {
    const buy = resolveProductActions(DEFAULT_ACTIONS, product, env).find((a) => a.key === "BUY_NOW");
    expect(buy?.available).toBe(true);
  });
});

describe("orSearchTerm", () => {
  it("removes the characters that end a PostgREST or() condition", () => {
    expect(decodeURIComponent(orSearchTerm("Smith, John (urgent)"))).toBe("Smith John urgent");
    expect(decodeURIComponent(orSearchTerm('a*b"c\\d'))).toBe("a b c d");
  });

  it("encodes what is left", () => {
    expect(orSearchTerm("50% off & more")).toBe("50%25%20off%20%26%20more");
  });
});

describe("csvCell", () => {
  it("makes a would-be formula plain text", () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe(`"'=HYPERLINK(""http://x"",""click"")"`);
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  it("quotes commas, quotes and newlines and leaves plain text alone", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });
});
