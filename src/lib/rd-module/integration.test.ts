import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const caller = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-operator.server", () => ({ requireOperator: caller }));
import { requireRdOperator } from "./auth.server";

describe("R&D Control Panel authorization", () => {
  beforeEach(() => vi.resetAllMocks());
  it("requires an existing operator session", async () => {
    caller.mockRejectedValue(new Error("Please sign in."));
    await expect(requireRdOperator()).rejects.toThrow("Please sign in");
  });
  it.each(["boss", "boss_owner", "admin", "super_admin", "founder"])(
    "accepts %s",
    async (role) => {
      caller.mockResolvedValue({
        userId: "operator",
        email: "operator@example.invalid",
        roles: [role],
      });
      await expect(requireRdOperator()).resolves.toMatchObject({ userId: "operator" });
    },
  );
  it.each(["support", "sales", "employee", "author", "vendor"])(
    "does not widen access to %s",
    async (role) => {
      caller.mockResolvedValue({ userId: "other", roles: [role] });
      await expect(requireRdOperator()).rejects.toThrow("Control Panel manager role");
    },
  );
});

describe("complete source-module integration", () => {
  const root = process.cwd();
  const source = (path: string) => readFileSync(join(root, path), "utf8");
  it("wires the sidebar button to the authenticated module", () => {
    expect(source("src/components/super-admin-wireframe/ControlPanelSidebar.tsx")).toContain(
      "id: 'rd_manager', label: 'R&D Manager'",
    );
    expect(source("src/routes/control-panel.tsx")).toContain('rd_manager: "/rd-manager"');
    const route = source("src/routes/rd-manager.tsx");
    expect(route).toContain("<RequireRole");
    expect(route).toContain("<Outlet");
  });
  it("keeps all five source route surfaces without replacing the storefront", () => {
    for (const path of ["index", "lab", "pro-manager", "start", "track"]) {
      expect(source(`src/routes/rd-manager.${path}.tsx`)).toContain("createFileRoute(");
    }
    expect(source("src/routes/index.tsx")).not.toContain("RnDDashboard");
    expect(source("src/routes/rd-manager.index.tsx")).not.toContain('type="password"');
    expect(source("src/lib/rd-module/rd-gate.functions.ts")).not.toContain("RD_MANAGER_PASSWORD");
  });
  it("guards every imported server function, not only the page", () => {
    for (const file of readdirSync(join(root, "src/lib/rd-module")).filter(
      (file) => file.endsWith(".functions.ts") && file !== "auth.functions.ts",
    )) {
      const text = source(`src/lib/rd-module/${file}`);
      const declarations = [...text.matchAll(/createServerFn\(\{ method: "(?:GET|POST)" \}\)/g)];
      expect(declarations.length, file).toBeGreaterThan(0);
      for (const declaration of declarations) {
        expect(text.slice(declaration.index! + declaration[0].length).trimStart(), file).toMatch(
          /^\.middleware\(\[rdOperator\]\)/,
        );
      }
    }
  });
  it("includes every functional component, hook, library and route in the mapping", () => {
    const manifest = JSON.parse(source("docs/rd-module/source-manifest.json")) as {
      files: { source: string; target: string | null }[];
    };
    const functional = manifest.files.filter((file) =>
      /^src\/(?:components|hooks|lib|assets)\//.test(file.source),
    );
    expect(functional.length).toBeGreaterThan(100);
    expect(manifest.files).toHaveLength(187);
    expect(new Set(manifest.files.map((file) => file.source)).size).toBe(187);
    for (const file of functional) expect(file.target, file.source).toBeTruthy();
    for (const file of manifest.files.filter((file) => file.target)) {
      expect(existsSync(join(root, file.target!)), file.source).toBe(true);
    }
    expect(manifest.files.find((file) => file.source === ".env")?.target).toBeNull();
  });
  it("has seed-free private schema and idempotent objects", () => {
    const sql = source("supabase/migrations/20261108T111000_rd_manager_module.sql");
    expect(sql).not.toMatch(/INSERT INTO public\.(?:rnd_|pm_|rd_)/);
    expect(sql).not.toMatch(/CREATE TABLE public\./);
    expect(sql).not.toMatch(/TO anon, authenticated USING \(true\)/);
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).toContain("rd-attachments");
  });
});
