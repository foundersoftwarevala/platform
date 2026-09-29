/**
 * What the Demo Studio screens now consume, asked as an operator from inside a
 * real session - the `demos` and `demo_audit` resources, which read the VPS.
 *
 * Hosted holds one product_demo_urls row; the VPS holds seventeen. A total of
 * 17 here is proof the screens are on the right database.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await p.waitForTimeout(2000);

const asked = [
  ["demos", ""],
  ["demos", "&filter=status.eq.active"],
  ["products", ""],
  ["products", "&filter=visible.eq.true"],
  ["demo_audit", ""],
  ["demo_audit", "&filter=action.eq.demo_url.test"],
];

for (const [resource, extra] of asked) {
  const out = await p.evaluate(
    async ([r, e]) => {
      const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
      const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
      const res = await fetch(`/api/manager/resource?resource=${r}&limit=1${e}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      return { status: res.status, total: body.total ?? null, error: body.error ?? null };
    },
    [resource, extra],
  );
  console.log(`  ${(resource + extra).padEnd(42)} http=${out.status} total=${out.total}${out.error ? ` «${out.error}»` : ""}`);
}
await b.close();
