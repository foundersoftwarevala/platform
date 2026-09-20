/**
 * Consolidated reseller E2E, live, in a real browser. Stops at the real payment
 * boundary (rails and PayU are unconfigured) — no payment is simulated.
 *
 *   ACCOUNTS=accounts.json REPORT=report.json node reseller-lifecycle-e2e.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const BASE = "https://softwarevala.net";
const OUT = process.env.REPORT ?? "reseller-lifecycle-e2e.json";
const PRODUCT = process.env.PRODUCT ?? "academyenroll";
const accts = JSON.parse(readFileSync(process.env.ACCOUNTS, "utf8"));
const by = (label) => accts.find((a) => a.label === label);
const report = { steps: [], errors: [], facts: {} };
const step = (name, ok, detail) => {
  report.steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
};
const save = () => writeFileSync(OUT, JSON.stringify(report, null, 1));
const browser = await chromium.launch();

async function session(label, ctxOpts = { viewport: { width: 1440, height: 900 } }) {
  const a = by(label);
  const ctx = await browser.newContext({ ...ctxOpts, locale: "en-US" });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem("i")) { localStorage.setItem("sv_lang_current_v2", "en"); sessionStorage.setItem("i", "1"); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("response", (r) => { if (r.url().startsWith(BASE) && r.status() >= 500) errs.push(`${r.status()} ${r.url().replace(BASE, "").slice(0, 100)}`); });
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 90000 });
  await page.fill("#email", a.email);
  await page.fill("#password", a.password);
  await page.click("button[type=submit]");
  await page.waitForTimeout(6000);
  return { ctx, page, errs, a };
}
const close = async (s, who) => { report.errors.push(...s.errs.map((e) => `${who}: ${e}`)); await s.ctx.close(); };

const APPLICANT = {
  A: { fullName: "Arjun Mehta", phone: "+91 98200 41736", country: "India", state: "Maharashtra", city: "Pune", companyName: "Mehta Digital Solutions", targetMarket: "Schools and coaching centres in western Maharashtra", marketingChannels: "Direct sales, WhatsApp Business, local events", website: "https://mehtadigital.in", socialMedia: "linkedin.com/company/mehta-digital", idNumber: "ABCPM4821K", accountHolder: "Mehta Digital Solutions", accountNumber: "50200041736219", ifsc: "HDFC0001234", bankName: "HDFC Bank", upi: "mehtadigital@hdfcbank", expectedMonthlySales: "USD 2,000" },
  B: { fullName: "Priya Nair", phone: "+91 94470 22618", country: "India", state: "Kerala", city: "Kochi", companyName: "Nair Tech Partners", targetMarket: "Clinics and pharmacies in Kerala", marketingChannels: "Referrals, Google Ads", website: "https://nairtech.in", socialMedia: "instagram.com/nairtech", idNumber: "BQRPN7730D", accountHolder: "Nair Tech Partners", accountNumber: "40771022618450", ifsc: "SBIN0070123", bankName: "State Bank of India", upi: "nairtech@sbi", expectedMonthlySales: "USD 1,200",
       registrationNumber: "U72900KL2020PTC061234", gstNumber: "32AAPCN1234K1Z9", businessAddress: "MG Road, Kochi, Kerala 682016", contactPerson: "Priya Nair", categoriesInterested: "Clinic management, pharmacy billing",
       territory: "Kochi", investmentCapacity: "INR 15 lakh", businessBackground: "Healthcare IT reseller since 2018",
       niche: "Healthcare technology", instagram: "https://instagram.com/nairtech", rateCard: "INR 8,000 per post", addressLine: "MG Road, Kochi, Kerala 682016" },
};

async function fillApplication(page, data, email) {
  for (const input of await page.locator("form input[id^=f_], form textarea[id^=f_], form select[id^=f_]").all()) {
    const id = (await input.getAttribute("id")).slice(2);
    const tag = await input.evaluate((el) => el.tagName.toLowerCase());
    const type = (await input.getAttribute("type")) ?? "";
    if (type === "file") continue;
    if (tag === "select") {
      const options = await input.locator("option").allTextContents();
      const pick = options.find((o) => o && o !== "Select…");
      if (pick) await input.selectOption({ label: pick });
      continue;
    }
    const value = type === "number" ? "12" : type === "url" ? (data[id] ?? "https://nairtech.in") : type === "email" ? email : data[id] ?? `${data.companyName} — ${id}`;
    await input.fill(String(value));
  }
}

async function apply(page, role, data, email) {
  await page.goto(`${BASE}/apply/${role}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  const payNow = await page.getByRole("button", { name: /pay now/i }).count();
  await fillApplication(page, data, email);
  await page.locator("input[type=checkbox]").last().check();
  await page.getByRole("button", { name: /submit application/i }).click();
  await page.locator("[data-application-number]").waitFor({ timeout: 30000 }).catch(() => undefined);
  const number = (await page.locator("[data-application-number]").textContent().catch(() => ""))?.trim();
  const toasts = (await page.locator("[data-sonner-toast]").allTextContents().catch(() => [])).join(" | ");
  return { number, payNow, toasts };
}

async function bell(page) {
  const btn = page.locator("[data-notification-bell]:visible").first();
  await btn.waitFor({ timeout: 20000 }).catch(() => undefined);
  const unread = Number(await btn.getAttribute("data-unread").catch(() => "NaN"));
  await btn.click().catch(() => undefined);
  await page.locator("[data-notification-panel]").waitFor({ timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const items = await page.locator("[data-notification]").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-notification"), event: e.getAttribute("data-event"), read: e.getAttribute("data-read"), text: e.textContent.replace(/\s+/g, " ").slice(0, 140) })));
  return { unread, items };
}

async function openModule(page, label) {
  await page.getByText(label, { exact: true }).first().click().catch(() => undefined);
  await page.waitForTimeout(2500);
}

try {
  // ---------------------------------------------------------------- 1. Apply
  const numbers = {};
  for (const who of ["A", "B"]) {
    const s = await session(`applicant${who}`);
    const { page } = s;
    if (who === "A") {
      await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90000 });
      await page.waitForTimeout(2500);
      await page.getByRole("button", { name: /apply now/i }).first().click().catch(() => undefined);
      const link = page.getByRole("menuitem", { name: /Become Reseller/ }).first();
      await link.waitFor({ timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(600);
      step("homepage → Apply Now → Become Reseller", (await link.count()) > 0);
    }
    const r = await apply(page, "reseller", APPLICANT[who], s.a.email);
    numbers[who] = r.number;
    step(`${who}: reseller application submitted, no fee, number issued`, /^RSA-[A-Z0-9]{10}$/.test(r.number ?? "") && r.payNow === 0, r.number);
    const again = await apply(page, "reseller", APPLICANT[who], s.a.email);
    step(`${who}: resubmitting returns the same application`, again.number === r.number, again.number);
    if (who === "A") {
      await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      step("A: reseller dashboard refused before approval", (await page.getByText("Membership & Plans").count()) === 0);
    }
    await close(s, who);
  }
  report.facts.applicationNumbers = numbers;
  save();

  // ------------------------------------------ 2. Reseller Manager: live banner, approve
  {
    const s = await session("staff");
    const { page } = s;
    await page.goto(`${BASE}/reseller-manager`, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator("[data-executive-banner=reseller]").waitFor({ timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(2000);
    const banner = await page.evaluate(() => {
      const b = document.querySelector("[data-executive-banner=reseller]");
      const sig = {};
      document.querySelectorAll("[data-signal]").forEach((e) => (sig[e.getAttribute("data-signal")] = e.getAttribute("data-count")));
      return { live: b?.getAttribute("data-live"), notice: b?.hasAttribute("data-live-notice"), signals: sig, text: b?.textContent?.slice(0, 160) };
    });
    const hardcoded = /12 reseller registrations|3\.8L|Q-target|72%/.test(banner.text ?? "");
    step("Reseller Manager banner is live (database counts, no fixed figures)", banner.live === "true" && !hardcoded && Number(banner.signals.applications) >= 2, banner.signals);
    report.facts.bannerBefore = banner.signals;
    await page.getByRole("button", { name: /^Resellers$/ }).first().click().catch(() => page.getByText("Resellers", { exact: true }).first().click());
    await page.waitForTimeout(4000);
    for (const who of ["A", "B"]) {
      const name = APPLICANT[who].fullName;
      // Matched by application number: names can repeat across applications.
      const row = page.locator("div, li, tr").filter({ hasText: numbers[who] }).filter({ has: page.getByRole("button", { name: /^Approve$/ }) }).last();
      const inQueue = await row.count();
      step(`Reseller Manager lists ${name} (${numbers[who]}) as pending and approves`, inQueue > 0);
      if (inQueue) {
        const done = page.waitForResponse((r) => r.url().includes("/_serverFn/") && r.request().method() === "POST", { timeout: 30000 }).catch(() => null);
        await row.getByRole("button", { name: /^Approve$/ }).click();
        const resp = await done;
        const body = resp ? (await resp.text().catch(() => "")).slice(0, 120) : "no response";
        report.facts[`approve_${who}`] = { status: resp?.status(), body };
        await page.waitForTimeout(3000);
      }
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-signal=applications]").waitFor({ timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const after = await page.locator("[data-signal=applications]").getAttribute("data-count").catch(() => null);
    report.facts.bannerApplicationsAfter = after;
    step("Banner after refresh: pending applications fell by the two approvals", Number(after) === Number(banner.signals.applications) - 2, { before: banner.signals.applications, after });
    await close(s, "staff");
  }
  save();

  // ------------------------------------------ 3. Reseller A: dashboard, bell, membership, pricing, checkout
  {
    let s = await session("applicantA");
    let { page } = s;
    await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(3000);
    step("A: reseller dashboard opens after approval (role mapped)", (await page.getByText("Membership & Plans").count()) > 0);
    step("A: legacy EN/HI/AR/ES/FR/DE selector is gone", (await page.locator('[aria-label="Interface language"]').count()) === 0);

    const b0 = await bell(page);
    step("A: bell shows the approval notification (unread)", b0.unread >= 1 && b0.items.some((i) => /reseller/i.test(i.event ?? "") && i.read === "false"), b0.items.map((i) => i.event));
    await page.keyboard.press("Escape");

    await openModule(page, "Membership & Plans");
    await page.locator("[data-membership-screen]").waitFor({ timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(2000);
    await page.locator('[data-purchase="starter_reseller"]').click();
    await page.waitForTimeout(4000);
    await page.locator('[data-purchase="starter_reseller"]').click();
    await page.waitForTimeout(3000);
    const orders = await page.locator("[data-order]").evaluateAll((els) => els.map((e) => ({ n: e.getAttribute("data-order"), s: e.getAttribute("data-order-status"), t: e.textContent.replace(/\s+/g, " ") })));
    step("A: Starter → exactly one order with an invoice (double click)", orders.length === 1 && /RMI-/.test(orders[0]?.t ?? "") && /99/.test(orders[0]?.t ?? ""), orders.map((o) => `${o.n} ${o.s}`));
    report.facts.membershipOrder = orders[0]?.n;

    // Realtime: the order notification arrives without a reload.
    await page.waitForTimeout(3000);
    const b1 = await bell(page);
    const orderNote = b1.items.find((i) => i.event === "reseller.membership.order_created");
    step("A: bell receives 'Membership order created' live", Boolean(orderNote) && b1.unread >= 2, orderNote?.text);
    if (orderNote) {
      await page.locator(`[data-notification="${orderNote.id}"] [data-mark-read]`).click().catch(() => undefined);
      await page.waitForTimeout(2500);
    }
    await page.keyboard.press("Escape");

    // Payment boundary: every allowed rail is unconfigured.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await openModule(page, "Membership & Plans");
    await page.locator(`[data-order="${orders[0]?.n}"]`).waitFor({ timeout: 30000 }).catch(() => undefined);
    await page.locator(`[data-order="${orders[0]?.n}"]`).getByRole("button", { name: /^Pay$/ }).click().catch(() => undefined);
    await page.locator("[data-payment-panel]").waitFor({ timeout: 10000 }).catch(() => undefined);
    const rails = {};
    for (const rail of ["wise", "upi", "bank_transfer", "binance"]) {
      await page.locator("[data-payment-panel] select").selectOption(rail).catch(() => undefined);
      await page.locator("[data-payment-panel] input").first().fill(`UTR-E2E-${rail.toUpperCase()}`).catch(() => undefined);
      await page.locator("[data-payment-panel]").getByRole("button", { name: /submit for verification/i }).click().catch(() => undefined);
      await page.locator("[data-sonner-toast]").first().waitFor({ timeout: 8000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      rails[rail] = (await page.locator("[data-sonner-toast]").allTextContents()).join(" | ").slice(0, 60);
      await page.evaluate(() => document.querySelectorAll("[data-sonner-toast]").forEach((t) => t.remove()));
    }
    step("A: payment boundary — every rail refuses (not configured), nothing marked paid", Object.values(rails).every((v) => /not configured/i.test(v)), rails);

    // Pricing workspace: server standing and server quote.
    await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await openModule(page, "Pricing Engine");
    await page.locator("[data-reseller-pricing]").waitFor({ timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
    const standing = await page.locator("[data-pricing-standing]").getAttribute("data-pricing-standing").catch(() => null);
    const planRows = await page.locator("[data-pricing-plan-row]").count();
    step("A: Pricing shows server standing (no membership → list price) and the 3 database plans", standing === "inactive" && planRows === 3, { standing, planRows });
    await page.locator("[data-quote-input]").fill(PRODUCT);
    await page.locator("[data-quote-submit]").click();
    await page.locator("[data-quote-final]").waitFor({ timeout: 20000 }).catch(() => undefined);
    const quoted = await page.locator("[data-quote-final]").getAttribute("data-quote-final").catch(() => null);
    const listed = (await page.locator("[data-quote-list]").textContent().catch(() => ""))?.trim();
    report.facts.quoteA = { quoted, listed };
    step("A: server quote without membership = list price", quoted !== null && listed?.endsWith(Number(quoted).toFixed(2)), { quoted, listed });

    // Checkout through Buy Now: server quote, order, payment boundary.
    await page.goto(`${BASE}/marketplace/product/${PRODUCT}?buy=1`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForURL(/\/checkout/, { timeout: 30000 }).catch(() => undefined);
    await page.locator("[data-cart-quote]").waitFor({ timeout: 30000 }).catch(() => undefined);
    const cartTotal = await page.locator("[data-cart-quote]").getAttribute("data-quote-total").catch(() => null);
    step("A: checkout shows the server's cart total (= quote)", cartTotal !== null && Number(cartTotal) === Number(quoted), { cartTotal, quoted });
    await page.getByRole("button", { name: /pay securely/i }).click().catch(() => undefined);
    await page.waitForTimeout(8000);
    const orderNumber = await page.locator("[data-order-result]").getAttribute("data-order-result").catch(() => null);
    const orderTotal = await page.locator("[data-order-result]").getAttribute("data-order-total").catch(() => null);
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    report.facts.checkoutA = { orderNumber, orderTotal, url: page.url().replace(BASE, "") };
    step("A: order created at the server price; payment stops at the unconfigured gateway", Boolean(orderNumber) && Number(orderTotal) === Number(cartTotal) && /not started|not configured/i.test(bodyText), { orderNumber, orderTotal });
    await close(s, "A");

    // Logout/login: read state and orders persist.
    s = await session("applicantA");
    page = s.page;
    await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(3000);
    const b2 = await bell(page);
    const stillRead = b2.items.find((i) => i.event === "reseller.membership.order_created");
    step("A: after logout/login the notification stays read", stillRead?.read === "true", { read: stillRead?.read, unread: b2.unread });
    await page.keyboard.press("Escape");
    await openModule(page, "Pricing Engine");
    await page.locator("[data-reseller-order]").first().waitFor({ timeout: 20000 }).catch(() => undefined);
    const persisted = await page.locator(`[data-reseller-order="${orderNumber}"]`).count();
    step("A: after logout/login the order is still listed", persisted === 1, orderNumber);

    // Language: canonical selector, RTL, persistence.
    await page.locator("[data-language-selector]:visible").first().click().catch(() => undefined);
    const panel = page.locator("[data-radix-popper-content-wrapper]").first();
    await panel.locator('[role=option][data-all][data-code="ar"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await panel.locator('[role=option][data-all][data-code="ar"]').click().catch(() => undefined);
    await page.waitForTimeout(6000);
    const ar = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    const arAfter = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
    step("A: canonical selector → Arabic is RTL and persists after reload", ar.lang === "ar" && ar.dir === "rtl" && arAfter.lang === "ar" && arAfter.dir === "rtl", { ar, arAfter });
    await page.locator("[data-language-selector]:visible").first().click().catch(() => undefined);
    await page.locator("[data-radix-popper-content-wrapper]").first().locator('[role=option][data-all][data-code="hi"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.locator("[data-radix-popper-content-wrapper]").first().locator('[role=option][data-all][data-code="hi"]').click().catch(() => undefined);
    await page.waitForTimeout(6000);
    const hi = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
    step("A: switch to Hindi is LTR", hi.lang === "hi" && hi.dir === "ltr", hi);
    await close(s, "A");

    // Phone.
    const m = await session("applicantA", devices["Pixel 7"]);
    await m.page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "networkidle", timeout: 90000 });
    await m.page.waitForTimeout(3000);
    const phone = await m.page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      legacy: document.querySelectorAll('[aria-label="Interface language"]').length,
      bell: document.querySelectorAll("[data-notification-bell]").length,
    }));
    step("A (phone): no sideways scroll, no legacy selector, bell present", phone.overflowX <= 2 && phone.legacy === 0 && phone.bell >= 1, phone);
    await close(m, "A-phone");
  }
  save();

  // ------------------------------------------ 4. Normal customer: list price, same chain
  {
    const s = await session("customer");
    const { page } = s;
    await page.goto(`${BASE}/marketplace/product/${PRODUCT}?buy=1`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForURL(/\/checkout/, { timeout: 30000 }).catch(() => undefined);
    await page.locator("[data-cart-quote]").waitFor({ timeout: 30000 }).catch(() => undefined);
    const total = await page.locator("[data-cart-quote]").getAttribute("data-quote-total").catch(() => null);
    const discountShown = await page.locator("[data-quote-discount]").count();
    report.facts.customerCartTotal = total;
    step("Customer: checkout total is list price, no reseller discount line", total !== null && Number(total) === Number(report.facts.quoteA?.quoted) && discountShown === 0, { total, discountShown });
    const b = await bell(page).catch(() => ({ unread: NaN, items: [] }));
    step("Customer: bell has none of the resellers' notifications", !b.items.some((i) => /reseller/.test(i.event ?? "")), b.items.map((i) => i.event));
    await close(s, "customer");
  }
  save();

  // ------------------------------------------ 5. Reseller B: isolation in the UI
  {
    const s = await session("applicantB");
    const { page } = s;
    await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(3000);
    const b = await bell(page);
    step("B: bell shows only B's own notifications (no A order)", !b.items.some((i) => i.event === "reseller.membership.order_created") && b.items.length >= 1, b.items.map((i) => i.event));
    await page.keyboard.press("Escape");
    await openModule(page, "Membership & Plans");
    await page.locator("[data-membership-screen]").waitFor({ timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(2000);
    step("B: sees none of A's membership orders", (await page.locator("[data-order]").count()) === 0);

    // ---------------------------------------- 6. Other role applications (B)
    const roleNumbers = {};
    for (const [role, rx] of [["franchise", /^FRA-/], ["influencer", /^INF-/], ["vendor", /^SVV-/]]) {
      const r = await apply(page, role, APPLICANT.B, s.a.email);
      roleNumbers[role] = r.number;
      step(`B: ${role} application reaches the server (number issued, no Pay Now)`, rx.test(r.number ?? "") && r.payNow === 0, r.number ?? r.toasts);
    }
    report.facts.roleApplications = roleNumbers;
    await page.goto(`${BASE}/apply/employee`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const notOpen = await page.locator("[data-application-not-open]").count();
    const disabled = await page.getByRole("button", { name: /submit application/i }).isDisabled().catch(() => false);
    step("Employee application: says it is not open online, submit disabled (no fake storage)", notOpen === 1 && disabled, { notOpen, disabled });
    await close(s, "B");
  }
  save();

  // ------------------------------------------ 7. Staff decide the role applications
  {
    const s = await session("staff");
    const { page } = s;
    for (const [route, role] of [["/franchise-manager", "franchise"], ["/influencer-manager", "influencer"]]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForTimeout(2500);
      await page.getByText("Applications", { exact: true }).first().click().catch(() => undefined);
      await page.locator(`[data-applications-queue=${role}]`).waitFor({ timeout: 30000 }).catch(() => undefined);
      await page.waitForTimeout(2500);
      const num = report.facts.roleApplications?.[role];
      const row = page.locator(`[data-application="${num}"]`);
      const listed = await row.count();
      step(`${role} manager queue lists ${num}`, listed === 1);
      if (listed) {
        await row.locator("[data-reject]").click();
        await row.locator("input").fill("E2E verification application — not a real applicant");
        await row.getByRole("button", { name: /reject application/i }).click();
        await page.waitForTimeout(3000);
        await page.locator("select").last().selectOption("all").catch(() => undefined);
        await page.waitForTimeout(2500);
        const status = await page.locator(`[data-application="${num}"]`).getAttribute("data-application-status").catch(() => null);
        step(`${role}: staff rejection recorded (with reason)`, status === "rejected", status);
      }
    }
    await close(s, "staff");
  }
  save();

  // ------------------------------------------ 8. B is told
  {
    const s = await session("applicantB");
    await s.page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "networkidle", timeout: 90000 });
    await s.page.waitForTimeout(3000);
    const b = await bell(s.page);
    const told = ["franchise.application_rejected", "influencer.application_rejected"].every((e) => b.items.some((i) => i.event === e));
    step("B: bell shows both application decisions", told, b.items.map((i) => i.event));
    await close(s, "B");
  }
} catch (error) {
  report.errors.push(`run: ${String(error).slice(0, 300)}`);
  console.log("ERROR", error);
} finally {
  save();
  await browser.close();
}
