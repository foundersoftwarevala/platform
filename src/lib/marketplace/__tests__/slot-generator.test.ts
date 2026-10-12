import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("the real generator never assigns a hidden, draft or unverified tenant, even if REST returns it", () => {
  const dir = mkdtempSync(join(tmpdir(), "sv-slot-guard-"));
  try {
    writeFileSync(
      join(dir, ".env.ops"),
      "SUPABASE_URL=http://fixture.test\nSUPABASE_SERVICE_ROLE_KEY=fixture\n",
    );
    const countriesDir = join(dir, "src", "lib", "marketplace");
    mkdirSync(countriesDir, { recursive: true });
    writeFileSync(
      join(countriesDir, "rail-countries.ts"),
      `export const RAIL_COUNTRIES: RailCountry[] = [
 { marker: "USA", label: "USA", code: "US", continent: "North America", region: "North America" },
 { marker: "India", label: "India", code: "IN", continent: "Asia", region: "Asia" },
];`,
    );
    const preload = `
globalThis.fetch = async (input, init = {}) => {
 const link = String(input);
 if (link.includes("marketplace_categories")) return Response.json([
  { id: "education", slug: "education", name: "Education" }, { id: "retail", slug: "retail", name: "Retail" }
 ]);
 if (link.includes("marketplace_products")) {
  if (!link.includes("visible=eq.true&content_status=eq.published")) throw Error("Missing REST publication filter");
  return Response.json([
   { id: "hidden", name: "Hidden ERP", category_id: "education", search_keywords: ["country:USA"], visible: false, content_status: "published" },
   { id: "draft", name: "Draft ERP", category_id: "education", search_keywords: ["country:USA"], visible: true, content_status: "draft" },
   { id: "unknown", name: "Unknown ERP", category_id: "education", search_keywords: ["country:USA"], content_status: "published" },
   { id: "real", name: "Real ERP", category_id: "education", search_keywords: ["country:USA"], visible: true, content_status: "published" }
  ]);
 }
 if (init.method === "POST") {
  console.log("SAVED:" + init.body);
  return new Response(null, { status: 204 });
 }
 return Response.json([], { headers: { "content-range": "0-0/4" } });
};`;
    const script = fileURLToPath(
      new URL("../../../../scripts/ops/card-slots-generate.mjs", import.meta.url),
    );
    const output = execFileSync(
      process.execPath,
      ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, script, "--apply"],
      { cwd: dir, encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] },
    );
    const saved = output.split("\n").find((line) => line.startsWith("SAVED:"));
    expect(saved).toBeDefined();
    const rows: { current_product_id: string | null; status: string }[] = JSON.parse(
      saved!.slice(6),
    );
    expect(rows).toHaveLength(4);
    expect(
      rows.filter((row) => row.status === "occupied").map((row) => row.current_product_id),
    ).toEqual(["real"]);
    expect(rows.filter((row) => row.status === "vacant")).toHaveLength(3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
