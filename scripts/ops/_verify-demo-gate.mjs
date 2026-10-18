/**
 * The demo list is operator-only now. Two things must both be true:
 * an anonymous caller is refused, and Demo Manager still shows its demos.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";
const FN = "e02eb5879448b351cb419ea15b268349f8b99e7bcb14f60544c26b93106d180e";

const b = await chromium.launch();

// 1. Anonymous.
{
  const p = await (await b.newContext()).newPage();
  const anon = await p.evaluate(
    async ([site, fn]) => {
      const r = await fetch(`${site}/_serverFn/${fn}`, { headers: { Origin: site } });
      const t = await r.text();
      return { status: r.status, bytes: t.length, sample: t.slice(0, 120) };
    },
    [SITE, FN],
  ).catch(async () => {
    // A fresh context has no page origin; go to the site first.
    await p.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return p.evaluate(
      async (fn) => {
        const r = await fetch(`/_serverFn/${fn}`);
        const t = await r.text();
        return { status: r.status, bytes: t.length, sample: t.slice(0, 120) };
      },
      FN,
    );
  });
  console.log("  anonymous  ->", JSON.stringify(anon));
  console.log("             leaks a lovable.app address:", /lovable\.app/.test(anon.sample));
  await p.close();
}

// 2. Signed in as an operator.
{
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(4000);
  await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
  await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
  await p.waitForTimeout(2500);

  const asOperator = await p.evaluate(async (fn) => {
    const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
    const r = await fetch(`/_serverFn/${fn}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const t = await r.text();
    return { status: r.status, bytes: t.length, hasPassword: /"password"/.test(t), sample: t.slice(0, 140) };
  }, FN);
  console.log("  operator   ->", JSON.stringify(asOperator));

  // And the screen an operator actually uses.
  await p.goto(`${SITE}/product-demo-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(11_000);
  const screen = await p.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      rows: document.querySelectorAll("tbody tr").length,
      problem: (text.match(/(could not|failed to|needs operator|unauthori[sz]ed)[^\n]{0,60}/i) ?? [])[0] ?? null,
    };
  });
  console.log("  Demo Manager ->", JSON.stringify(screen));
  await p.close();
}

await b.close();
