import { chromium } from "@playwright/test";
const cases = [
  ["/", "हिन्दी", /[\u0900-\u097F]/g, "hi", "ltr"],
  ["/marketplace", "العربية", /[\u0600-\u06FF]/g, "ar", "rtl"],
];
const b = await chromium.launch();
let failures = 0;
for (const [path, label, script, code, dir] of cases) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 80)));
  await p.goto("https://softwarevala.net" + path, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(9000);
  await p.locator("[data-language-selector]").evaluate((button) => button.click());
  await p.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await p.locator(`[role="option"][data-code="${code}"]`).click({ force: true, timeout: 10000 });
  await p.waitForTimeout(8000);
  const t1 = await p.evaluate(() => ({
    txt: document.body.innerText,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(9000);
  const t2 = await p.evaluate(() => ({
    txt: document.body.innerText,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
  const pc = (t) => (((t.match(script) || []).length / Math.max(1, t.length)) * 100).toFixed(1);
  const switched = t1.lang === code && t1.dir === dir;
  const persisted = t2.lang === code;
  const clean = errs.length === 0;
  console.log(`${path} -> ${label}`);
  console.log(
    `   switch:  lang=${t1.lang} dir=${t1.dir}  target-script ${pc(t1.txt)}%   expected ${code}/${dir}  ${switched ? "PASS" : "FAIL"}`,
  );
  console.log(
    `   reload:  lang=${t2.lang} dir=${t2.dir}  target-script ${pc(t2.txt)}%   persisted ${persisted ? "PASS" : "FAIL"}   pageerrors ${errs.length}`,
  );
  if (!switched || !persisted || !clean) failures += 1;
  await c.close();
}
await b.close();
if (failures) process.exitCode = 1;
