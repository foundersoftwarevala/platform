/**
 * The recognition presentation layer, in a browser, with no database writes.
 *
 *   node scripts/ops/ams-recognition-ui-verify.mjs [base]
 *
 * Real recognitions and showcase previews go through the one CelebrationProvider
 * queue and the one Overlay, so the presentation guarantees are checked here
 * with the showcase's "Preview unlock" (which grants nothing):
 *   - one presentation at a time; rapid clicks queue rather than overlap;
 *   - sound only when a presentation begins, never while it waits in the queue;
 *   - mute is silence, and volume scales what is actually heard (measured at
 *     the output with an analyser, not inferred from settings);
 *   - reduced motion keeps the recognition and drops the particles;
 *   - keyboard: focus lands on Close, Escape dismisses; tap anywhere dismisses;
 *   - phone width: the card fits, nothing scrolls sideways;
 * and on the role dashboard, the fake paths are gone: no "Mark Complete", no
 * "Verify Identity", no local reward claim, no random XP from the logo.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(74)} ${detail}`);
};

// Taps the page's audio graph: every oscillator/buffer start is timed, and the
// signal reaching the speakers passes an analyser whose peak is sampled.
const AUDIO_PROBE = () => {
  const sv = (window.__sv = { starts: [], peak: 0, overlays: [], maxOverlays: 0 });
  for (const Node of [OscillatorNode, AudioBufferSourceNode]) {
    const start = Node.prototype.start;
    Node.prototype.start = function (...a) {
      sv.starts.push(performance.now());
      return start.apply(this, a);
    };
  }
  const connect = AudioNode.prototype.connect;
  const taps = new WeakMap();
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) {
      const ctx = dest.context;
      let an = taps.get(ctx);
      if (!an) {
        an = ctx.createAnalyser();
        an.fftSize = 2048;
        connect.call(an, dest);
        taps.set(ctx, an);
        const buf = new Float32Array(an.fftSize);
        const sample = () => {
          an.getFloatTimeDomainData(buf);
          for (const v of buf) if (Math.abs(v) > sv.peak) sv.peak = Math.abs(v);
          setTimeout(sample, 20);
        };
        sample();
      }
      return connect.call(this, an, ...rest);
    }
    return connect.call(this, dest, ...rest);
  };
  // Init scripts run before <html> exists; observe once there is a document.
  const watch = () =>
    new MutationObserver(() => {
    const n = document.querySelectorAll("[data-recognition-overlay]").length;
    sv.maxOverlays = Math.max(sv.maxOverlays, n);
    const last = sv.overlays[sv.overlays.length - 1];
    if (n > 0 && (!last || last.end)) sv.overlays.push({ at: performance.now() });
    if (n === 0 && last && !last.end) last.end = performance.now();
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) watch();
  else document.addEventListener("readystatechange", watch, { once: true });
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

async function signIn(login, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  await context.addInitScript(AUDIO_PROBE);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]);
  await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  return { context, page, errors };
}

const setPrefs = (page, prefs) =>
  page.evaluate((p) => localStorage.setItem("ams.sound.prefs", JSON.stringify(p)), prefs);
const probe = (page) => page.evaluate(() => ({ ...window.__sv, now: performance.now() }));
const resetProbe = (page) => page.evaluate(() => {
  window.__sv.starts = []; window.__sv.peak = 0; window.__sv.overlays = []; window.__sv.maxOverlays = 0;
});
async function openShowcase(page) {
  await page.goto(`${BASE}/ams/developer-progression`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Preview unlock/ }).first().waitFor({ timeout: 30_000 });
}
async function previewAndMeasure(page) {
  await resetProbe(page);
  await page.getByRole("button", { name: /Preview unlock/ }).first().click();
  await page.waitForTimeout(2500);
  const p = await probe(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  return p;
}

/* ------------------------------------------------ presentation, desktop */
const dev = await signIn("DEVELOPER");
await setPrefs(dev.page, { enabled: true, volume: 1, celebrations: true });
await openShowcase(dev.page);

const loud = await previewAndMeasure(dev.page);
check("a preview unlock presents once, with sound", loud.overlays.length === 1 && loud.starts.length > 0, `overlays=${loud.overlays.length} starts=${loud.starts.length}`);
check("the sound is heard at the output", loud.peak > 0.001, `peak=${loud.peak.toFixed(4)}`);

await setPrefs(dev.page, { enabled: true, volume: 0.1, celebrations: true });
await openShowcase(dev.page);
const quiet = await previewAndMeasure(dev.page);
const ratio = quiet.peak / Math.max(loud.peak, 1e-9);
check("volume 10% is about a tenth as loud as 100%", ratio > 0.05 && ratio < 0.2, `ratio=${ratio.toFixed(3)}`);

await setPrefs(dev.page, { enabled: false, volume: 1, celebrations: true });
await openShowcase(dev.page);
const muted = await previewAndMeasure(dev.page);
check("muted: the presentation still shows", muted.overlays.length === 1);
check("muted: nothing is scheduled and nothing is heard", muted.starts.length === 0 && muted.peak === 0, `starts=${muted.starts.length} peak=${muted.peak}`);

// Rapid presentations queue: one on screen at a time, sound only as each begins.
await setPrefs(dev.page, { enabled: true, volume: 1, celebrations: true });
await openShowcase(dev.page);
await resetProbe(dev.page);
const buttons = dev.page.getByRole("button", { name: /Preview unlock/ });
await buttons.nth(0).click();
// The page underneath is covered now; the next two arrive as clicks would.
await buttons.nth(0).evaluate((b) => b.click()).catch(() => undefined);
await buttons.nth(1).evaluate((b) => b.click()).catch(() => undefined);
const skip = await dev.page.getByRole("button", { name: /Skip \d+ more/ }).first().innerText().catch(() => "");
check("presentations waiting behind the current one are offered as Skip N", /Skip [12] more/.test(skip), skip);
await dev.page.waitForTimeout(22_000);
const rapid = await probe(dev.page);
check("never more than one presentation on screen", rapid.maxOverlays === 1, `max=${rapid.maxOverlays}`);
check("every queued presentation was shown in turn", rapid.overlays.length === 3, `shown=${rapid.overlays.length}`);
const outside = rapid.starts.filter((t) => !rapid.overlays.some((o) => t >= o.at - 50 && t <= o.at + 2500));
check("no sound while waiting: every sound starts with its presentation", outside.length === 0, `stray=${outside.length}/${rapid.starts.length}`);

// Keyboard and pointer.
await resetProbe(dev.page);
await buttons.nth(0).click();
await dev.page.waitForTimeout(800);
const focused = await dev.page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
check("focus moves to Close when a presentation opens", focused === "Close", String(focused));
const dialog = await dev.page.locator('[role="dialog"][aria-modal="true"]').count();
check("the presentation is an accessible modal dialog", dialog === 1);
await dev.page.keyboard.press("Escape");
await dev.page.waitForTimeout(600);
check("Escape dismisses it", (await dev.page.locator("[data-recognition-overlay]").count()) === 0);
await dev.page.waitForTimeout(900);
await buttons.nth(0).click();
await dev.page.waitForTimeout(800);
await dev.page.mouse.click(20, 20);
await dev.page.waitForTimeout(600);
check("a tap anywhere dismisses it", (await dev.page.locator("[data-recognition-overlay]").count()) === 0);
check("no page error on the showcase", dev.errors.length === 0, dev.errors.slice(0, 2).join(" | "));
await dev.context.close();

/* ------------------------------------------------ reduced motion, phone */
const phone = await signIn("DEVELOPER", {
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
});
await setPrefs(phone.page, { enabled: true, volume: 1, celebrations: true });
await openShowcase(phone.page);
await phone.page.getByRole("button", { name: /Preview unlock/ }).first().tap();
await phone.page.waitForTimeout(900);
const overlay = phone.page.locator("[data-recognition-overlay]").first();
check("reduced motion: the recognition still shows", (await overlay.count()) === 1);
check("reduced motion: no particle canvas", (await phone.page.locator("[data-recognition-overlay] canvas").count()) === 0);
const fit = await phone.page.evaluate(() => {
  const card = document.querySelector("[data-recognition-overlay] h2")?.closest(".rounded-2xl");
  const r = card?.getBoundingClientRect();
  return { left: r?.left ?? -1, right: r?.right ?? 9999, top: r?.top ?? -1, vw: innerWidth, scroll: document.documentElement.scrollWidth };
});
check("phone: the card fits the screen width", fit.left >= 0 && fit.right <= fit.vw, JSON.stringify(fit));
check("phone: nothing scrolls sideways", fit.scroll <= fit.vw, `scrollWidth=${fit.scroll}`);
await phone.page.getByRole("button", { name: "Close" }).tap();
await phone.page.waitForTimeout(600);
check("phone: Close is tappable and dismisses", (await phone.page.locator("[data-recognition-overlay]").count()) === 0);
await phone.context.close();

/* ------------------------------------------------ the role dashboard */
const reseller = await signIn("RESELLER");
await reseller.page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
await reseller.page.waitForTimeout(6000);
await resetProbe(reseller.page);
const logo = reseller.page.getByRole("button", { name: "Software Vala" }).first();
if (await logo.count()) {
  await logo.click();
  await reseller.page.waitForTimeout(700);
  const txt = await reseller.page.locator("body").innerText();
  check("the logo shows no invented XP or achievement", !/\+\d+ XP ·|bonus XP|Daily Reward/.test(txt));
} else {
  check("the logo button is present", false, "not found");
}
await reseller.page.getByRole("button", { name: /Open AMS/ }).first().click();
await reseller.page.waitForTimeout(4000);
const module = reseller.page.locator("[data-ams-role]").first();
const nav = (name) => module.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
check("the module offers the sound and motion settings", (await reseller.page.getByRole("button", { name: /Interface sound settings/ }).count()) > 0);
if (await nav("Missions").isEnabled().catch(() => false)) {
  await nav("Missions").click();
  await reseller.page.waitForTimeout(800);
  check("missions cannot be marked complete for XP", (await module.getByRole("button", { name: /Mark Complete/ }).count()) === 0);
}
await nav("Identity").click();
await reseller.page.waitForTimeout(800);
const identity = (await module.innerText()).replace(/\s+/g, " ");
check("identity cannot be self-verified", (await module.getByRole("button", { name: /Verify Identity/ }).count()) === 0);
check("trust and reputation are not invented", /Trust Score Not tracked yet/i.test(identity) && /Reputation Not tracked yet/i.test(identity), identity.slice(0, 120));
const header = (await module.innerText()).replace(/\s+/g, " ");
check("the header shows no trust or reputation figure", !/Trust \d|Reputation \d/.test(header));
check("no page error on the reseller dashboard", reseller.errors.length === 0, reseller.errors.slice(0, 2).join(" | "));
await reseller.context.close();

await browser.close();
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
