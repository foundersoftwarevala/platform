/**
 * The Demo Manager flow, end to end, as an operator walks it.
 *
 *   a product to attach the demo to
 *     -> intake      the address is taken in, not yet scanned
 *       -> investigate  fetched, the AI names the software and its category and
 *                       finds the developer's own branding and links
 *         -> activate   fetched again, the presentation applied, and checked
 *                       clean before the demo may go live
 *           -> the card  what marketplace_products.demo_url and the LIVE DEMO
 *                        badge read
 *
 * Give it a URL and it walks the whole chain on that URL:
 *
 *   node scripts/ops/demo-flow-e2e.mjs https://the-demo.example.com/
 *
 * With no URL it checks only the parts that cost nothing - that the endpoint is
 * reachable, the guard admits an operator, products can be searched and the
 * processed list reads - so the machinery can be proven ready before anybody's
 * real demo address is spent on it.
 *
 * It creates nothing permanent unless a URL is given, and it says at the end
 * what it left behind so it can be undone.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
const TARGET = process.argv[2] ?? null;

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(46)} ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2500);
step("an operator can sign in", true, ops.SV_LOGIN_CONTROL_PANEL);

/** Calls the demo endpoint with the operator's own token. */
const call = (method, path, body) =>
  page.evaluate(
    async ([method, path, body]) => {
      let token = null;
      for (const k of Object.keys(localStorage)) {
        if (!/auth-token|supabase/i.test(k)) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k));
          token = v?.access_token ?? v?.currentSession?.access_token ?? token;
        } catch {}
      }
      const r = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return { status: r.status, json, text: text.slice(0, 400) };
    },
    [method, path, body ?? null],
  );

// ---- the machinery, before anyone's real URL is spent on it --------------
const list = await call("GET", "/api/demo/process");
step(
  "the endpoint admits an operator",
  list.status === 200,
  list.status === 200 ? `${(list.json?.demos ?? []).length} demo(s) processed so far` : `HTTP ${list.status} ${list.text}`,
);

const found = await call("GET", "/api/demo/process?products=school");
const products = found.json?.products ?? [];
step("products can be searched to attach a demo to", found.status === 200 && products.length > 0, `${products.length} match(es)`);

const guard = await page.evaluate(async () => {
  const r = await fetch("/api/demo/process", { headers: { "Content-Type": "application/json" } });
  return r.status;
});
step("an unauthenticated caller is refused", guard === 401 || guard === 403, `HTTP ${guard}`);

if (!TARGET) {
  console.log("\nNo URL given, so nothing was submitted. The machinery above is what has to work");
  console.log("before a real demo address is worth spending; pass one to walk the whole chain:");
  console.log("  node scripts/ops/demo-flow-e2e.mjs https://the-demo.example.com/");
} else {
  const product = products[0];
  step("a product is chosen for the demo", Boolean(product?.id), product?.name ?? product?.slug ?? "none");

  if (product?.id) {
    const investigated = await call("POST", "/api/demo/process", {
      action: "investigate",
      productId: product.id,
      url: TARGET,
    });
    const row = investigated.json?.demo ?? investigated.json?.row ?? investigated.json;
    step(
      "investigate reached the address and the AI answered",
      investigated.status === 200,
      investigated.status === 200 ? "" : `HTTP ${investigated.status} ${investigated.text}`,
    );

    const processing = row?.processing ?? null;
    step(
      "the AI went through AI API Manager",
      Boolean(processing?.ai?.service),
      processing?.ai?.service ? `${processing.ai.service}${processing.ai.model ? ` / ${processing.ai.model}` : ""}` : "no ai block recorded",
    );
    step(
      "it named the software and a category it could check",
      Boolean(processing?.identity?.software_name && processing?.identity?.category_name),
      processing?.identity
        ? `${processing.identity.software_name} → ${processing.identity.category_name} (confidence ${processing.identity.confidence})`
        : "no identity recorded",
    );
    step(
      "it found the developer's own branding and links to deal with",
      Array.isArray(processing?.findings?.developer_links),
      `${(processing?.findings?.developer_links ?? []).length} developer link(s), ${(processing?.findings?.logos ?? []).length} logo(s)`,
    );
    step(
      "the address answered and was measured",
      processing?.source?.http_status === 200,
      `http ${processing?.source?.http_status} final ${String(processing?.source?.final_url ?? "").slice(0, 60)}`,
    );

    const id = row?.id ?? null;
    if (id) {
      const activated = await call("POST", "/api/demo/process", { action: "activate", id });
      const after = activated.json?.demo ?? activated.json?.row ?? activated.json;
      step(
        "activate checked it clean and set it live",
        activated.status === 200 && (after?.status === "active" || after?.processing_status === "live"),
        activated.status === 200
          ? `status ${after?.status} / ${after?.processing_status}`
          : `HTTP ${activated.status} ${activated.text}`,
      );
      console.log(`\nLeft behind: demo row ${id} on product ${product.name ?? product.id}.`);
      console.log("Remove it from Demo Manager if this was only a test.");
    }
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
