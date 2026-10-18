/**
 * Closes an AI content generation whose worker never came back.
 *
 * One row had been RUNNING since 8 September - twenty days - because the
 * process that opened it died and nothing reopens or times out a generation.
 * It is closed rather than deleted, through the lifecycle the schema already
 * has (mm_ai_generation_finish), so the row keeps its prompt, its context
 * hash, its product and its timings, and gains a recorded cause.
 *
 * mm_ai_generation_finish refuses anyone who is not an operator, so this signs
 * in as one. It only ever touches generations that are RUNNING and older than
 * the age below; anything younger could still be a live worker.
 *
 *   node scripts/ops/ai-generation-recover.mjs [--apply]
 *
 * Without --apply it reports what it would close and changes nothing.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
const APPLY = process.argv.includes("--apply");
const STALE_AFTER_HOURS = 6;

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

const api = (method, path, body) =>
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
      const r = await fetch(`/rest/v1/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: r.status, json, text: text.slice(0, 300) };
    },
    [method, path, body ?? null],
  );

const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000).toISOString();
const stuck = await api(
  "GET",
  `ai_content_generations?select=id,product_id,created_at,provider_slug,model_id,prompt_key&status=eq.RUNNING&created_at=lt.${cutoff}&order=created_at`,
);
const rows = Array.isArray(stuck.json) ? stuck.json : [];
console.log(`RUNNING for more than ${STALE_AFTER_HOURS}h: ${rows.length}`);
for (const r of rows) {
  const age = ((Date.now() - Date.parse(r.created_at)) / 3600_000 / 24).toFixed(1);
  console.log(`  ${r.id}  opened ${String(r.created_at).slice(0, 19)}  (${age} days)  ${r.provider_slug}/${r.model_id}`);
}

if (!APPLY) {
  console.log("\ndry run - nothing changed. Re-run with --apply to close them.");
} else {
  for (const r of rows) {
    const result = await api("POST", "rpc/mm_ai_generation_finish", {
      p_generation: r.id,
      p_status: "FAILED",
      p_error: {
        code: "AI_GENERATION_ABANDONED",
        detail:
          `No worker ever finished this generation. It was opened at ${r.created_at} ` +
          `and was still RUNNING when scripts/ops/ai-generation-recover.mjs closed it. ` +
          `Nothing about the request was lost: the prompt, its version and hash, the ` +
          `context hash, the product and the timings are all still on this row.`,
      },
    });
    // The RPC's envelope is not the evidence; the row is. An earlier version
    // of this script read the envelope and printed REFUSED over a generation
    // it had just closed successfully, which is the kind of report that is
    // worse than no report.
    const after = await api("GET", `ai_content_generations?select=status,error_code,finished_at&id=eq.${r.id}`);
    const row = Array.isArray(after.json) ? after.json[0] : null;
    const closed = row && row.status !== "RUNNING" && row.finished_at;
    if (closed) {
      console.log(`  closed  ${r.id}  -> ${row.status} / ${row.error_code} at ${String(row.finished_at).slice(0, 19)}`);
    } else {
      console.log(`  REFUSED ${r.id}  still ${row?.status ?? "unknown"}  ${result.json?.reason ?? result.text}`);
    }
  }
}

await browser.close();
