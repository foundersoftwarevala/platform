/**
 * The storefront header, as a browser sees it, against what the registry says.
 *
 * Top Bar Manager writes marketplace_topbar_modules and TopUtilityBar reads it,
 * so the two ought to agree. Ought is not evidence. This opens the real site at
 * three widths, reads the header out of the live DOM, and prints the comparison
 * the brief asks for: what is on the page, what is in the registry, what is in
 * one and not the other.
 *
 * It asserts nothing about what the header should contain. It reports what is
 * there, which is the only way to notice an element nobody has registered.
 *
 * With --manager it also signs in and opens Top Bar Manager, so the third
 * party to the agreement — the screen an operator actually looks at — is
 * checked against the same registry. It reads and never clicks: every control
 * on that screen writes to the live storefront, and a probe that clicks
 * everything would toggle the real header while visitors are on it. The
 * actions themselves are exercised against the database instead, in a
 * transaction that is rolled back.
 *
 *   node scripts/ops/topbar-scan.mjs
 *   node scripts/ops/topbar-scan.mjs https://softwarevala.net
 *   node scripts/ops/topbar-scan.mjs --manager
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const WANT_MANAGER = process.argv.includes("--manager");

function readEnv(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
    }
  } catch {
    /* no ops file: the manager pass is simply skipped */
  }
  return out;
}

const ops = readEnv(".env.ops");
const SITE = (
  process.argv.slice(2).find((a) => a.startsWith("http")) ||
  ops.SV_SITE ||
  process.env.SV_SITE ||
  "https://softwarevala.net"
).replace(/\/+$/, "");

/** The two homepages this platform serves, both of which render the bar. */
const PAGES = [
  { path: "/", label: "front page" },
  { path: "/marketplace", label: "marketplace" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

/**
 * Read the header out of the page.
 *
 * Runs in the browser, so it can only use the DOM. It deliberately does not
 * look for a fixed list of modules: it collects every control the header and
 * the utility strip contain, so an element nobody thought to register still
 * shows up.
 */
async function readHeader(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const st = getComputedStyle(el);
      return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
    };

    const header = document.querySelector("header");
    const brand = [];
    if (header) {
      for (const img of header.querySelectorAll("img")) {
        if (visible(img)) brand.push({ kind: "image", label: clean(img.alt) || "(no alt)" });
      }
      for (const h of header.querySelectorAll("h1, h2, p")) {
        if (visible(h) && clean(h.textContent)) {
          brand.push({ kind: h.tagName.toLowerCase(), label: clean(h.textContent) });
        }
      }
    }

    // The utility strip is the row of controls under the header. It is found by
    // its contents rather than by a class name, so a restyle does not break it.
    const strips = [...document.querySelectorAll("div")].filter((d) => {
      const kids = d.querySelectorAll(":scope > div > button, :scope > div > a");
      return kids.length >= 5 && d.compareDocumentPosition(document.body) !== 0;
    });
    const strip = strips.find((d) =>
      /favorit|language|currenc|calculat|calendar|login/i.test(d.textContent || ""),
    );

    const controls = [];
    if (strip) {
      for (const el of strip.querySelectorAll("button, a")) {
        if (!visible(el)) continue;
        const label = clean(el.getAttribute("aria-label")) || clean(el.textContent);
        if (label) controls.push(label);
      }
    }

    const sticky = [...document.querySelectorAll("div")].filter(
      (d) => visible(d) && getComputedStyle(d).position === "sticky",
    ).length;

    return {
      hasHeader: Boolean(header),
      brand,
      controls: [...new Set(controls)],
      stickyRegions: sticky,
      searchInputs: [...document.querySelectorAll("input")].filter(
        (i) => visible(i) && /search/i.test(i.placeholder || i.getAttribute("aria-label") || ""),
      ).length,
    };
  });
}

/** The registry, read the same anonymous way the header reads it. */
async function readRegistry(page) {
  return page.evaluate(async (site) => {
    try {
      const res = await fetch(`${site}/rest/v1/rpc/mm_topbar_modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return { modules: await res.json() };
    } catch (e) {
      return { error: String(e) };
    }
  }, SITE);
}

const browser = await chromium.launch();
console.log(`site: ${SITE}\n`);

let registry = null;
const seen = new Map(); // control label -> the viewports it appeared at

for (const pageDef of PAGES) {
  console.log(`${pageDef.label}  ${SITE}${pageDef.path}`);
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${SITE}${pageDef.path}`, { waitUntil: "networkidle", timeout: 60_000 });
      // The bar fetches its configuration after hydration.
      await page.waitForTimeout(1500);
      const found = await readHeader(page);
      if (!registry) registry = await readRegistry(page);

      for (const c of found.controls) {
        const key = c.toLowerCase();
        if (!seen.has(key)) seen.set(key, new Set());
        seen.get(key).add(vp.name);
      }

      console.log(
        `  ${vp.name.padEnd(8)} header:${found.hasHeader ? "yes" : "NO "}  ` +
          `brand:${found.brand.length}  controls:${found.controls.length}  ` +
          `sticky:${found.stickyRegions}  search:${found.searchInputs}`,
      );
      if (vp.name === "desktop") {
        for (const b of found.brand) console.log(`             brand · ${b.kind}: ${b.label}`);
        for (const c of found.controls) console.log(`             control · ${c}`);
      }
    } catch (e) {
      console.log(`  ${vp.name.padEnd(8)} FAILED  ${String(e).split("\n")[0]}`);
    } finally {
      await ctx.close();
    }
  }
  console.log("");
}

// ------------------------------------------------- the manager's own screen
let managerReport = null;
if (WANT_MANAGER) {
  const email = ops.SV_LOGIN_MARKETPLACE;
  const password = ops.SV_PW_MARKETPLACE ?? ops.SV_PW_TEST;
  if (!email || !password) {
    managerReport = { error: "no marketplace operator credentials in .env.ops" };
  } else {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    try {
      await page.goto(`${SITE}/login`, { waitUntil: "networkidle", timeout: 120_000 });
      await page.waitForTimeout(2500);
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      await page
        .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 })
        .catch(() => {});

      await page.goto(`${SITE}/marketplace-manager?section=Top%20Bar`, {
        waitUntil: "networkidle",
        timeout: 120_000,
      });
      await page.waitForTimeout(6000);

      managerReport = await page.evaluate(() => {
        const text = document.body.innerText ?? "";
        const badge = (s) => (text.match(new RegExp(s, "gi")) ?? []).length;
        return {
          reachedManager: /Storefront Top Bar Manager/i.test(text),
          eyebrow: (text.match(/Storefront top bar · \d+ modules?/i) ?? [])[0] ?? null,
          controlsThePage: badge("Controls the page"),
          onTheStorefront: badge("On the storefront"),
          notOnThePage: badge("Not on the page"),
          configureButtons: [...document.querySelectorAll("button")].filter((b) =>
            /configure/i.test(b.textContent ?? ""),
          ).length,
          hasExport: [...document.querySelectorAll("button")].some((b) =>
            /export/i.test(b.textContent ?? ""),
          ),
        };
      });
      managerReport.consoleErrors = consoleErrors.length;
    } catch (e) {
      managerReport = { error: String(e).split("\n")[0] };
    } finally {
      await ctx.close();
    }
  }
}

await browser.close();

// ---------------------------------------------------------------- comparison
if (!registry || registry.error) {
  console.log(`REGISTRY: could not be read — ${registry?.error ?? "no answer"}`);
  process.exit(1);
}

const modules = registry.modules ?? [];
const live = modules.filter((m) => m.status === "live");
const rendered = modules.filter((m) => m.rendered);
const onPage = modules.filter((m) => m.config?.on_storefront === true);

console.log("REGISTRY");
console.log(
  `  ${modules.length} modules · ${live.length} live · ${rendered.length} rendered by a component`,
);
console.log(`  ${onPage.length} recorded as being on the storefront\n`);

console.log("REGISTERED BUT NOT ON THE PAGE");
for (const m of modules.filter((x) => x.config?.on_storefront === false)) {
  console.log(`  ${m.module_key.padEnd(18)} ${m.blocked_reason ?? "—"}`);
}

console.log("\nON THE PAGE BUT NOT CONTROLLED HERE");
for (const m of onPage.filter((x) => !x.rendered)) {
  console.log(`  ${m.module_key.padEnd(18)} needs ${m.blocked_reason ?? "—"}`);
}

console.log("\nCONTROLS FOUND IN THE LIVE HEADER, BY VIEWPORT");
for (const [label, vps] of [...seen.entries()].sort()) {
  console.log(`  ${label.padEnd(26)} ${[...vps].join(", ")}`);
}

// A control on the page that no live module accounts for is the thing worth
// knowing about: it means the header grew something the registry never saw.
const names = new Set(live.map((m) => m.name.toLowerCase()));
const unaccounted = [...seen.keys()].filter(
  (c) => ![...names].some((n) => c.includes(n) || n.includes(c)),
);
console.log("\nCONTROLS NO LIVE MODULE ACCOUNTS FOR");
console.log(unaccounted.length ? unaccounted.map((c) => `  ${c}`).join("\n") : "  none");

if (managerReport) {
  console.log("\nTOP BAR MANAGER, SIGNED IN");
  if (managerReport.error) {
    console.log(`  not checked — ${managerReport.error}`);
  } else {
    console.log(`  screen reached        ${managerReport.reachedManager ? "yes" : "NO"}`);
    console.log(`  header says           ${managerReport.eyebrow ?? "—"}`);
    console.log(`  "Controls the page"   ${managerReport.controlsThePage}`);
    console.log(`  "On the storefront"   ${managerReport.onTheStorefront}`);
    console.log(`  "Not on the page"     ${managerReport.notOnThePage}`);
    console.log(`  Configure buttons     ${managerReport.configureButtons}`);
    console.log(`  Export offered        ${managerReport.hasExport ? "yes" : "no"}`);
    console.log(`  console errors        ${managerReport.consoleErrors}`);
  }
}
