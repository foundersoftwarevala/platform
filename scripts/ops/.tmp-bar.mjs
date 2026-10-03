import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const ops = {}; for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = "http://127.0.0.1:3203";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
await p.goto(`${BASE}/login`); await p.waitForTimeout(2500);
await p.fill('input[type="email"]', ops.SV_LOGIN_AUTHOR); await p.fill('input[type="password"]', ops.SV_PW_AUTHOR ?? ops.SV_PW_TEST); await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await p.goto(`${BASE}/dashboard/author`); await p.waitForTimeout(6000);
const r = await p.evaluate(() => { const h = document.querySelector("header"); const hb = h.getBoundingClientRect();
  const kids = [...h.querySelectorAll(":scope > *, :scope > .contents > *")].map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName}${e.getAttribute("data-chat-app-button") !== null ? "[chat]" : ""}${e.querySelector?.("input[type=search]") ? "[search]" : ""} x=${Math.round(r.x)} w=${Math.round(r.width)}`; });
  const chat = document.querySelector("[data-chat-app-button]").getBoundingClientRect(); const top = document.elementFromPoint(chat.x + chat.width / 2, chat.y + chat.height / 2);
  return { header: `x=${hb.x} w=${hb.width} scrollW=${h.scrollWidth}`, chat: `x=${Math.round(chat.x)} w=${Math.round(chat.width)}`, topAtChat: top.tagName + " " + (top.getAttribute("type") ?? ""), kids }; });
console.log(JSON.stringify(r, null, 1)); await b.close();
