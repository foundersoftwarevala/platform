/**
 * Every screen in the app, asked for over HTTP.
 *
 * The route files name the pages, so this turns each file into the URL it
 * serves and fetches it. A page behind a sign-in is not broken, so the report
 * separates what answered with its own content, what sent the visitor to a
 * sign-in, and what actually failed.
 *
 *   node scripts/ops/sweep-routes.mjs [site]
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const site = (process.argv[2] ?? "https://softwarevala.net").replace(/\/$/, "");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const paths = new Set();
for (const file of walk("src/routes")) {
  let route = file
    .replace(/\\/g, "/")
    .replace(/^src\/routes\//, "")
    .replace(/\.tsx$/, "");
  if (route === "__root" || route.includes("/-") || route.startsWith("-")) continue;
  if (route.endsWith(".index")) route = route.slice(0, -".index".length);
  if (route === "index") route = "";
  route = route.replace(/\./g, "/").replace(/\/+$/, "");
  if (route.includes("$")) continue; // needs a real id; covered by its own probe
  paths.add("/" + route);
}

const list = [...paths].sort();
const results = [];

for (const path of list) {
  const url = site + path;
  const started = Date.now();
  let record;
  try {
    const response = await fetch(url, { redirect: "manual" });
    const ms = Date.now() - started;
    const location = response.headers.get("location") ?? "";
    let body = "";
    if (response.status === 200) body = await response.text();
    const signIn =
      /^3/.test(String(response.status)) && /login|sign-in|auth/i.test(location);
    const gated = signIn || /Sign in|Log in|Please sign in/i.test(body.slice(0, 4000));
    record = {
      path,
      status: response.status,
      ms,
      bytes: body.length,
      kind:
        response.status >= 500
          ? "FAILED"
          : response.status === 404
            ? "NOT FOUND"
            : gated
              ? "SIGN-IN"
              : response.status === 200
                ? body.length > 3000
                  ? "OK"
                  : "THIN"
                : "REDIRECT",
    };
  } catch (error) {
    record = { path, status: 0, ms: Date.now() - started, bytes: 0, kind: "FAILED", error: String(error).slice(0, 80) };
  }
  results.push(record);
  process.stdout.write(`${record.kind.padEnd(9)} ${String(record.status).padEnd(4)} ${String(record.ms).padStart(6)}ms ${record.path}\n`);
}

const by = (kind) => results.filter((r) => r.kind === kind);
console.log(`\n${list.length} screens asked for at ${site}`);
for (const kind of ["OK", "THIN", "SIGN-IN", "REDIRECT", "NOT FOUND", "FAILED"]) {
  console.log(`  ${kind.padEnd(10)} ${by(kind).length}`);
}
const bad = [...by("FAILED"), ...by("NOT FOUND")];
if (bad.length) {
  console.log(`\nneeds attention:`);
  for (const r of bad) console.log(`  ${String(r.status).padEnd(4)} ${r.path} ${r.error ?? ""}`);
}
const slow = results.filter((r) => r.ms > 3000).sort((a, b) => b.ms - a.ms).slice(0, 12);
if (slow.length) {
  console.log(`\nslowest:`);
  for (const r of slow) console.log(`  ${String(r.ms).padStart(6)}ms ${r.path}`);
}
