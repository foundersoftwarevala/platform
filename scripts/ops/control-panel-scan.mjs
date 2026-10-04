/**
 * A forensic pass over every Control Panel module.
 *
 * The list of modules is read from the Control Panel's own source - the
 * sidebar entries and the routes they open - so a module added later is
 * scanned without editing this. For each module, signed in as an operator:
 *
 *   - does it open, and does it stay open (no error screen, no page errors)
 *   - which requests does it make, and which of them fail
 *   - does its data come from the server at all, or is it painted from code
 *   - does its text carry the marks of sample data
 *   - every section in its own navigation, visited the same way
 *   - every button, pressed - with every write request stopped at the network
 *     and recorded instead of sent, so the live database is never changed by
 *     the scan. A button that asks for nothing, opens nothing and changes
 *     nothing is dead; one that changes the screen but asks the server for
 *     nothing while claiming to save is suspect
 *   - on a phone-sized screen, does it scroll sideways
 *   - an automated accessibility check (axe-core, loaded into the page)
 *   - and, signed in as someone without an operator role, is it refused
 *
 *   node scripts/ops/control-panel-scan.mjs [base] [--operator=ADMIN]
 *     [--only=<route,route>] [--workers=3]
 *
 * Writes one line per module to $TEMP/control-panel-scan.jsonl; a run that
 * stops part-way resumes from there. Several modules are scanned at once, each
 * worker in its own signed-in session with its own record of the writes it
 * stopped, so no button is credited with another worker's request.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "")
  .slice(7)
  .split(",")
  .filter(Boolean);
const OPERATOR_ACCOUNT =
  process.argv.find((a) => a.startsWith("--operator="))?.slice("--operator=".length) ??
  "CONTROL_PANEL";
const OPERATOR = {
  email: ops[`SV_LOGIN_${OPERATOR_ACCOUNT}`],
  password:
    ops[`SV_PW_${OPERATOR_ACCOUNT}`] ??
    (OPERATOR_ACCOUNT === "CONTROL_PANEL"
      ? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL
      : undefined),
};
const OUTSIDER = {
  email: ops.SV_LOGIN_AUTHOR,
  password: ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL,
};

/* ------------------------------------------- the modules, from the source */
const sidebar = readFileSync(
  "src/components/super-admin-wireframe/ControlPanelSidebar.tsx",
  "utf8",
);
const panel = readFileSync("src/routes/control-panel.tsx", "utf8");
const entries = [...sidebar.matchAll(/\{\s*id:\s*'([a-z_]+)',\s*label:\s*'([^']+)'/g)].map((m) => ({
  id: m[1],
  label: m[2],
}));
const routeOf = new Map();
for (const m of panel.matchAll(/^\s*([a-z_]+):\s*"(\/[^"]*)",/gm)) routeOf.set(m[1], m[2]);
for (const m of panel.matchAll(
  /if \(roleId === "([a-z_]+)"\) \{\s*void navigate\(\{ to: "([^"]+)" \}\)/g,
))
  routeOf.set(m[1], m[2]);
// Only the ROLE_DASHBOARD_ROUTES block maps an entry to /dashboard/<role>.
const dashboards = panel.slice(
  panel.indexOf("ROLE_DASHBOARD_ROUTES"),
  panel.indexOf("const dashRole"),
);
for (const m of dashboards.matchAll(/^\s*([a-z_]+):\s*"([a-z]+)",\s*$/gm)) {
  if (!routeOf.has(m[1])) routeOf.set(m[1], `/dashboard/${m[2]}`);
}
const notBuilt = new Set(
  [...panel.matchAll(/^\s*([a-z_]+):\s*"[A-Z][^"]*",\s*$/gm)].map((m) => m[1]),
);

const modules = [
  { id: "control_panel", label: "Control Panel (cockpit)", route: "/control-panel" },
];
for (const e of entries) {
  if (notBuilt.has(e.id)) modules.push({ ...e, route: null, notBuilt: true });
  else modules.push({ ...e, route: routeOf.get(e.id) ?? null });
}
const selected = ONLY.length ? modules.filter((m) => m.route && ONLY.includes(m.route)) : modules;

/* -------------------------------------------------------------- the pass */
const SAMPLE =
  /\b(lorem ipsum|john doe|jane doe|acme (corp|inc)|sample data|demo data|dummy|mock data|test user|placeholder data|coming soon|not (yet )?(built|implemented|connected)|todo)\b/i;
const MUTATING =
  /^(save|submit|create|add|new|delete|remove|approve|reject|suspend|send|update|publish|assign|pay|refund|confirm|apply|activate|deactivate|archive|restore|invite|upload|import|generate|run|sync|block|ban|close|resolve|mark)/i;
const NEVER_PRESS = /log ?out|sign ?out/i;

const browser = await chromium.launch();

async function signIn(who, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3500);
    await page.fill('input[type="email"]', who.email);
    await page.fill('input[type="password"]', who.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
      break;
    } catch {
      if (attempt === 1) throw new Error(`could not sign in as ${who.email}`);
    }
  }
  await page.close();
  return context;
}

const OUT = `${process.env.TEMP ?? "."}/control-panel-scan.jsonl`;
const WORKERS = Number(
  (process.argv.find((a) => a.startsWith("--workers=")) ?? "--workers=3").slice(10),
);
// A run that stops part-way is picked up where it stopped.
const done = new Set(
  existsSync(OUT)
    ? readFileSync(OUT, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l).id)
    : [],
);

function watch(page) {
  const seen = { errors: [], console: [], failed: [], calls: new Set() };
  page.on("pageerror", (e) => seen.errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error") seen.console.push(m.text().slice(0, 160));
  });
  page.on("response", (r) => {
    const url = r.url();
    if (!/\/(rest|auth|storage|functions)\/v1\/|\/api\//.test(url)) return;
    const key = `${r.request().method()} ${
      url
        .replace(BASE, "")
        .replace(/^https?:\/\/[^/]+/, "")
        .split("?")[0]
    }`;
    seen.calls.add(key);
    if (r.status() >= 400) seen.failed.push(`${r.status()} ${key}`);
  });
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText ?? "";
    if (!/ERR_ABORTED/.test(f))
      seen.failed.push(`FAILED ${r.url().replace(BASE, "").split("?")[0]} ${f}`);
  });
  page.on("dialog", (d) => d.dismiss().catch(() => undefined));
  return seen;
}

const snapshot = (page) =>
  page.evaluate(() => {
    const text = document.body.innerText || "";
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return {
      url: location.pathname,
      text: text.slice(0, 20000),
      errorScreen:
        /this page didn't load|something went wrong|application error|unexpected error/i.test(text),
      refused:
        /access restricted|not authori[sz]ed|permission denied|you do not have access|sign in to continue|restricted to/i.test(
          text,
        ),
      buttons: [...document.querySelectorAll("button")].filter(visible).length,
      inputs: [...document.querySelectorAll("input,select,textarea")].filter(visible).length,
      tables: document.querySelectorAll("table").length,
      rows: document.querySelectorAll("tbody tr").length,
      dashes: (text.match(/(^|\s)—(\s|$)/g) ?? []).length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      unlabeled: [...document.querySelectorAll("button")].filter(
        (b) =>
          visible(b) &&
          !(b.innerText || "").trim() &&
          !b.getAttribute("aria-label") &&
          !b.getAttribute("title"),
      ).length,
    };
  });

async function sectionsOf(page) {
  // A module's own navigation: links, tabs and nav buttons - never an action.
  // Writes are not blocked while sections are visited, so anything that reads
  // like a command is left for the button pass, where they are.
  return page.evaluate((pattern) => {
    const command = new RegExp(pattern, "i");
    const items = [...document.querySelectorAll("nav a, nav button, aside a, [role=tab]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const t = (el.innerText || "").trim();
        return (
          r.width > 0 &&
          r.height > 0 &&
          t.length > 1 &&
          t.length < 40 &&
          !/log ?out|sign ?out/i.test(t) &&
          !command.test(t)
        );
      })
      .map((el) => (el.innerText || "").trim().split("\n")[0]);
    return [...new Set(items)].slice(0, 60);
  }, MUTATING.source);
}

/** One worker: its own signed-in sessions, its own record of what it stopped. */
async function worker(queue, index) {
  const operator = await signIn(OPERATOR, { width: 1440, height: 900 });
  const outsider = await signIn(OUTSIDER, { width: 1440, height: 900 });
  const state = { blocking: false, blocked: [] };
  await operator.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = request.url();
    const read = method === "GET" || method === "HEAD" || method === "OPTIONS";
    const session = /\/auth\/v1\/(token|user)/.test(url);
    if (state.blocking && !read && !session) {
      state.blocked.push(
        `${method} ${
          url
            .replace(BASE, "")
            .replace(/^https:\/\/softwarevala\.net/, "")
            .split("?")[0]
        }`,
      );
      return route.abort();
    }
    return route.continue();
  });

  async function pressButtons(page, seen, limit = 20) {
    const labels = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          "main button, [role=main] button, section button, table button",
        ),
      ]
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !b.disabled && !b.closest("nav,aside,header");
        })
        .map(
          (b) =>
            (b.innerText || b.getAttribute("aria-label") || b.getAttribute("title") || "")
              .trim()
              .split("\n")[0],
        )
        .filter((t) => t.length > 0 && t.length < 40),
    );
    const unique = [...new Set(labels)].filter((t) => !NEVER_PRESS.test(t)).slice(0, limit);
    const outcome = [];
    const measure = () =>
      page.evaluate(() => ({
        url: location.href,
        dom: document.body.innerHTML.length,
        dialogs: document.querySelectorAll("[role=dialog],[role=alertdialog]").length,
      }));
    for (const label of unique) {
      const before = await measure().catch(() => null);
      if (!before) break;
      const callsBefore = seen.calls.size;
      state.blocked = [];
      state.blocking = true;
      let clicked = true;
      try {
        await page
          .getByRole("button", { name: label, exact: true })
          .first()
          .click({ timeout: 2500 });
      } catch {
        clicked = false;
      }
      await page.waitForTimeout(1300);
      state.blocking = false;
      const after = await measure().catch(() => before);
      const wrote = state.blocked.slice();
      const read = seen.calls.size > callsBefore;
      const opened = after.dialogs > before.dialogs;
      const moved = after.url !== before.url;
      const changed = Math.abs(after.dom - before.dom) > 40;
      let verdict = "RESPONDS";
      if (!clicked) verdict = "NOT-CLICKABLE";
      else if (wrote.length) verdict = "WIRED";
      else if (moved) verdict = "NAVIGATES";
      else if (opened) verdict = "OPENS-DIALOG";
      else if (read) verdict = "READS";
      else if (!changed) verdict = "DEAD";
      else if (MUTATING.test(label)) verdict = "UI-ONLY?";
      outcome.push({ label, verdict, wrote: wrote.slice(0, 3) });
      if (opened) await page.keyboard.press("Escape").catch(() => undefined);
      if (moved) {
        await page.goBack({ timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(1200);
      }
    }
    return outcome;
  }

  while (queue.length) {
    const mod = queue.shift();
    const started = Date.now();
    let entry;
    try {
      const page = await operator.newPage();
      const seen = watch(page);
      let status = 0;
      try {
        const response = await page.goto(`${BASE}${mod.route}`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        status = response?.status() ?? 0;
      } catch {
        status = -1;
      }
      await page.waitForTimeout(8000);
      const landing = await snapshot(page);
      // The cockpit's own navigation is the Control Panel sidebar - every other
      // module, each scanned in its own right - so it is not walked from here.
      const sections = mod.id === "control_panel" ? [] : await sectionsOf(page);
      const visited = [];
      for (const name of sections.slice(0, 25)) {
        const target = page.getByText(name, { exact: true }).first();
        if (!(await target.count())) continue;
        const errorsBefore = seen.errors.length;
        const failedBefore = seen.failed.length;
        try {
          await target.click({ timeout: 2500 });
        } catch {
          visited.push({ name, verdict: "NOT-CLICKABLE" });
          continue;
        }
        await page.waitForTimeout(2500);
        const s = await snapshot(page).catch(() => null);
        if (!s) continue;
        visited.push({
          name,
          url: s.url,
          errorScreen: s.errorScreen,
          newErrors: seen.errors.slice(errorsBefore),
          newFailed: seen.failed.slice(failedBefore),
          sample: (s.text.match(SAMPLE) ?? [null])[0],
          rows: s.rows,
          dashes: s.dashes,
        });
        if (!s.url.startsWith(mod.route.split("?")[0]) && s.url !== landing.url) {
          await page
            .goto(`${BASE}${mod.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
            .catch(() => undefined);
          await page.waitForTimeout(4000);
        }
      }
      await page
        .goto(`${BASE}${mod.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
        .catch(() => undefined);
      await page.waitForTimeout(6000);
      const buttons = await pressButtons(page, seen);

      let axe = null;
      try {
        await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js" });
        axe = await page.evaluate(async () => {
          const r = await window.axe.run(document, { resultTypes: ["violations"] });
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        });
      } catch {
        axe = null;
      }
      await page.close();

      const phone = await operator.newPage();
      await phone.setViewportSize({ width: 390, height: 844 });
      await phone
        .goto(`${BASE}${mod.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
        .catch(() => undefined);
      await phone.waitForTimeout(6000);
      const small = await snapshot(phone).catch(() => ({ overflow: null }));
      await phone.close();

      const denied = await outsider.newPage();
      await denied
        .goto(`${BASE}${mod.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
        .catch(() => undefined);
      await denied.waitForTimeout(6000);
      const asOutsider = await snapshot(denied).catch(() => ({ refused: false, url: "?" }));
      await denied.close();

      entry = {
        ...mod,
        status,
        finalUrl: landing.url,
        errorScreen: landing.errorScreen,
        pageErrors: [...new Set(seen.errors)].slice(0, 8),
        consoleErrors: [...new Set(seen.console)].slice(0, 8),
        failed: [...new Set(seen.failed)].slice(0, 15),
        calls: [...seen.calls].slice(0, 60),
        dataCalls: [...seen.calls].filter((c) => /\/rest\/v1\/|\/api\//.test(c)).length,
        sample: (landing.text.match(SAMPLE) ?? [null])[0],
        dashes: landing.dashes,
        tables: landing.tables,
        rows: landing.rows,
        buttons: landing.buttons,
        inputs: landing.inputs,
        unlabeledButtons: landing.unlabeled,
        sections: visited,
        pressed: buttons,
        axe,
        phoneOverflow: small.overflow,
        outsiderRefused: asOutsider.refused || /\/login/.test(asOutsider.url),
        outsiderUrl: asOutsider.url,
        seconds: Math.round((Date.now() - started) / 1000),
      };
    } catch (error) {
      entry = { ...mod, scanError: String(error?.message ?? error).slice(0, 300) };
    }
    appendFileSync(OUT, `${JSON.stringify(entry)}\n`);
    const dead = (entry.pressed ?? []).filter((b) => b.verdict === "DEAD").length;
    const uiOnly = (entry.pressed ?? []).filter((b) => b.verdict === "UI-ONLY?").length;
    const serious = (entry.axe ?? []).filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ).length;
    console.log(
      `  [w${index}] ${String(mod.label).padEnd(26)} ` +
        (entry.scanError
          ? `SCAN ERROR ${entry.scanError}`
          : `http=${entry.status} ${entry.errorScreen ? "ERROR-SCREEN " : ""}errs=${entry.pageErrors.length} failed=${entry.failed.length} ` +
            `data=${entry.dataCalls} sections=${entry.sections.length} buttons=${entry.pressed.length} dead=${dead} ui-only?=${uiOnly} ` +
            `axe=${serious} phone-overflow=${entry.phoneOverflow} outsider-refused=${entry.outsiderRefused} ${entry.seconds}s`),
    );
  }
  await operator.close();
  await outsider.close();
}

const pending = [];
for (const mod of selected) {
  if (done.has(mod.id)) continue;
  if (!mod.route) {
    appendFileSync(
      OUT,
      `${JSON.stringify({ ...mod, verdict: mod.notBuilt ? "MISSING (named as not built)" : "MISSING (no route wired)" })}\n`,
    );
    console.log(`  ${mod.label.padEnd(28)} ${mod.notBuilt ? "not built" : "no route"}`);
    continue;
  }
  pending.push(mod);
}
console.log(`  ${pending.length} modules to scan, ${done.size} already done, ${WORKERS} at a time`);
await Promise.all(
  Array.from({ length: Math.min(WORKERS, pending.length) }, (_, i) => worker(pending, i + 1)),
);
await browser.close();
console.log(`\n  results -> ${OUT}`);
