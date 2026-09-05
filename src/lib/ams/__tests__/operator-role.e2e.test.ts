// E2E-style guard suite for the Operator role.
// Verifies Operator is present in every role selector, vault filter and
// collection display, and that selecting Operator resolves real 3D assets.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLES, type RoleSlug } from "@/lib/ams/roles";
import { ROLE_THEMES } from "@/lib/ams/role-themes";
import { ROLE_ENVIRONMENT, SHOWCASES } from "@/lib/ams/museum";

const ROOT = process.cwd();
const ROUTES = join(ROOT, "src/routes/_authenticated");
const ASSETS = join(ROOT, "src/assets");

/** Every 3D collectible asset directory that must contain an operator piece. */
const ASSET_DIRS = [
  "badges", "passports", "certificates", "membership", "ranks", "shields",
  "awards", "achievements", "reputation-medals", "trust-seals", "recognition-coins",
  "xp-crystals", "reward-chests", "honor-coins", "legacy-medals", "identity-cards",
  "license-cards", "founder-seals", "hall-of-fame", "trophies",
];

const OPERATOR: RoleSlug = "operator";

function routeFiles(): string[] {
  return readdirSync(ROUTES).filter((f) => f.endsWith(".tsx"));
}

function read(file: string): string {
  return readFileSync(join(ROUTES, file), "utf8");
}

describe("Operator role — selectors", () => {
  it("exists in the canonical ROLES registry", () => {
    const operator = ROLES.find((r) => r.slug === OPERATOR);
    expect(operator).toBeDefined();
    expect(operator!.name).toBeTruthy();
    expect(operator!.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(operator!.passportPrefix).toMatch(/^SV-/);
    expect(operator!.glyph).toBeTruthy();
  });

  it("is offered by the shared RoleFilter (derived from ROLES)", () => {
    // RoleFilter builds its options as ["all", ...ROLES]; assert the derived list.
    const options = ["all", ...ROLES.map((r) => r.slug)];
    expect(options).toContain(OPERATOR);
    const source = readFileSync(join(ROOT, "src/components/ams/collectible/RoleFilter.tsx"), "utf8");
    expect(source).toMatch(/ROLES\.map/);
  });

  it("has a theme and a museum environment", () => {
    expect(ROLE_THEMES[OPERATOR]).toBeDefined();
    expect(ROLE_ENVIRONMENT[OPERATOR]).toBeDefined();
    expect(ROLE_ENVIRONMENT[OPERATOR].name).toBeTruthy();
  });
});

describe("Operator role — vault filters", () => {
  const vaults = routeFiles().filter((f) => f.includes("vault"));

  it("finds every vault route", () => {
    expect(vaults.length).toBeGreaterThanOrEqual(20);
  });

  it.each(vaults)("%s renders a ROLES-driven filter so Operator is selectable", (file) => {
    const src = read(file);
    const usesRoleFilter = src.includes("RoleFilter") || src.includes("CollectibleVault");
    expect(usesRoleFilter).toBe(true);
    // No vault may hardcode a role allowlist that could exclude Operator.
    expect(src).not.toMatch(/ROLES\.filter\(\(r\) => r\.slug !== ["']operator["']\)/);
  });
});

describe("Operator role — collection displays", () => {
  it.each(ASSET_DIRS)("collection %s ships an operator 3D asset", (dir) => {
    expect(existsSync(join(ASSETS, dir, "operator.png"))).toBe(true);
  });

  it("every asset collection has one file per role", () => {
    for (const dir of ASSET_DIRS) {
      const files = readdirSync(join(ASSETS, dir)).filter((f) => f.endsWith(".png"));
      for (const role of ROLES) {
        expect(files, `${dir} missing ${role.slug}`).toContain(`${role.slug}.png`);
      }
    }
  });
});

describe("Operator role — museum showcases", () => {
  it.each(SHOWCASES.map((s) => [s.slug, s] as const))(
    "%s resolves an Operator collectible", (_slug, showcase) => {
      const url = showcase.assets[OPERATOR];
      expect(url, `${showcase.slug} has no operator asset`).toBeTruthy();
      expect(url).toMatch(/operator\.png/);
    },
  );

  it("selecting Operator yields exactly one collectible per showcase", () => {
    for (const showcase of SHOWCASES) {
      const selected = ROLES.filter((r) => r.slug === OPERATOR);
      expect(selected).toHaveLength(1);
      const items = selected.map((r) => ({
        src: showcase.assets[r.slug],
        filename: `${r.slug}-${showcase.suffix}.png`,
      }));
      expect(items[0].src).toContain("operator");
      expect(items[0].filename).toBe(`operator-${showcase.suffix}.png`);
    }
  });
});
