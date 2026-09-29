/**
 * What each Control Panel module is made of, read from its code.
 *
 * The browser pass says what a module does on the day; this says what its code
 * is capable of. From each module's route file it follows the imports into
 * src/, and in every file reached it looks for the usual signs that a screen
 * is painted rather than connected:
 *
 *   - Math.random() producing numbers a person will read
 *   - arrays of records written into the code (names, emails, amounts)
 *   - words that say so: mock, dummy, sample, fake, lorem, placeholder
 *   - a success message with no request anywhere near it
 *   - setTimeout standing in for a save
 *
 * Each hit is a lead, not a verdict: the report shows the line, and the browser
 * pass and a reading of the code decide what it is.
 *
 *   node scripts/ops/control-panel-code-scan.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const panel = readFileSync("src/routes/control-panel.tsx", "utf8");
const sidebar = readFileSync("src/components/super-admin-wireframe/ControlPanelSidebar.tsx", "utf8");
const labels = new Map([...sidebar.matchAll(/\{\s*id:\s*'([a-z_]+)',\s*label:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
const routes = new Map([["control_panel", "/control-panel"]]);
for (const m of panel.matchAll(/^\s*([a-z_]+):\s*"(\/[^"]*)",/gm)) routes.set(m[1], m[2]);
for (const m of panel.matchAll(/if \(roleId === "([a-z_]+)"\) \{\s*void navigate\(\{ to: "([^"]+)" \}\)/g)) routes.set(m[1], m[2]);
// Only the ROLE_DASHBOARD_ROUTES block maps an entry to /dashboard/<role>.
const dashboards = panel.slice(panel.indexOf("ROLE_DASHBOARD_ROUTES"), panel.indexOf("const dashRole"));
for (const m of dashboards.matchAll(/^\s*([a-z_]+):\s*"([a-z]+)",\s*$/gm)) if (!routes.has(m[1])) routes.set(m[1], `/dashboard/${m[2]}`);

/** The route file for a path, the way TanStack names them. */
function routeFile(path) {
  if (path.startsWith("/dashboard/")) return "src/routes/dashboard.$role.tsx";
  // /manager/security and /manager/settings are sections of the /manager route.
  if (path.startsWith("/manager/")) return "src/routes/manager.tsx";
  const base = path.replace(/^\//, "").replace(/\//g, ".");
  for (const candidate of [`src/routes/${base}.tsx`, `src/routes/${base}.index.tsx`, `src/routes/${base}/index.tsx`, `src/routes/${base}.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(from.replace(/[\\/][^\\/]+$/, ""), spec);
  else return null;
  for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const file = `${base}${ext}`.replace(/\\/g, "/");
    if (existsSync(file) && !file.endsWith("/")) {
      try {
        readFileSync(file);
        return file;
      } catch {
        /* a directory */
      }
    }
  }
  return null;
}

/** Every source file a route reaches, stopping at shared UI primitives. */
function reach(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length && seen.size < 400) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = m[1] ?? m[2];
      if (/^@\/components\/ui\/|^@\/integrations\/|^@\/lib\/i18n\//.test(spec)) continue;
      const next = resolve(file, spec);
      if (next && /\.(tsx?|jsx?)$/.test(next) && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

const PATTERNS = [
  { kind: "RANDOM", re: /Math\.random\(\)/ },
  { kind: "SAMPLE-WORD", re: /\b(mock(ed)?|dummy|fake|lorem|sampleData|demoData|placeholderData|FAKE_|MOCK_|SAMPLE_)\b/i },
  { kind: "FAKE-SAVE", re: /setTimeout\([^)]*\)\s*;?\s*$|setTimeout\(\s*\(\)\s*=>\s*\{?\s*(toast|set[A-Z]\w*\(\s*(true|false)\s*\))/ },
  { kind: "HARDCODED-PEOPLE", re: /\{\s*(id:\s*['"\d][^}]*)?name:\s*['"][A-Z][a-z]+ [A-Z][a-z]+['"][^}]*(email|phone|role|revenue|amount|status):/ },
  { kind: "HARDCODED-EMAIL", re: /['"][a-z0-9._-]+@(example|test|demo|acme|company|mail)\.(com|io|org)['"]/i },
];

function scanFile(file) {
  const hits = [];
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    for (const p of PATTERNS) {
      if (p.re.test(line)) hits.push({ kind: p.kind, line: index + 1, text: trimmed.slice(0, 140) });
    }
  });
  // A success message in a file that never asks a server for anything.
  const text = lines.join("\n");
  if (/toast\.success\(/.test(text) && !/fetch\(|supabase|\.rpc\(|useMutation|useResource|useQuery|createServerFn|serverFn|api\(|axios/.test(text)) {
    hits.push({ kind: "SUCCESS-WITHOUT-REQUEST", line: 0, text: "toast.success in a file with no request of any kind" });
  }
  return hits;
}

const report = [];
for (const [id, route] of routes) {
  const entry = routeFile(route);
  if (!entry) {
    report.push({ id, label: labels.get(id) ?? id, route, entry: null, files: 0, hits: [] });
    console.log(`  ${(labels.get(id) ?? id).padEnd(28)} ${route.padEnd(24)} NO ROUTE FILE`);
    continue;
  }
  const files = reach(entry);
  const hits = [];
  for (const file of files) for (const h of scanFile(file)) hits.push({ file, ...h });
  const byKind = hits.reduce((acc, h) => ((acc[h.kind] = (acc[h.kind] ?? 0) + 1), acc), {});
  report.push({ id, label: labels.get(id) ?? id, route, entry, files: files.length, byKind, hits: hits.slice(0, 80) });
  console.log(`  ${(labels.get(id) ?? id).padEnd(28)} ${route.padEnd(24)} files=${String(files.length).padStart(3)} ${JSON.stringify(byKind)}`);
}
writeFileSync(`${process.env.TEMP ?? "."}/control-panel-code-scan.json`, JSON.stringify(report, null, 1));
console.log(`\n  ${report.length} modules -> ${process.env.TEMP ?? "."}/control-panel-code-scan.json`);
