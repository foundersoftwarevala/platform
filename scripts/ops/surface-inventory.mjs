/**
 * Which of the platform's surfaces exist, and which of them are connected.
 *
 * The owner's map names every dashboard and manager and what it is for. This
 * matches each one to the routes that serve it and reports whether anything
 * behind it reads real data - a wall naming a resource, a server function, a
 * Supabase call or a query - or whether the screen is drawing from nothing.
 *
 *   node scripts/ops/surface-inventory.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SURFACES = [
  ["Control Panel", ["control-panel"]],
  ["Super Admin", ["control-panel", "admin"]],
  ["Boss Dashboard", ["boss"]],
  ["CEO Dashboard", ["ai-ceo"]],
  ["Vala AI", ["vala-ai"]],
  ["Server Manager", ["server-manager"]],
  ["AI API Manager", ["ai-api-manager"]],
  ["Development Manager", ["dev-manager"]],
  ["Product Manager", ["marketplace-manager"]],
  ["Demo Manager", ["demo-manager", "product-demo-manager", "demo-ops", "demo-workspace"]],
  ["Task Manager", ["task-manager"]],
  ["Promise Tracker", ["promise-tracker"]],
  ["Assist Manager", ["assist-manager"]],
  ["AMS Manager", ["ams-manager", "ams"]],
  ["Marketplace Manager", ["marketplace-manager"]],
  ["Creator Manager", ["creator-manager"]],
  ["Vendor Manager", ["vendor-manager"]],
  ["Marketing Manager", ["marketing"]],
  ["SEO Manager", ["seo-manager"]],
  ["Lead Manager", ["lead-manager"]],
  ["Sales & Support", ["sales-crm", "sales-support-manager"]],
  ["Chat Manager", ["chat-manager"]],
  ["Customer Support", ["support", "support-agent"]],
  ["Franchise Owner", ["franchise-manager"]],
  ["Reseller Manager", ["reseller-manager"]],
  ["Influencer Manager", ["influencer-manager"]],
  ["Affiliate Manager", ["affiliate-manager"]],
  ["Legal Manager", ["legal-manager"]],
  ["Finance Manager", ["finance-manager"]],
  ["Language Manager", ["language-manager"]],
  ["Chat (internal)", ["chat"]],
  ["Vala TV", ["vala-tv"]],
  ["Academy", ["academy"]],
  ["Home", ["index"]],
  ["Marketplace", ["marketplace"]],
  ["Checkout", ["checkout"]],
  ["Login", ["login", "auth"]],
  ["Account", ["account"]],
  ["Role Dashboards", ["dashboard"]],
  ["Manager Hub", ["manager"]],
  ["Apply", ["apply"]],
  ["Pages", ["pages"]],
  ["Keywords", ["keywords"]],
  ["Admin Import", ["admin"]],
];

const routes = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith(".tsx")) routes.push(full.replace(/\\/g, "/"));
  }
})("src/routes");

/** Everything a route pulls in from our own source, one level deep. */
function importsOf(file) {
  const text = readFileSync(file, "utf8");
  const found = [];
  for (const m of text.matchAll(/from "(@\/[^"]+)"/g)) {
    const rel = "src/" + m[1].slice(2);
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      try {
        statSync(rel + ext);
        found.push(rel + ext);
        break;
      } catch { /* not this one */ }
    }
  }
  return found;
}

const CONNECTED = /resource:\s*"|createServerFn|useServerFn|supabase\s*\.?from\(|\.from\("|useQuery\(/;

function connectionOf(file, depth = 0, seen = new Set()) {
  if (seen.has(file) || depth > 5) return false;
  seen.add(file);
  let text;
  try { text = readFileSync(file, "utf8"); } catch { return false; }
  if (CONNECTED.test(text)) return true;
  for (const dep of importsOf(file)) {
    if (connectionOf(dep, depth + 1, seen)) return true;
  }
  return false;
}

const rows = [];
for (const [name, hints] of SURFACES) {
  const matches = routes.filter((r) => {
    const base = r.replace("src/routes/", "").replace(".tsx", "");
    return hints.some((h) => base === h || base.startsWith(h + ".") || base.startsWith(h + "/") || base === h.replace("$", "$"));
  });
  if (!matches.length) {
    rows.push({ name, routes: 0, connected: false, note: "no route found" });
    continue;
  }
  const connected = matches.some((m) => connectionOf(m));
  rows.push({ name, routes: matches.length, connected, note: matches[0].replace("src/routes/", "") });
}

const live = rows.filter((r) => r.connected);
const dead = rows.filter((r) => r.routes > 0 && !r.connected);
const missing = rows.filter((r) => r.routes === 0);

console.log(`${rows.length} surfaces from the owner's map\n`);
for (const r of rows) {
  const mark = r.routes === 0 ? "MISSING " : r.connected ? "reads   " : "NO DATA ";
  console.log(`${mark} ${r.name.padEnd(22)} ${String(r.routes).padStart(3)} route(s)  ${r.note}`);
}
console.log(`\nreads real data : ${live.length}`);
console.log(`draws nothing   : ${dead.length}`);
console.log(`no route at all : ${missing.length}`);
if (dead.length) {
  console.log(`\nthe ones to connect:`);
  for (const r of dead) console.log(`  ${r.name}`);
}
if (missing.length) {
  console.log(`\nthe ones with no route:`);
  for (const r of missing) console.log(`  ${r.name}`);
}
