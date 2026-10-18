/** What the influencer application form actually does when it is submitted. */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";
const STAMP = Date.now();

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1400, height: 1100 } })).newPage();
p.on("response", async (r) => {
  if (r.url().includes("rpc/") || r.status() >= 400) {
    let t = "";
    try { t = (await r.text()).slice(0, 220); } catch {}
    console.log(`  ${r.status()} ${r.url().replace(SITE, "").slice(0, 70)} ${t}`);
  }
});
p.on("pageerror", (e) => console.log("  pageerror", String(e).slice(0, 140)));

await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_MARKETPLACE);
await p.fill('input[type="password"]', ops.SV_PW_TEST);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await p.waitForTimeout(2000);
console.log("  signed in, now at", p.url().replace(SITE, ""));

await p.goto(`${SITE}/apply/influencer`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(7000);

const inputs = await p.evaluate(() =>
  [...document.querySelectorAll("input, textarea, select")].map((e) => `${e.tagName}#${e.id || "(no id)"}${e.required ? "*" : ""}`),
);
console.log("  fields:", inputs.join(" "));

const set = async (id, value) => {
  const f = p.locator(`#f_${id}`).first();
  if (await f.count()) {
    await f.fill(value).catch(async () => { await f.selectOption(value).catch(() => {}); });
  } else {
    console.log("  missing field", id);
  }
};
await set("fullName", `E2E Verification ${STAMP}`);
await set("email", `e2e.verify.${STAMP}@softwarevala.test`);
await set("phone", "+910000000000");
await set("country", "India");
await set("city", "Indore");
await set("state", "MP");
await set("followers", "1000");
await set("engagementRate", "2");
await set("niche", "Verification");
await set("rateCard", "n/a - verification run");
await set("instagram", "https://example.com/e2e");
await set("idType", "PAN");
await set("idNumber", "AAAAA0000A");

const boxes = await p.locator('input[type="checkbox"]').count();
for (let i = 0; i < boxes; i += 1) await p.locator('input[type="checkbox"]').nth(i).check().catch(() => {});
console.log("  checkboxes checked:", boxes);

const invalid = await p.evaluate(() =>
  [...document.querySelectorAll("input, textarea, select")].filter((e) => !e.checkValidity()).map((e) => e.id || e.type),
);
console.log("  invalid before submit:", invalid.join(", ") || "none");

await p.locator('button[type="submit"]').first().click({ timeout: 10_000 }).catch((e) => console.log("  click failed", String(e).slice(0, 80)));
await p.waitForTimeout(9000);

const after = await p.evaluate(() => (document.body.innerText || "").replace(/\n+/g, " | ").slice(0, 700));
console.log("  page says:", after);
console.log("  email used:", `e2e.verify.${STAMP}@softwarevala.test`);
await b.close();
