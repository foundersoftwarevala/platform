import { describe, expect, it } from "vitest";

import { DEMO_OPERATOR_ROLES, DEMO_ROUTE_ROLES } from "./demo-roles";

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
