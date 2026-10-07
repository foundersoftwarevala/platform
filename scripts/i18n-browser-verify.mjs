import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(resolve("src/lib/i18n/registry.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { SUPPORTED_LANGUAGES } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const base = "https://softwarevala.net";
const out = process.argv.find((arg) => arg.startsWith("--out="))?.slice(6);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const report = { at: new Date().toISOString(), anonymous: true, languages: [], errors: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator("[data-language-selector]:visible").first().waitFor({ timeout: 60000 });
  for (const language of SUPPORTED_LANGUAGES) {
    const record = { code: language.code, direction: language.direction, failures: [] };
    try {
      await page.locator("[data-language-selector]:visible").first().click();
      await page.locator(`[role=option][data-code="${language.code}"]`).first().click();
      await page.waitForFunction((code) => document.documentElement.lang === code, language.code);
      await page.waitForTimeout(1000);
      record.selected = await page.locator("html").getAttribute("lang");
      record.actualDirection = await page.locator("html").getAttribute("dir");
      record.progress = await page.locator("html").getAttribute("data-translation-status");
      record.fallback = Number(
        await page.locator("html").getAttribute("data-translation-fallback"),
      );
      record.pending = Number(await page.locator("html").getAttribute("data-translation-pending"));
      const response = await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-language-selector]:visible").first().waitFor({ timeout: 60000 });
      await page.waitForFunction((code) => document.documentElement.lang === code, language.code);
      await page.locator("main").first().waitFor({ state: "visible", timeout: 60000 });
      record.reloadStatus = response.status();
      const serverHtml = await response.text();
      record.serverLocale = serverHtml.match(/<html[^>]*lang="([^"]+)"/)?.[1] ?? null;
      record.serverDirection = serverHtml.match(/<html[^>]*dir="([^"]+)"/)?.[1] ?? null;
      await page.evaluate(() => document.fonts.ready);
      record.layout = await page.evaluate(() => ({
        fontStatus: document.fonts.status,
        fontFamily: getComputedStyle(document.body).fontFamily,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      }));
      record.reload = await page.locator("html").getAttribute("lang");
      record.mainVisible = await page.locator("main").first().isVisible();
      if (record.actualDirection !== language.direction) record.failures.push("direction_mismatch");
      if (record.reload !== language.code) record.failures.push("preference_not_restored");
      if (record.serverLocale !== language.code || record.serverDirection !== language.direction)
        record.failures.push("server_locale_mismatch");
      if (record.layout.horizontalOverflow > 1) record.failures.push("horizontal_overflow");
      if (record.reloadStatus !== 200 || !record.mainVisible)
        record.failures.push("page_unavailable");
    } catch (error) {
      record.failures.push(error.message);
    }
    report.languages.push(record);
    if (out) writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ code: record.code, failures: record.failures }));
  }
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));
  if (report.languages.some((record) => record.failures.length) || report.errors.length)
    process.exitCode = 1;
} finally {
  await browser.close();
}
