import { describe, expect, it } from "vitest";
import { bannersForRole, bannersForRoles, type CentralBanner } from "./central-banners";

const banner = (
  id: string,
  target_roles: string[] | null,
  banner_type: CentralBanner["banner_type"] = "dashboard_welcome",
): CentralBanner => ({
  id,
  slug: id,
  banner_type,
  target_roles,
  kicker: "",
  title: id,
  subtitle: "",
  cta_primary: "",
  cta_secondary: "",
  cta_link: "/",
  cta_secondary_link: null,
  gradient: "",
  icon_name: "Sparkles",
  accent: "",
  position: 0,
  published_at: null,
  unpublish_at: null,
});

describe("central banner targeting", () => {
  const banners = [
    banner("everyone-null", null),
    banner("everyone-empty", []),
    banner("author", ["author"]),
    banner("case-insensitive", ["Reseller"]),
    banner("unrelated", ["admin"]),
  ];

  it("shows global and exact-role banners to that dashboard only", () => {
    expect(bannersForRole(banners, "author").map(({ id }) => id)).toEqual([
      "everyone-null",
      "everyone-empty",
      "author",
    ]);
  });

  it("matches any role held by the signed-in user, case-insensitively", () => {
    expect(bannersForRoles(banners, ["vendor", "reseller"]).map(({ id }) => id)).toEqual([
      "everyone-null",
      "everyone-empty",
      "case-insensitive",
    ]);
  });
});
