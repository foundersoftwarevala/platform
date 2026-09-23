/**
 * Which ancestor stops WebKit reporting the catalogue's sentinel?
 *
 * Established already: an IntersectionObserver works on this page in WebKit -
 * a plain div appended to <body> is reported - and the catalogue's own
 * sentinel never is, receiving one initial callback and no update across ten
 * thousand pixels of scrolling. The sentinel differs from that control in two
 * ways: it is one pixel tall, and it lives inside the catalogue <section>,
 * which this stylesheet gives `contain: layout style paint`.
 *
 * This separates the two. Four elements are observed under identical
 * conditions:
 *
 *   body / 8px      the control that is known to work
 *   body / 1px      same place, sentinel's height
 *   section / 8px   sentinel's place, control's height
 *   section / 1px   both
 *
 * Whichever pair goes quiet names the cause.
 *
 *   node scripts/ops/probe-safari-containment.mjs [webkit|chromium]
 */
import { chromium, webkit, devices } from "@playwright/test";

const engine = process.argv[2] === "chromium" ? "chromium" : "webkit";
const launcher = engine === "chromium" ? chromium : webkit;
const browser = await launcher.launch();
const context = await browser.newContext(
  engine === "webkit" ? devices["iPad (gen 7)"] : { viewport: { width: 820, height: 1180 } },
);
const page = await context.newPage();
await page.goto(process.argv[3] ?? "https://softwarevala.net/", {
  waitUntil: "networkidle",
  timeout: 90_000,
});
await page.waitForTimeout(2500);

const setup = await page.evaluate(() => {
  const w = window;
  w.__p = {};
  const sentinel = document.querySelector('[aria-hidden="true"].h-px');
  const section = sentinel?.closest("section") ?? null;

  const containment = section ? getComputedStyle(section).contain : "(no section)";
  const chain = [];
  for (let el = sentinel?.parentElement ?? null; el && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.contain !== "none" || cs.contentVisibility !== "visible" || cs.overflow !== "visible") {
      chain.push({
        tag: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ""),
        contain: cs.contain,
        contentVisibility: cs.contentVisibility,
        overflow: cs.overflow,
      });
    }
  }

  const make = (parent, height, key) => {
    const d = document.createElement("div");
    d.style.cssText = `height:${height}px;width:100%`;
    d.dataset.probe = key;
    parent.appendChild(d);
    w.__p[key] = [];
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          w.__p[key].push({ hit: e.isIntersecting, top: Math.round(e.boundingClientRect.top) });
        }
      },
      { rootMargin: "600px" },
    ).observe(d);
  };

  make(document.body, 8, "body8");
  make(document.body, 1, "body1");
  if (section) {
    make(section, 8, "section8");
    make(section, 1, "section1");
  }
  return { containment, chain, hasSection: Boolean(section) };
});

for (let i = 0; i < 8; i++) {
  await page.evaluate(() => {
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    window.scrollTo(0, h);
  });
  await page.waitForTimeout(800);
}
await page.waitForTimeout(1500);

const results = await page.evaluate(() => window.__p);
await browser.close();

console.log(`engine: ${engine}\n`);
console.log(`the catalogue section's containment: ${setup.containment}`);
console.log(`\nancestors of the sentinel that contain or clip anything:`);
if (setup.chain.length === 0) console.log("  (none)");
for (const a of setup.chain) {
  console.log(`  ${a.tag.padEnd(16)} contain=${a.contain}  content-visibility=${a.contentVisibility}  overflow=${a.overflow}`);
}

console.log(`\nobserved, after scrolling to the bottom:`);
for (const [key, events] of Object.entries(results)) {
  const hit = events.some((e) => e.hit);
  console.log(
    `  ${key.padEnd(10)} callbacks=${String(events.length).padEnd(3)} ever intersecting=${hit}`,
  );
}

const b8 = results.body8?.some((e) => e.hit);
const b1 = results.body1?.some((e) => e.hit);
const s8 = results.section8?.some((e) => e.hit);
const s1 = results.section1?.some((e) => e.hit);
console.log(`\n=== verdict ===`);
if (b8 && b1 && !s8 && !s1) console.log("  the section is the cause - nothing inside it is reported, at any height.");
else if (b8 && !b1 && s8 && !s1) console.log("  the one-pixel height is the cause - height, not placement.");
else if (b8 && b1 && s8 && s1) console.log("  all four are reported; neither placement nor height explains it.");
else console.log("  mixed - read the table above.");
