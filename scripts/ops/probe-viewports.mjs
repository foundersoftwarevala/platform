/**
 * How the page actually behaves at each width a real machine has.
 *
 * "It does not fit on a large laptop" is a symptom with several possible
 * causes, and guessing between them by changing font sizes is how a layout
 * gets worse. This measures the things that decide it, at each width, and
 * names the widest element when the page scrolls sideways — which is the
 * answer nearly every time.
 *
 * Reported per viewport:
 *
 *   scrollW / innerW   a horizontal scrollbar exists when these differ
 *   widest             the element responsible, by selector and width
 *   content            how wide the main content actually is, against the
 *                      window — a page that uses 1180px of a 1600px screen is
 *                      not broken, it is ignoring the screen
 *   overlaps           top-bar controls whose boxes intersect, which is what
 *                      "buttons are mixing" looks like in the DOM
 *
 * It changes nothing.
 *
 *   node scripts/ops/probe-viewports.mjs [path]
 */
import { chromium } from "@playwright/test";

const SITE = (process.env.SV_SITE || "https://softwarevala.net").replace(/\/+$/, "");
const PATHNAME = process.argv[2] || "/";

const DESKTOP = [1280, 1366, 1440, 1536, 1600, 1920];
const MOBILE = [320, 360, 375, 390, 414, 430];

const browser = await chromium.launch();

function describe(el) {
  return el;
}

async function measure(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width < 500,
    hasTouch: width < 500,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  await page.goto(`${SITE}${PATHNAME}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4500);

  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const innerW = window.innerWidth;
    const scrollW = Math.max(doc.scrollWidth, document.body.scrollWidth);

    // The widest element that actually sticks out past the viewport.
    let widest = null;
    if (scrollW > innerW + 1) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const right = r.right;
        if (right <= innerW + 1) continue;
        if (!widest || right > widest.right) {
          const cls = String(el.className ?? "").split(" ").slice(0, 3).join(".");
          widest = {
            right: Math.round(right),
            width: Math.round(r.width),
            tag: el.tagName.toLowerCase(),
            cls: cls.slice(0, 60),
          };
        }
      }
    }

    // How much of the window the content uses. The first element under body
    // that carries real width is a fair stand-in for the page container.
    let content = null;
    const main = document.querySelector("main") ?? document.body.firstElementChild;
    if (main) {
      const r = main.getBoundingClientRect();
      content = { width: Math.round(r.width), left: Math.round(r.left) };
    }

    // Widest max-width actually applied to a container that holds the page.
    const caps = new Set();
    for (const el of document.querySelectorAll("body > *, main, main > *, header, nav")) {
      const mw = getComputedStyle(el).maxWidth;
      if (mw && mw !== "none") caps.add(mw);
    }

    // Top-bar controls that overlap one another.
    const bar =
      document.querySelector("header") ??
      document.querySelector("nav") ??
      document.body;
    const controls = [...bar.querySelectorAll("button, a")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && r.top < 200);
    const overlaps = [];
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i].r;
        const b = controls[j].r;
        if (controls[i].el.contains(controls[j].el) || controls[j].el.contains(controls[i].el)) continue;
        const hit =
          a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        if (hit) {
          overlaps.push(
            `${(controls[i].el.textContent ?? "").trim().slice(0, 14)} × ${(controls[j].el.textContent ?? "").trim().slice(0, 14)}`,
          );
        }
      }
    }

    return {
      innerW,
      scrollW,
      widest,
      content,
      caps: [...caps].slice(0, 6),
      controls: controls.length,
      overlaps: [...new Set(overlaps)].slice(0, 6),
    };
  });

  await context.close();
  return { width, ...result, errors };
}

console.log(`${SITE}${PATHNAME}\n`);

for (const group of [["DESKTOP", DESKTOP], ["MOBILE", MOBILE]]) {
  const [name, widths] = group;
  console.log(name);
  for (const w of widths) {
    const r = await measure(w, w < 500 ? 780 : 900);
    const sideways = r.scrollW > r.innerW + 1;
    const used = r.content ? Math.round((r.content.width / r.innerW) * 100) : 0;
    const bits = [
      `scroll ${r.scrollW}/${r.innerW}${sideways ? "  SIDEWAYS" : ""}`,
      r.content ? `content ${r.content.width}px (${used}% of window)` : "",
      `${r.controls} top controls`,
      r.overlaps.length ? `OVERLAP: ${r.overlaps.join(", ")}` : "",
      r.errors.length ? `${r.errors.length} page error(s)` : "",
    ].filter(Boolean);
    console.log(`  ${String(w).padStart(5)}  ${bits.join("  |  ")}`);
    if (r.widest) {
      console.log(`         widest: <${r.widest.tag} class="${r.widest.cls}"> ${r.widest.width}px, right edge ${r.widest.right}`);
    }
    if (r.caps.length) console.log(`         max-width in play: ${r.caps.join(", ")}`);
  }
  console.log("");
}

await browser.close();
