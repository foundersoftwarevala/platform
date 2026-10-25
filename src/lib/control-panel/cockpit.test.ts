import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { COCKPIT_ROLES } from "./cockpit";

const routeAccess = readFileSync(
  resolve(process.cwd(), "src/components/auth/RouteAccessGate.tsx"),
  "utf8",
);
const accessHandler = readFileSync(
  resolve(process.cwd(), "src/lib/control-panel/access.server.ts"),
  "utf8",
);

describe("Control Panel role authorization", () => {
  it("allows finance_manager through both route and API allowlists", () => {
    expect(COCKPIT_ROLES).toContain("finance_manager");
    expect(routeAccess).toMatch(
      /prefix: "\/control-panel",[\s\S]*?roles: \[[^\]]*"finance_manager"/,
    );
    expect(accessHandler).toContain("COCKPIT_ROLES");
  });

  it("does not allow roles excluded by the route to call the cockpit API", () => {
    expect(COCKPIT_ROLES).not.toContain("developer");
    expect(COCKPIT_ROLES).not.toContain("owner");
  });
});
