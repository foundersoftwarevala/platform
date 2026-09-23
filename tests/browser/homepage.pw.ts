import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * The marketplace home page, top to bottom, in a real browser.
 *
 * Written against a specific failure: the page served a complete 964 KB
 * document while eight of its own JavaScript chunks answered 500, so React
 * never started. Everything that only reads HTML said the site was fine. A
 * visitor got a page where the search box did nothing, the heart did nothing,
 * "Show more" did nothing, and eighty-one of the ninety-one category rows never
 * arrived, because all of that is behind hydration.
 *
 * So the first test here is not about any feature. It is: did the page's own
 * code load, and did it run.
 */

/** Anything the page asked for and did not get. */
type Failure = { url: string; status: number };

function watch(page: Page) {
  const failures: Failure[] = [];
  const errors: string[] = [];

  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.push({ url: response.url(), status: response.status() });
    }
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") errors.push(message.text());
  });

  return { failures, errors };
}

/**
 * Walk to the bottom, letting each batch of rows load.
 *
 * The catalogue arrives eight rows at a time as the reader reaches the bottom,
 * and each row fills itself from twelve cards to sixty when it comes into view,
 * so the page has to actually be scrolled to be seen.
 */
async function scrollToEnd(page: Page, maxSteps = 60) {
  let previous = -1;
  for (let step = 0; step < maxSteps; step++) {
    const height = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return document.body.scrollHeight;
    });
    if (height === previous) break;
    previous = height;
    await page.waitForTimeout(600);
  }
}

test.describe("home page", () => {
  test("every file the document references is served", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Asked for explicitly rather than inferred from what the browser happened
    // to request. A preload the browser skips, or a module it refuses to parse,
    // produces no response event to observe - which is how eight chunks could
    // answer 500 with nothing watching them noticing.
    const referenced: string[] = await page.evaluate(() =>
      Array.from(
        new Set(
          Array.from(document.querySelectorAll<HTMLElement>("script[src], link[href]"))
            .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
            .filter((u) => u.startsWith("/assets/")),
        ),
      ),
    );
    expect(referenced.length, "the document references no assets").toBeGreaterThan(0);

    const broken: string[] = [];
    for (const url of referenced) {
      const response = await page.request.get(url);
      if (response.status() !== 200) broken.push(`${response.status()} ${url}`);
    }
    expect(broken, `assets that are not served:\n${broken.join("\n")}`).toEqual([]);
  });

  test("the page hydrates", async ({ page }) => {
    const seen = watch(page);
    await page.goto("/", { waitUntil: "load" });

    // TanStack Start puts `$_TSR` on the window while the document streams and
    // deletes it once the router has hydrated and the stream has ended. Its
    // still being there is the router saying, in its own words, that the page's
    // code never ran. Every interactive thing on this page is behind that.
    await expect
      .poll(() => page.evaluate(() => typeof (window as never as Record<string, unknown>).$_TSR), {
        timeout: 30_000,
        message:
          "the router never hydrated - the document rendered but none of its code ran",
      })
      .toBe("undefined");

    // And something that only works once it has: typing filters the catalogue,
    // which replaces the rows with a result rail whose heading names the query.
    const search = page.getByPlaceholder("Search software...");
    await expect(search).toBeVisible();
    await search.fill("school");
    await expect(
      page.getByRole("region", { name: /school/i }).first(),
      "the search box did nothing",
    ).toBeVisible({ timeout: 25_000 });

    expect(seen.errors, `console errors:\n${seen.errors.join("\n")}`).toEqual([]);
  });

  test("every section is present, in order, to the bottom", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await scrollToEnd(page);

    // The sections the home page is built from. A section an operator has
    // switched off in Layout Order is legitimately absent, so this reports what
    // it finds and only insists on the ones that are not configurable away.
    const sections: { name: string; locator: () => ReturnType<Page["locator"]>; required: boolean }[] = [
      { name: "hero carousel", locator: () => page.locator('[aria-roledescription="carousel"], section:has(.hero-premium)'), required: true },
      { name: "category slider", locator: () => page.locator(".cursor-grab"), required: false },
      { name: "search bar", locator: () => page.getByPlaceholder("Search software..."), required: true },
      { name: "catalogue rows", locator: () => page.locator("[data-product-row]"), required: true },
      { name: "Featured Software", locator: () => page.getByRole("region", { name: "Featured Software" }), required: false },
      { name: "Trending Now", locator: () => page.getByRole("region", { name: "Trending Now" }), required: false },
      { name: "Top Selling", locator: () => page.getByRole("region", { name: "Top Selling" }), required: false },
      { name: "New Releases", locator: () => page.getByRole("region", { name: "New Releases" }), required: false },
      { name: "AI Zone", locator: () => page.getByText("AI Zone", { exact: true }), required: true },
      { name: "Success Stories", locator: () => page.getByText("Success Stories", { exact: true }), required: false },
      { name: "Awards", locator: () => page.getByText("Awards & Champions"), required: false },
      { name: "Live Activity", locator: () => page.getByText("Live Marketplace Activity"), required: true },
      { name: "Vala TV", locator: () => page.getByText("Demos, walkthroughs, customer films"), required: false },
      { name: "Vala Academy", locator: () => page.getByText("Vala Academy", { exact: true }), required: true },
      { name: "Partner Ecosystem", locator: () => page.getByText("Partner Ecosystem", { exact: true }), required: true },
      { name: "FAQ", locator: () => page.locator("#faq"), required: true },
      { name: "Enterprise CTA", locator: () => page.getByText(/Run your entire business/), required: true },
      { name: "footer", locator: () => page.locator("footer, [data-site-footer]"), required: true },
    ];

    const absent: string[] = [];
    for (const section of sections) {
      const count = await section.locator().count();
      // eslint-disable-next-line no-console
      console.log(`  ${count > 0 ? "present" : "ABSENT "}  ${section.name}`);
      if (count === 0) {
        absent.push(section.name);
        if (section.required) {
          throw new Error(`${section.name} did not render, and it is not configurable away`);
        }
      }
    }
    // eslint-disable-next-line no-console
    if (absent.length) console.log(`\n  configured off or holding no content: ${absent.join(", ")}`);
  });

  test("the catalogue pages in past its first eight rows", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const rails = page.locator("[data-product-row]");
    const seeded = await rails.count();
    expect(seeded, "the server rendered no rows at all").toBeGreaterThan(0);

    await scrollToEnd(page);
    const loaded = await rails.count();
    // eslint-disable-next-line no-console
    console.log(`  rows: ${seeded} server-rendered, ${loaded} after scrolling`);

    // The marketplace has ninety-one visible categories. If scrolling does not
    // bring in more rows than the server sent, the reader can never reach them.
    expect(loaded, "scrolling to the bottom loaded no further rows").toBeGreaterThan(seeded);
  });

  test("a row fills itself and scrolls sideways", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const rail = page.locator("[data-product-row]").first();
    await rail.scrollIntoViewIfNeeded();

    // Seeded with twelve cards, tops up to sixty when it is reached. Counted as
    // cards, not as links: a card carries three links to its product and the
    // arithmetic hid whether anything had actually been added.
    const seeded = await rail.locator(".sv-card-shell").count();
    expect(seeded, "the row arrived with no cards").toBeGreaterThan(0);
    await expect
      .poll(async () => rail.locator(".sv-card-shell").count(), {
        timeout: 30_000,
        message: `the row never filled past the ${seeded} cards the server sent`,
      })
      .toBeGreaterThan(seeded);

    const before = await rail.evaluate((el) => el.scrollLeft);
    await rail.evaluate((el) => el.scrollBy({ left: 800, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(300);
    expect(await rail.evaluate((el) => el.scrollLeft), "the row does not scroll").toBeGreaterThan(before);
  });

  test("a card carries the fields the catalogue holds", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const card = page.locator(".sv-card-shell").first();
    await card.scrollIntoViewIfNeeded();

    // Name, price and a way through to the product: without these it is not a
    // product card.
    await expect(card.locator("h3").first()).not.toBeEmpty();
    await expect(card.locator(".sv-price")).toBeVisible();
    await expect(card.locator('a[href^="/marketplace/product/"]').first()).toBeVisible();

    // A tab is only offered for a panel with something in it, so a tab that is
    // drawn must open onto at least one chip.
    //
    // Checked on a card that actually has tabs. Taking the first card on the
    // page made this pass without testing anything: that card has no tabs, so
    // the loop body never ran and the test went green having asserted nothing.
    //
    // What it is looking for is a tab offered over an empty panel. Most cards
    // that draw tabs carry both features and a tech stack and are fine; the
    // fault is a card with one and not the other. Sampling 398 catalogue cards
    // found one such card, so this will usually pass - it is here to catch the
    // case, not to prove it is common.
    const withTabs = page.locator(".sv-card-shell").filter({ has: page.locator("button.sv-tab") });
    const tabbedCount = await withTabs.count();
    if (tabbedCount === 0) {
      // eslint-disable-next-line no-console
      console.log("  no card on this page draws tabs - nothing to check");
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`  ${tabbedCount} of ${await page.locator(".sv-card-shell").count()} cards draw tabs`);

    const tabbed = withTabs.first();
    await tabbed.scrollIntoViewIfNeeded();
    const tabs = tabbed.locator("button.sv-tab");
    for (let i = 0; i < (await tabs.count()); i++) {
      const label = (await tabs.nth(i).textContent())?.trim();
      await tabs.nth(i).click();
      await expect(
        tabbed.locator(".sv-chip").first(),
        `the "${label}" tab is offered and opens onto an empty panel`,
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("favourites remember themselves", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const card = page.locator(".sv-card-shell").first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();

    const heart = card.getByRole("button", { name: /favorites/i });
    if ((await heart.count()) === 0) test.skip(true, "wishlist is switched off in Product Card Manager");

    await heart.click();
    await expect(card.getByRole("button", { name: /Remove from favorites/i })).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });
    const again = page.locator(".sv-card-shell").first();
    await again.scrollIntoViewIfNeeded();
    await again.hover();
    await expect(
      again.getByRole("button", { name: /Remove from favorites/i }),
      "the favourite was forgotten across a reload",
    ).toBeVisible();
  });

  test("the hero carousel advances, and takes a swipe on a touch screen", async ({ page, isMobile }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const hero = page.locator('[aria-roledescription="carousel"], section:has(.hero-premium)');
    await expect(hero).toBeVisible();

    const first = await hero.locator("h1, h2").first().textContent();

    if (isMobile) {
      const box = (await hero.boundingBox())!;
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.8, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.2, y, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      expect(
        await hero.locator("h1, h2").first().textContent(),
        "swiping the hero did nothing",
      ).not.toBe(first);
    } else {
      const next = hero.getByRole("button", { name: /next slide/i });
      if (await next.count()) {
        await next.click();
        await page.waitForTimeout(600);
        expect(await hero.locator("h1, h2").first().textContent()).not.toBe(first);
      }
    }
  });

  test("the FAQ is a grid, closed, and opens on tap", async ({ page }, testInfo) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const faq = page.locator("#faq");
    await faq.scrollIntoViewIfNeeded();

    // The questions have to be reachable as buttons that say whether they are
    // open. The layout this asserts - a grid, everything closed, aria-expanded
    // on each question - is the redesigned FAQ; against the previous full-width
    // accordion, which wrapped question and answer in one button carrying no
    // aria-expanded, this fails, and that is the point of it.
    const anyQuestion = faq.locator("button");
    expect(
      await anyQuestion.count(),
      "the FAQ section rendered no questions at all",
    ).toBeGreaterThan(0);

    const questions = faq.getByRole("button", { expanded: false });
    const total = await questions.count();
    expect(
      total,
      "no FAQ question reports its open/closed state (aria-expanded). Either the " +
        "redesigned FAQ is not deployed, or the accordion is not announcing itself.",
    ).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`  ${total} questions, all closed`);

    // Every answer starts hidden, so the section opens at the height of its
    // questions rather than of its longest answer.
    await expect(faq.getByRole("button", { expanded: true })).toHaveCount(0);

    // The column count the layout promises for this width.
    const columns = await faq.locator("ul").first().evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    // Keyed on the width the project runs at, not on its name, so adding a
    // browser does not silently change what is expected of it.
    const width = page.viewportSize()?.width ?? 0;
    const expected = width >= 1024 ? 3 : width >= 640 ? 2 : 1;
    expect(
      columns,
      `at ${width}px the FAQ should be laid out in ${expected} column(s)`,
    ).toBe(expected);

    await questions.first().click();
    await expect(faq.getByRole("button", { expanded: true })).toHaveCount(1);
    await expect(faq.getByRole("region").first()).toBeVisible();
  });

  test("the language selector opens and changes the page", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const picker = page.getByRole("button", { name: /language/i }).first();
    if ((await picker.count()) === 0) test.skip(true, "no language control on this build");
    await picker.click();
    await expect(page.getByRole("dialog").or(page.locator("[data-language-panel]")).first()).toBeVisible();
  });

  test("nothing on the page is a dead link", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await scrollToEnd(page, 20);

    const hrefs = await page.locator("a[href^='/']").evaluateAll((nodes) =>
      Array.from(new Set(nodes.map((n) => (n as HTMLAnchorElement).getAttribute("href")!))),
    );
    // The product pages are the author's; this checks the marketplace's own
    // navigation, which is what this repository is responsible for.
    const ours = hrefs.filter((h) => !h.startsWith("/marketplace/product/")).slice(0, 25);

    // One at a time, not in parallel.
    //
    // Asking for all twenty-five at once reported every one of them as a dead
    // link, and none of them was: served one at a time they all answer 200. The
    // origin renders each of these pages fresh - it is a single process and the
    // HTML is not cached at the edge - so twenty-five at once queue behind each
    // other and outlast any per-request deadline. That is worth knowing, and it
    // is a capacity question; this test is about whether the links go anywhere.
    const broken: string[] = [];
    for (const href of ours) {
      try {
        const response = await page.request.get(href, { maxRedirects: 3, timeout: 45_000 });
        if (response.status() >= 400) broken.push(`${response.status()} ${href}`);
      } catch (error) {
        broken.push(`did not answer in 45s: ${href}`);
      }
    }
    expect(broken, `dead links:\n${broken.join("\n")}`).toEqual([]);
  });
});
