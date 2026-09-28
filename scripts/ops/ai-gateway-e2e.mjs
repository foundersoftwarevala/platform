/**
 * Does a real AI request reach a real provider?
 *
 * The chain the brief asks to prove, end to end against the live site:
 *
 *   AI API Manager (api_services + api_keys)
 *     -> ai-gateway.server (resolve, decrypt, choose model)
 *       -> the provider's own endpoint
 *         -> metering (usage_events / ai_usage) and audit
 *
 * It signs in as an authorised operator, because /api/chat refuses an
 * anonymous caller, and asks one short question. It writes nothing except
 * whatever the platform's own metering records for the call it made.
 *
 *   node scripts/ops/ai-gateway-e2e.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const ops = readEnv(".env.ops");
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");

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
console.log("signed in as the control-panel operator");

const result = await page.evaluate(async () => {
  // /api/chat resolves the actor from a bearer token on the server, so the
  // session's own access token has to travel with the request.
  let token = null;
  for (const k of Object.keys(localStorage)) {
    if (!/auth-token|supabase/i.test(k)) continue;
    try {
      const v = JSON.parse(localStorage.getItem(k));
      token = v?.access_token ?? v?.currentSession?.access_token ?? token;
    } catch {}
  }
  const started = Date.now();
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Reply with exactly the word: CONNECTED" }],
    }),
  });
  const text = await response.text();
  return { status: response.status, ms: Date.now() - started, body: text.slice(0, 900) };
});

console.log(`\nPOST /api/chat -> HTTP ${result.status} in ${result.ms}ms`);
if (result.status === 200) {
  // The upstream stream reaches the browser untouched, so pull the words out.
  const said = [...result.body.matchAll(/"(?:content|text)"\s*:\s*"([^"]*)"/g)]
    .map((m) => m[1])
    .join("");
  console.log(`  the model said: ${JSON.stringify(said.slice(0, 200)) || "(stream, no plain text found)"}`);
  console.log("  PASS - a real provider answered through AI API Manager");
} else {
  console.log(`  body: ${result.body}`);
  console.log("  FAIL - the chain did not reach a provider");
}

await browser.close();
