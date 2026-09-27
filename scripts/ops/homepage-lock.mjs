/**
 * The homepage is locked. This is what enforces it.
 *
 * The owner's instruction was plain: the marketplace homepage works, and no
 * piece of work on the Marketplace Manager may touch it. A promise not to
 * touch something is worth nothing across a long session — this fails the
 * build instead.
 *
 *   node scripts/ops/homepage-lock.mjs            check the working tree
 *   node scripts/ops/homepage-lock.mjs --record   re-record the baseline
 *
 * --record is deliberately separate and must be run on purpose. Nothing in an
 * ordinary workflow re-records it, so the lock cannot quietly re-baseline
 * itself around a change that should never have happened.
 *
 * What is locked: everything that renders or feeds the public homepage — the
 * components, the route data, the static site content, and the card grid the
 * owner authored. Manager code is not locked; that is the work.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const BASELINE = "scripts/ops/homepage-lock.json";

/** Every path whose contents the public homepage depends on. */
const LOCKED = [
  // The front page at "/" is sapphire-home, not marketplace-home. The first
  // version of this list had only the second, so the page most visitors
  // actually land on was the one the lock did not cover. Both are locked: "/"
  // renders sapphire-home/HomeIndex and "/marketplace" renders
  // marketplace-home/HomeIndex, and each has its own copy of the header and
  // the utility strip.
  "src/components/sapphire-home",
  "src/components/marketplace-home",
  "src/lib/site-content",
  "src/lib/marketplace/home-catalog.functions.ts",
  "src/lib/marketplace/home-layout.functions.ts",
  "src/lib/marketplace/home-route-data.ts",
  "src/lib/marketplace/home-category-map.ts",
  "src/lib/marketplace/rail-countries.ts",
  "src/lib/marketplace/catalog.server.ts",
  "src/lib/storefront/chrome.functions.ts",
  "src/data/extraDemos.ts",
];

function walk(path, out) {
  if (!existsSync(path)) return out;
  const info = statSync(path);
  if (info.isFile()) {
    out.push(relative(ROOT, path).split(sep).join("/"));
    return out;
  }
  for (const entry of readdirSync(path)) walk(join(path, entry), out);
  return out;
}

function fingerprint() {
  const files = [];
  for (const path of LOCKED) walk(join(ROOT, path), files);
  files.sort();
  const map = {};
  for (const file of files) {
    // Line endings are normalised before hashing. The first version of this
    // hashed the bytes, recorded the baseline on Windows where git checks out
    // CRLF, and then reported all twenty-nine files changed on the Linux
    // server where they are LF. A lock that cries wolf on every deploy is one
    // people switch off, which is worse than no lock at all.
    const text = readFileSync(join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
    map[file] = createHash("sha256").update(text).digest("hex").slice(0, 16);
  }
  return map;
}

const now = fingerprint();

if (process.argv.includes("--record")) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
  console.log(`homepage lock recorded: ${Object.keys(now).length} file(s)`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error("No homepage baseline recorded. Run: node scripts/ops/homepage-lock.mjs --record");
  process.exit(1);
}

const before = JSON.parse(readFileSync(BASELINE, "utf8"));
const changed = [];
const added = [];
const removed = [];

for (const [file, hash] of Object.entries(now)) {
  if (!(file in before)) added.push(file);
  else if (before[file] !== hash) changed.push(file);
}
for (const file of Object.keys(before)) if (!(file in now)) removed.push(file);

const broken = changed.length + added.length + removed.length;

if (broken === 0) {
  console.log(`homepage lock intact — ${Object.keys(now).length} file(s) unchanged`);
  process.exit(0);
}

console.error("HOMEPAGE LOCK BROKEN\n");
for (const file of removed) console.error(`  REMOVED   ${file}`);
for (const file of changed) console.error(`  CHANGED   ${file}`);
for (const file of added) console.error(`  ADDED     ${file}`);
console.error(
  "\nThe homepage is locked and these files feed it. Put them back, or, if the" +
    "\nchange was genuinely asked for, re-record deliberately:" +
    "\n  node scripts/ops/homepage-lock.mjs --record",
);
process.exit(1);
