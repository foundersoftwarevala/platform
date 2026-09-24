/**
 * Build the country order for the home rails from what the catalogue actually
 * holds, and attach each country's region from registry_countries.
 *
 * Nothing here is chosen: the order is the owner's published list, the names
 * are the markers the products already carry, and the region is the one the
 * registry records. A country the catalogue does not carry is left out rather
 * than added.
 */
import { readFileSync, writeFileSync } from "node:fs";
function readEnv(f) {
  const o = {};
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return o;
}
const ops = readEnv(".env.ops");
const h = { apikey: ops.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ops.SUPABASE_SERVICE_ROLE_KEY}` };

// The owner's published order, first geographic batch.
const ORDER = ["USA","UAE","Canada","UK","Australia","Saudi Arabia","Kenya","Nigeria","South Africa","Malaysia","Nepal","Bangladesh","Philippines","Tanzania","Ghana","Uganda","Zambia","Zimbabwe","Rwanda","Botswana","Mauritius","Singapore","New Zealand","Thailand","Vietnam","Indonesia","Cambodia","Sri Lanka","Qatar","Kuwait","Oman","Bahrain","Italy","Germany","France","Netherlands","Ireland","Portugal","Spain","Japan","South Korea","Israel","Jordan","Egypt","Morocco","Mozambique","Angola","Namibia","Cameroon","Côte d’Ivoire","Senegal","Ethiopia","Guyana","Trinidad & Tobago","Fiji","Brunei","Georgia","Cyprus","Türkiye","Kazakhstan"];

// What the catalogue actually marks products with.
const markers = new Set();
for (let offset = 0; ; offset += 1000) {
  const r = await fetch(`${ops.SUPABASE_URL}/rest/v1/marketplace_products?select=search_keywords&visible=eq.true&limit=1000&offset=${offset}`, { headers: h });
  const page = await r.json();
  if (!Array.isArray(page) || page.length === 0) break;
  for (const p of page) {
    const k = Array.isArray(p.search_keywords) ? p.search_keywords.find((x) => typeof x === "string" && x.startsWith("country:")) : null;
    if (k) markers.add(k.slice("country:".length));
  }
  if (page.length < 1000) break;
}

const registry = await (await fetch(`${ops.SUPABASE_URL}/rest/v1/registry_countries?select=code,name,region&limit=300`, { headers: h })).json();
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
const byName = new Map(registry.map((c) => [norm(c.name), c]));
const ALIAS = { usa: "unitedstates", uk: "unitedkingdom", uae: "unitedarabemirates", turkiye: "turkey", southkorea: "korearepublicof", trinidadtobago: "trinidadandtobago", cotedivoire: "cotedivoire" };

const rows = [];
const missingFromCatalogue = [];
const missingRegion = [];
for (const name of ORDER) {
  const marker = [...markers].find((m) => norm(m) === norm(name));
  if (!marker) { missingFromCatalogue.push(name); continue; }
  const key = norm(marker);
  const reg = byName.get(key) ?? byName.get(ALIAS[key] ?? "") ?? [...byName.values()].find((c) => norm(c.name).startsWith(key) || key.startsWith(norm(c.name)));
  if (!reg) missingRegion.push(marker);
  rows.push({ marker, label: name, code: reg?.code ?? null, region: reg?.region ?? null });
}
console.log(`catalogue carries ${markers.size} country markers`);
console.log(`order resolved: ${rows.length} of ${ORDER.length}`);
if (missingFromCatalogue.length) console.log("not in the catalogue:", missingFromCatalogue.join(", "));
if (missingRegion.length) console.log("no registry region:", missingRegion.join(", "));
const byRegion = {};
for (const r of rows) byRegion[r.region ?? "unknown"] = (byRegion[r.region ?? "unknown"] ?? 0) + 1;
console.log("regions:", JSON.stringify(byRegion));
writeFileSync("C:/Users/oooo/AppData/Local/Temp/claude/countries.json", JSON.stringify(rows, null, 1));
console.log("first 10:", rows.slice(0, 10).map((r) => `${r.marker}(${r.code ?? "?"}/${r.region ?? "?"})`).join(" "));
