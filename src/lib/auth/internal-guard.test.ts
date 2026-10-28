import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_OPERATOR_ROLES, DEMO_ROUTE_ROLES } from "./demo-roles";
import { requireInternalOperator } from "./internal-guard";
import { MARKETPLACE_MANAGER_API_ROLES } from "./marketplace-manager-roles";
import { isPubliclyReachable } from "@/components/auth/RouteAccessGate";

const OPERATOR_ROLES = new Set<string>(DEMO_OPERATOR_ROLES);

/**
 * R4: the door and the lock must admit the same people.
 *
 * RouteAccessGate let `developer` and `support` open /demo-manager while the
 * pipeline behind it - requireInternalOperator - accepts boss, admin,
 * super_admin, owner and developer. A support user could open the console and be
 * refused the moment they acted on it, which reads as a fault in the product
 * rather than a permission boundary.
 *
 * Publishing a demo puts third-party software on the storefront under Software
 * Vala's branding, so the answer was to align the door with the lock rather than
 * widen the lock. These tests hold that decision in place: they fail if anybody
 * adds support back to either side, or widens the operator set by accident.
 */
describe("demo publishing authority", () => {
  it("accepts exactly the five operator roles", () => {
    expect([...OPERATOR_ROLES].sort()).toEqual(
      ["admin", "boss", "developer", "owner", "super_admin"].sort(),
    );
  });

  it("does not accept support", () => {
    expect(OPERATOR_ROLES.has("support")).toBe(false);
  });

  it("does not accept a role nobody granted", () => {
    for (const role of ["", "customer", "influencer", "reseller", "author", "vendor", "seo"]) {
      expect(OPERATOR_ROLES.has(role)).toBe(false);
    }
  });

  it("opens the demo consoles to the same people the pipeline accepts", () => {
    // The route list carries only the app_roles admitted on top of the platform
    // operators, which RequireRole always lets through - so `developer` alone is
    // the whole of the difference, and support must not be in it.
    expect(DEMO_ROUTE_ROLES).toEqual(["developer"]);
    for (const role of DEMO_ROUTE_ROLES) {
      expect(OPERATOR_ROLES.has(role)).toBe(true);
    }
  });
});

describe("Pro Manager route authority", () => {
  it("keeps the operator-only console behind the central route gate", () => {
    expect(isPubliclyReachable("/rd-manager/pro-manager")).toBe(false);
    expect(isPubliclyReachable("/rd-manager/pro-manager/users")).toBe(false);
    expect(isPubliclyReachable("/rd-manager")).toBe(true);
  });
});

describe("Marketplace Manager API authority", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_API_TOKEN", "");
    vi.stubEnv("SUPABASE_URL", "https://supabase.fixture.invalid");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-fixture");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-fixture");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("shares one allowlist with the Marketplace Manager route gate", () => {
    expect(MARKETPLACE_MANAGER_API_ROLES).toEqual([
      "boss",
      "boss_owner",
      "admin",
      "super_admin",
      "owner",
      "founder",
      "marketing",
      "seo",
    ]);
  });

  it("refuses a developer-only account even though demo publishing admits developers", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-fixture" }), { status: 200 });
      }
      return new Response(JSON.stringify([{ role: "developer" }]), { status: 200 });
    });

    const result = await requireInternalOperator(
      new Request("https://fixture.invalid", { headers: { authorization: "Bearer fixture" } }),
      { allowedRoles: MARKETPLACE_MANAGER_API_ROLES },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("accepts an explicitly authorized Marketplace Manager role", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-fixture" }), { status: 200 });
      }
      return new Response(JSON.stringify([{ role: "admin" }]), { status: 200 });
    });

    const result = await requireInternalOperator(
      new Request("https://fixture.invalid", { headers: { authorization: "Bearer fixture" } }),
      { allowedRoles: MARKETPLACE_MANAGER_API_ROLES },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.roles).toEqual(["admin"]);
  });

  it("explicitly admits a Super Admin to Marketplace Manager APIs", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-fixture" }), { status: 200 });
      }
      return new Response(JSON.stringify([{ role: "super_admin" }]), { status: 200 });
    });

    const result = await requireInternalOperator(
      new Request("https://fixture.invalid", {
        headers: { authorization: "Bearer fixture-token" },
      }),
      { allowedRoles: MARKETPLACE_MANAGER_API_ROLES },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.roles).toEqual(["super_admin"]);
  });

  it.each([
    "boss",
    "boss_owner",
    "admin",
    "super_admin",
    "owner",
    "founder",
    "marketing",
    "seo",
  ])(
    "accepts the %s Marketplace Manager operator role",
    async (role) => {
      vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/auth/v1/user")) {
          return new Response(JSON.stringify({ id: "user-fixture" }), { status: 200 });
        }
        return new Response(JSON.stringify([{ role }]), { status: 200 });
      });

      const result = await requireInternalOperator(
        new Request("https://fixture.invalid", {
          headers: { authorization: "Bearer fixture" },
        }),
        { allowedRoles: MARKETPLACE_MANAGER_API_ROLES },
      );

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.roles).toEqual([role]);
    },
  );
});
