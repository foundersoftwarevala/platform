import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
function readEnv(f){const o={};for(const l of readFileSync(f,"utf8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)o[m[1]]=m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");}return o;}
const ops = readEnv(".env.ops");
const role = process.argv[2], path = process.argv[3];
const site = "https://softwarevala.net";
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();
await p.goto(site+"/login",{waitUntil:"networkidle",timeout:90000});
await p.locator('input[type="email"]').fill(ops["SV_LOGIN_"+role]);
await p.locator('input[type="password"]').fill(ops["SV_PW_"+role] ?? ops.SV_PW_TEST);
await p.locator('button[type="submit"]').click();
await p.waitForTimeout(8000);
await p.goto(site+path,{waitUntil:"domcontentloaded",timeout:90000});
await p.waitForTimeout(6000);
const out = await p.evaluate(() => {
  const hits = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = (n.textContent ?? "").trim();
    if (!t) continue;
    if (/[★☆✪-❉☀-⛿✀-➿◆◈✦✧⭐™®✹✻✽]/.test(t)) {
      const el = n.parentElement;
      hits.push({ text: t.slice(0,80), tag: el?.tagName, cls: (el?.className??"").toString().slice(0,50) });
    }
  }
  return { hits, title: document.title };
});
console.log(path, "|", out.title);
console.log("text nodes carrying a star/symbol:", out.hits.length);
for (const h of out.hits) console.log(`  <${h.tag}> "${h.text}"  class="${h.cls}"`);
await b.close();
