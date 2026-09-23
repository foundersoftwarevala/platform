import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for the storefront.
 *
 * Separate from `npm test`, which is vitest over the units. These drive a real
 * browser against a real page, because the defect that took the home page down
 * - eight of its own JavaScript chunks answering 500 - is invisible to
 * everything that only reads HTML. The document was 200 and complete; nothing
 * on it worked.
 *
 * Point them wherever the change is:
 *   SV_BASE_URL=https://softwarevala.net npx playwright test
 *   SV_BASE_URL=http://127.0.0.1:3000    npx playwright test
 */
const baseURL = process.env.SV_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/browser",
  // `.pw.ts`, not `.spec.ts`: vitest's default glob is `**/*.{test,spec}.ts`,
  // so a Playwright spec named that way is collected by `npm test` as well and
  // fails there with "Playwright Test did not expect test.describe()". The two
  // runners share this repository, so they do not share a filename pattern.
  testMatch: "**/*.pw.ts",
  // The catalogue is paged in on scroll; a run that walks the whole page is
  // doing real work rather than hanging.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Three widths, because the layout promises three: three FAQ columns on a
  // desktop, two on a tablet, one on a phone.
  //
  // `tablet-chromium` exists because the iPad descriptors run on WebKit, and a
  // run with only Chromium installed fails every tablet test in four
  // milliseconds - which reads exactly like eleven broken tests rather than one
  // missing browser. This one needs nothing but Chromium, so the tablet width
  // is always covered; `tablet-safari` adds the real engine when WebKit is
  // installed (`npx playwright install webkit`).
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "tablet-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
        isMobile: false,
        hasTouch: true,
      },
    },
    { name: "tablet-safari", use: { ...devices["iPad (gen 7)"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Only started when the tests are pointed at localhost; a run against the
  // live site must not try to boot a second copy of the application.
  webServer: baseURL.includes("127.0.0.1") || baseURL.includes("localhost")
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});
