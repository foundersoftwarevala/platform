/**
 * The application system, end to end, for every role.
 *
 * Form -> server -> database -> Control Panel -> decision -> database -> screen,
 * with real documents. For each online role: the form opens; signed out it
 * sends the visitor to sign in; the browser and the server both refuse missing
 * and malformed fields; a real submission keeps every field the form has, with
 * no bank details or ID number kept and documents stored as files; a second submission is the
 * same application; the Application Manager shows it in full, masks the
 * opens each
 * document; a refusal needs a reason and keeps it; an approval and a
 * suspension land; and a reload shows what the database holds.
 *
 * It runs against a build of this branch (BASE, default http://127.0.0.1:3203)
 * wired to the live database, as the site's own server is. Everything it
 * creates is removed at the end - rows, files, notices and the side effects of
 * an approval - except audit-log entries, which are kept on purpose.
 *
 *   node scripts/ops/apply-system-e2e.mjs [base]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv[2] ?? "http://127.0.0.1:3203";
const STAMP = `SVE2E${Date.now().toString(36).toUpperCase()}`;
const APPLICANT = { email: ops.SV_LOGIN_SEO, password: ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL };
const OPERATOR = { email: ops.SV_LOGIN_CONTROL_PANEL, password: ops.SV_PW_CONTROL_PANEL };
const OUTSIDER = { email: ops.SV_LOGIN_AUTHOR, password: ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL };
const STORAGE = `https://${ops.SUPABASE_PROJECT_REF}.supabase.co/storage/v1`;
const STORAGE_KEY = ops.SUPABASE_SERVICE_ROLE_KEY;

function sql(query) {
  const out = execFileSync(process.execPath, ["scripts/ops/db.mjs", "--sql", `select coalesce((${query})::text, 'NULL') as answer`], {
    encoding: "utf8",
    timeout: 180_000,
  });
  const lines = out.split("\n").map((l) => l.trim());
  const i = lines.findIndex((l) => l === "answer");
  return i >= 0 ? (lines[i + 2] ?? "") : out.trim();
}
const run = (s) => execFileSync(process.execPath, ["scripts/ops/db.mjs", "--sql", s], { encoding: "utf8", timeout: 180_000 });
const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const results = [];
let passed = 0;
let failed = 0;
const check = (role, name, ok, detail = "") => {
  ok ? (passed += 1) : (failed += 1);
  results.push({ role, name, ok, detail: String(detail).slice(0, 200) });
  console.log(`  ${(ok ? "PASS" : "FAIL").padEnd(5)} ${role.padEnd(10)} ${name.padEnd(58)} ${String(detail).slice(0, 110)}`);
};

const applicantId = sql(`select id from auth.users where lower(email)=lower('${APPLICANT.email}')`);
const STARTED = sql("select now()");
// What an approval might add to the applicant's account, so only that is removed.
const rolesBefore = sql(`select coalesce(string_agg(id::text, ','), '') from user_roles where user_id='${applicantId}'`);
const profileBefore = sql(`select count(*) from influencer_profiles where user_id='${applicantId}'`);

const TABLES = {
  reseller: { table: "resellers", owner: "user_id" },
  vendor: { table: "marketplace_sellers", owner: "owner_user_id" },
  author: { table: "marketplace_sellers", owner: "owner_user_id" },
  franchise: { table: "franchise_applications", owner: "applicant_user_id" },
  influencer: { table: "influencer_applications", owner: "applicant_user_id" },
  affiliate: { table: "marketplace_affiliate_partners", owner: "user_id" },
};
const APPROVED = { reseller: "active", vendor: "approved", author: "approved", franchise: "approved", influencer: "approved", affiliate: "approved" };
// Each role's own rule, read from its submit function: franchise and influencer
// hold one OPEN application per person, so a refused applicant may apply again;
// resellers, sellers and affiliates hold one record per account, whatever its state.
const REAPPLY_AFTER_REFUSAL = new Set(["franchise", "influencer"]);
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const SUSPENDABLE = new Set(["reseller", "vendor", "author", "affiliate"]);

// Two real documents: a PDF and a PNG. Their hashes are checked after the round trip.
const PDF = Buffer.from("%PDF-1.4\n% sv e2e\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

/* ---------------------------------------------------------------- cleanup */
function storagePaths() {
  const out = sql(
    `select coalesce(string_agg(storage_path, ','), '') from application_documents where owner_user_id='${applicantId}' and uploaded_at > '${STARTED}'`,
  );
  return out ? out.split(",").filter(Boolean) : [];
}
async function cleanRole(role) {
  const paths = storagePaths();
  if (paths.length) {
    await fetch(`${STORAGE}/object/application-documents`, {
      method: "DELETE",
      headers: { apikey: STORAGE_KEY, Authorization: `Bearer ${STORAGE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
    }).catch(() => undefined);
  }
  const { table, owner } = TABLES[role];
  const statements = [
    `delete from application_documents where owner_user_id='${applicantId}' and uploaded_at > '${STARTED}'`,
    `delete from user_notifications where created_at > '${STARTED}' and (user_id='${applicantId}' or message ilike '%${STAMP}%')`,
    `delete from marketplace_commission_rules where seller_id in (select id from marketplace_sellers where owner_user_id='${applicantId}')`,
    `delete from marketplace_referral_codes where reseller_id in (select id from resellers where user_id='${applicantId}') and created_at > '${STARTED}'`,
    `delete from marketplace_referral_codes where affiliate_partner_id in (select id from marketplace_affiliate_partners where user_id='${applicantId}') and created_at > '${STARTED}'`,
    ...(profileBefore === "0" ? [`delete from influencer_profiles where user_id='${applicantId}' and created_at > '${STARTED}'`] : []),
    `delete from user_roles where user_id='${applicantId}'${rolesBefore ? ` and id not in (${rolesBefore.split(",").map((i) => `'${i}'`).join(",")})` : ""}`,
    `delete from ${table} where ${owner}='${applicantId}'`,
  ];
  for (const statement of statements) {
    try {
      run(statement);
    } catch (error) {
      const text = String(error.stdout ?? error.stderr ?? error);
      if (!/does not exist/.test(text)) console.log(`  cleanup: ${statement.slice(0, 60)} - ${text.slice(0, 140)}`);
    }
  }
}

/* ---------------------------------------------------------------- browser */
const browser = await chromium.launch();
async function signIn(who, viewport = { width: 1366, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3500);
    await page.fill('input[type="email"]', who.email);
    await page.fill('input[type="password"]', who.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
      break;
    } catch {
      if (attempt === 1) throw new Error(`could not sign in as ${who.email}`);
    }
  }
  await page.waitForTimeout(1500);
  const token = await page.evaluate(() => {
    const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    return raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
  });
  return { context, page, token };
}

const applicant = await signIn(APPLICANT);
const operator = await signIn(OPERATOR, { width: 1440, height: 900 });
const outsider = await signIn(OUTSIDER);
const anon = await browser.newContext({ viewport: { width: 1366, height: 900 } });

const call = async (who, path, init = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${who.token}`, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
  const text = await response.text();
  return { status: response.status, body: json(text), text, raw: response };
};

/** Fills every field the form shows and returns what it typed, by field. */
async function fillForm(page, role, { files = true } = {}) {
  const fields = await page.$$eval("form [id^='f_']", (els) =>
    els.map((e) => ({ id: e.id, tag: e.tagName, type: e.getAttribute("type") ?? "", required: e.hasAttribute("required") })),
  );
  const typed = {};
  for (const f of fields) {
    const sel = `#${f.id}`;
    const name = f.id.slice(2);
    if (f.tag === "SELECT") {
      const value = await page.$eval(sel, (el) => el.options[1]?.value ?? "");
      await page.selectOption(sel, value);
      typed[name] = value;
    } else if (f.type === "file") {
      if (!files) continue;
      const png = name === "selfie";
      await page.setInputFiles(sel, {
        name: `${STAMP}-${name}.${png ? "png" : "pdf"}`,
        mimeType: png ? "image/png" : "application/pdf",
        buffer: png ? PNG : PDF,
      });
      typed[name] = { file: true, sha: sha(png ? PNG : PDF) };
    } else {
      const value =
        f.type === "email" ? `sv-e2e-${role}@example.com`
        : f.type === "tel" ? "+91 90000 12345"
        : f.type === "number" ? "7"
        : f.type === "url" ? `https://example.com/${STAMP.toLowerCase()}/${name.toLowerCase()}`
        : f.tag === "TEXTAREA" ? `${STAMP} ${name} text`
        : `${STAMP} ${name}`;
      await page.fill(sel, value);
      typed[name] = value;
    }
  }
  return { fields, typed };
}
const agree = async (page) => {
  const box = page.locator("form input[type='checkbox']").first();
  if (await box.count()) await box.check();
};

/** The stored application, read back and put under the form's own keys. */
function storedAnswers(role) {
  const { table, owner } = TABLES[role];
  if (role === "influencer") {
    const r = json(sql(`select row_to_json(t) from (select * from influencer_applications where applicant_user_id='${applicantId}' order by created_at desc limit 1) t`));
    if (!r) return null;
    // The verbatim application, as every role now keeps it.
    if (r.application) return { row: r, answers: r.application };
    const s = r.social_profiles ?? {};
    const x = r.tax_details ?? {};
    return {
      row: r,
      answers: {
        fullName: r.full_name, email: r.email, phone: r.phone, country: r.country, region: r.region,
        instagram: s.instagram, youtube: s.youtube, linkedin: s.linkedin, xTwitter: s.x,
        followers: r.followers == null ? null : String(r.followers), engagementRate: r.engagement_rate == null ? null : String(r.engagement_rate),
        niche: r.niche, rateCard: s.rate_card, pastBrands: s.past_brands, idType: x.id_type,
      },
    };
  }
  const scope = role === "vendor" || role === "author" ? ` and seller_kind='${role}'` : "";
  const r = json(sql(`select row_to_json(t) from (select * from ${table} where ${owner}='${applicantId}'${scope} order by created_at desc limit 1) t`));
  return r ? { row: r, answers: r.application ?? {} } : null;
}

async function queueRow(kind, number, filter = "all") {
  const list = await call(operator, `/api/applications/queue?kind=${kind}&filter=${filter}`);
  return (list.body?.rows ?? []).find((r) => r.number === number) ?? null;
}

async function decide(kind, id, status, reason) {
  return call(operator, "/api/applications/queue", {
    method: "POST",
    body: JSON.stringify({ action: "decide", kind, id, status, reason }),
  });
}

/* ----------------------------------------------------- one role, end to end */
async function submitThroughForm(role, { files = true } = {}) {
  const page = await applicant.context.newPage();
  const uploads = [];
  page.on("request", (r) => {
    if (/\/api\/applications\/documents/.test(r.url()) && r.method() === "POST") uploads.push(r.url());
  });
  await page.goto(`${BASE}/apply/${role}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  const filled = await fillForm(page, role, { files });
  await agree(page);
  const response = page
    .waitForResponse((r) => /\/api\/applications\/submit/.test(r.url()), { timeout: 60_000 })
    .then(async (r) => ({ status: r.status(), body: json(await r.text()) }))
    .catch(() => null);
  await page.click("form button[type='submit']");
  const submitted = await response;
  await page.waitForSelector("[data-application-number]", { timeout: 60_000 }).catch(() => null);
  await page.waitForTimeout(2500);
  const screen = await page.evaluate(() => ({
    number: document.querySelector("[data-application-number]")?.textContent?.trim() ?? "",
    conflict: Boolean(document.querySelector("[data-application-conflict]")),
    text: document.body.innerText,
    documents: [...document.querySelectorAll("[data-document-field]")].map((li) => ({
      field: li.getAttribute("data-document-field"),
      ok: li.hasAttribute("data-document-ok"),
    })),
  }));
  await page.close();
  return { ...filled, screen, submitted, uploads };
}

try {
for (const role of Object.keys(TABLES).filter((r) => !ONLY.length || ONLY.includes(r))) {
  await cleanRole(role);

  /* the form, signed out */
  {
    const page = await anon.newPage();
    const response = await page.goto(`${BASE}/apply/${role}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3000);
    const count = await page.locator("form [id^='f_']").count();
    check(role, "form opens", response?.status() === 200 && count > 0, `fields=${count}`);
    await fillForm(page, role, { files: false });
    await agree(page);
    await page.click("form button[type='submit']");
    await page.waitForTimeout(3000);
    check(role, "signed out: sent to sign in and back", /\/login\?redirect=%2Fapply%2F/.test(page.url()), page.url().replace(BASE, ""));
    await page.close();
  }

  /* the browser refuses an empty form */
  {
    const page = await applicant.context.newPage();
    let posted = 0;
    page.on("request", (r) => { if (/\/api\/applications\/submit/.test(r.url())) posted += 1; });
    await page.goto(`${BASE}/apply/${role}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3000);
    await agree(page);
    await page.click("form button[type='submit']");
    await page.waitForTimeout(1200);
    check(role, "browser refuses an empty form", posted === 0 && (await page.evaluate(() => !document.querySelector("form").checkValidity())), `posted=${posted}`);
    await page.close();
  }

  /* the server refuses what the browser would have */
  {
    const missing = await call(applicant, "/api/applications/submit", {
      method: "POST",
      body: JSON.stringify({ role, values: { fullName: "x" }, agreementAccepted: true }),
    });
    check(role, "server refuses missing required fields", missing.status === 400 && /^Missing required fields/.test(missing.body?.error ?? ""), `${missing.status} ${missing.body?.error}`);
    const noAgreement = await call(applicant, "/api/applications/submit", {
      method: "POST",
      body: JSON.stringify({ role, values: {}, agreementAccepted: false }),
    });
    check(role, "server refuses an unaccepted agreement", noAgreement.status === 400, `${noAgreement.status} ${noAgreement.body?.error}`);
    const unsigned = await fetch(`${BASE}/api/applications/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    check(role, "server refuses a signed-out submission", unsigned.status === 401, `${unsigned.status}`);
  }

  /* a real submission, with documents */
  const first = await submitThroughForm(role);
  const stored = storedAnswers(role);
  const row = stored?.row;
  const number = first.screen.number;
  check(role, "submission reaches its table", Boolean(row) && first.submitted?.status === 200,
    `http=${first.submitted?.status} status=${row?.status} ${first.submitted?.body?.error ?? ""}`);
  check(role, "the number shown is the server's", Boolean(number) && number === first.submitted?.body?.number, `screen=${number} server=${first.submitted?.body?.number}`);

  // Every field the form has, kept exactly.
  const lost = [];
  const fileNamesKept = [];
  for (const [name, value] of Object.entries(first.typed)) {
    if (typeof value === "object") {
      if (stored?.answers?.[name] != null) fileNamesKept.push(name);
      continue;
    }
    let got = stored?.answers?.[name];
    if (role === "influencer" && !stored?.row?.application && (name === "city" || name === "state")) got = stored?.answers?.region?.includes(value) ? value : null;
    if (got == null || String(got) !== String(value)) lost.push(`${name}(${got})`);
  }
  check(role, "every form field is kept", lost.length === 0, lost.length ? `lost: ${lost.join(", ")}` : `${Object.keys(first.typed).length} fields`);
  const formKeys = first.fields.map((f) => f.id.slice(2));
  const asked = ["accountHolder", "accountNumber", "ifsc", "bankName", "upi", "idNumber"].filter((k) => formKeys.includes(k));
  check(role, "the form asks for no bank details or ID number", asked.length === 0, asked.join(", ") || "none asked");
  check(role, "no file name is stored as a value", fileNamesKept.length === 0, fileNamesKept.join(", ") || "none");

  // Documents: real files, recorded, and the same bytes come back.
  const fileFields = Object.entries(first.typed).filter(([, v]) => typeof v === "object");
  const docs = json(sql(`select coalesce(json_agg(row_to_json(d)), '[]') from (select id, field, mime_type, size_bytes, sha256, storage_path from application_documents where owner_user_id='${applicantId}' and uploaded_at > '${STARTED}') d`)) ?? [];
  check(role, "each document is uploaded and recorded", docs.length === fileFields.length && first.screen.documents.every((d) => d.ok), `records=${docs.length} of ${fileFields.length}; screen=${first.screen.documents.filter((d) => d.ok).length} ok`);
  const hashesMatch = docs.every((d) => d.sha256 === first.typed[d.field]?.sha);
  check(role, "stored documents are the files that were chosen", hashesMatch && docs.length > 0, docs.map((d) => `${d.field}:${d.mime_type}`).join(" "));
  if (docs[0]) {
    const own = await call(applicant, `/api/applications/documents?id=${docs[0].id}`);
    const ownBytes = Buffer.from(await (await fetch(`${BASE}/api/applications/documents?id=${docs[0].id}`, { headers: { Authorization: `Bearer ${applicant.token}` } })).arrayBuffer());
    check(role, "the applicant can open their document", own.status === 200 && sha(ownBytes) === docs[0].sha256, `${own.status}`);
    const staffBytes = await fetch(`${BASE}/api/applications/documents?id=${docs[0].id}`, { headers: { Authorization: `Bearer ${operator.token}` } });
    check(role, "application staff can open it", staffBytes.status === 200 && staffBytes.headers.get("cache-control")?.includes("no-store"), `${staffBytes.status} ${staffBytes.headers.get("content-type")}`);
    const stranger = await call(outsider, `/api/applications/documents?id=${docs[0].id}`);
    check(role, "anyone else is refused", stranger.status === 403, `${stranger.status}`);
    const anonymous = await fetch(`${BASE}/api/applications/documents?id=${docs[0].id}`);
    check(role, "a signed-out request is refused", anonymous.status === 401, `${anonymous.status}`);
  }

  // A file that is not what it says it is, sent straight to the server.
  if (row) {
    const form = new FormData();
    form.set("kind", role);
    form.set("applicationId", row.id);
    form.set("field", fileFields[0]?.[0] ?? "idDocument");
    form.set("file", new Blob([Buffer.from("MZ\x90\x00 this is not a pdf")], { type: "application/pdf" }), "passport.pdf");
    const bad = await call(applicant, "/api/applications/documents", { method: "POST", body: form });
    check(role, "a disguised file is refused by its content", bad.status === 415, `${bad.status} ${bad.body?.error}`);
    const huge = new FormData();
    huge.set("kind", role);
    huge.set("applicationId", row.id);
    huge.set("field", fileFields[0]?.[0] ?? "idDocument");
    huge.set("file", new Blob([Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)])], { type: "application/pdf" }), "big.pdf");
    const big = await call(applicant, "/api/applications/documents", { method: "POST", body: huge });
    check(role, "a file over 5 MB is refused", big.status === 413, `${big.status}`);
    const foreign = new FormData();
    foreign.set("kind", role);
    foreign.set("applicationId", row.id);
    foreign.set("field", fileFields[0]?.[0] ?? "idDocument");
    foreign.set("file", new Blob([PDF], { type: "application/pdf" }), "x.pdf");
    const notMine = await call(outsider, "/api/applications/documents", { method: "POST", body: foreign });
    check(role, "nobody else can attach to it", notMine.status === 403, `${notMine.status}`);
  }

  /* the same person applying again */
  const again = await call(applicant, "/api/applications/submit", {
    method: "POST",
    body: JSON.stringify({ role, values: first.typed && Object.fromEntries(Object.entries(first.typed).filter(([, v]) => typeof v === "string")), agreementAccepted: true }),
  });
  const count = sql(`select count(*) from ${TABLES[role].table} where ${TABLES[role].owner}='${applicantId}'`);
  check(role, "applying twice keeps one application", again.body?.duplicate === true && again.body?.number === number && count === "1", `rows=${count} duplicate=${again.body?.duplicate}`);

  /* the Control Panel */
  const listed = await queueRow(role, number, "open");
  const everyKind = await call(operator, `/api/applications/queue?kind=all&filter=open`);
  check(role, "in the Control Panel queue (its kind and all kinds)", Boolean(listed) && (everyKind.body?.rows ?? []).some((r) => r.number === number), `status=${listed?.status} actions=${listed?.actions?.join("/")}`);
  const outsiderQueue = await call(outsider, `/api/applications/queue?kind=all`);
  check(role, "non-staff cannot read the queue", outsiderQueue.status === 403, `${outsiderQueue.status}`);

  const detail = listed ? await call(operator, `/api/applications/queue?kind=${role}&id=${listed.id}`) : null;
  const fields = (detail?.body?.application?.sections ?? []).flatMap((s) => s.fields);
  const missingInDetail = Object.entries(first.typed)
    .filter(([, v]) => typeof v === "string")
    .filter(([name]) => !fields.some((f) => f.key === name && f.value))
    .map(([name]) => name);
  check(role, "detail shows every submitted field", missingInDetail.length === 0, missingInDetail.join(", ") || `${fields.length} fields`);
  check(role, "documents are listed in the detail", (detail?.body?.application?.documents ?? []).length === fileFields.length, `${(detail?.body?.application?.documents ?? []).length}`);


  /* the screen itself: the Application Manager in a browser */
  {
    const page = await operator.context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
    await page.goto(`${BASE}/application-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(`[data-application="${number}"]`, { timeout: 45_000 }).catch(() => null);
    const item = page.locator(`[data-application="${number}"]`);
    const shown = await item.count();
    if (shown) {
      await item.locator("[data-details]").click();
      await page.waitForSelector(`[data-application-detail="${number}"]`, { timeout: 30_000 }).catch(() => null);
    }
    const panel = shown ? await item.innerText() : "";
    check(role, "Application Manager shows it and its details", shown === 1 && panel.includes(String(first.typed.fullName)), `shown=${shown} errors=${errors.length}`);
    await page.close();
  }

  /* decisions */
  if (listed) {
    const noReason = await decide(role, listed.id, "rejected", null);
    check(role, "a refusal without a reason is refused", noReason.status === 400, `${noReason.status} ${noReason.body?.error}`);
    const reason = `${STAMP} test refusal`;
    const rejected = await decide(role, listed.id, "rejected", reason);
    const afterReject = await queueRow(role, number);
    const detailAfter = await call(operator, `/api/applications/queue?kind=${role}&id=${listed.id}`);
    const notice = sql(`select count(*) from user_notifications where user_id='${applicantId}' and created_at > '${STARTED}' and message ilike '%${STAMP} test refusal%'`);
    check(role, "rejected with its reason, and the applicant told", rejected.status === 200 && afterReject?.status === "rejected" && detailAfter.body?.application?.reason === reason && Number(notice) >= 1,
      `${rejected.status} status=${afterReject?.status} reason=${detailAfter.body?.application?.reason ? "kept" : "missing"} notice=${notice}`);
    const dbStatus = sql(`select status from ${TABLES[role].table} where id='${listed.id}'`);
    check(role, "the refusal is in the database", dbStatus === "rejected", dbStatus);
    const twice = await decide(role, listed.id, APPROVED[role], null);
    check(role, "a refusal is final", twice.status === 409 || twice.status === 400, `${twice.status}`);
    const applicantView = await call(applicant, "/api/applications/submit", {
      method: "POST",
      body: JSON.stringify({ role, values: Object.fromEntries(Object.entries(first.typed).filter(([, v]) => typeof v === "string")), agreementAccepted: true }),
    });
    if (REAPPLY_AFTER_REFUSAL.has(role)) {
      // A new application, and the refused one kept as it was.
      const oldStatus = sql(`select status from ${TABLES[role].table} where id='${listed.id}'`);
      check(role, "after a refusal, applying again opens a new application", applicantView.body?.status === "pending" && applicantView.body?.number !== number && oldStatus === "rejected",
        `new=${applicantView.body?.number} (${applicantView.body?.status}) old=${oldStatus}`);
    } else {
      check(role, "the applicant sees the rejection", applicantView.body?.status === "rejected", `status=${applicantView.body?.status}`);
    }

    // A reload of the screen shows what the database holds.
    const page = await operator.context.newPage();
    await page.goto(`${BASE}/application-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(4000);
    await page.selectOption("select >> nth=1", "all").catch(() => undefined);
    await page.waitForSelector(`[data-application="${number}"]`, { timeout: 45_000 }).catch(() => null);
    const persisted = await page.locator(`[data-application="${number}"]`).getAttribute("data-application-status").catch(() => null);
    check(role, "after a reload the screen shows the refusal", persisted === "rejected", String(persisted));
    await page.close();
  }

  /* approval, and suspension, on a fresh application */
  await cleanRole(role);
  const second = await submitThroughForm(role, { files: false });
  const listed2 = await queueRow(role, second.screen.number, "open");
  if (listed2) {
    if (listed2.actions.includes("in_review")) {
      const review = await decide(role, listed2.id, "in_review", null);
      check(role, "moved into review", review.status === 200 && (await queueRow(role, second.screen.number))?.status === "in_review", `${review.status}`);
    }
    const approved = await decide(role, listed2.id, APPROVED[role], null);
    const dbStatus = sql(`select status from ${TABLES[role].table} where id='${listed2.id}'`);
    check(role, "approved, in the database", approved.status === 200 && dbStatus === APPROVED[role], `${approved.status} ${dbStatus} ${approved.body?.error ?? ""}`);
    if (role === "vendor" || role === "author") {
      const rate = sql(`select rate_percent from marketplace_commission_rules where seller_id='${listed2.id}' and product_id is null and category_id is null`);
      check(role, "the agreed commission is attached on approval", rate !== "" && rate !== "NULL", `rate=${rate}`);
    }
    if (SUSPENDABLE.has(role)) {
      const noReason = await decide(role, listed2.id, "suspended", null);
      const suspended = await decide(role, listed2.id, "suspended", `${STAMP} test suspension`);
      const after = sql(`select status from ${TABLES[role].table} where id='${listed2.id}'`);
      check(role, "suspended only with a reason", noReason.status === 400 && suspended.status === 200 && after === "suspended", `${noReason.status}/${suspended.status} ${after}`);
    }
  } else {
    check(role, "a second application for approval", false, "not listed");
  }
  await cleanRole(role);
}

/* ---------------------- an influencer who leaves the optional rate empty, or words it */
if (!ONLY.length || ONLY.includes("influencer")) {
  const base = {
    fullName: `${STAMP} Rate`, email: "sv-e2e-rate@example.com", phone: "+91 90000 12345", country: "India",
    followers: "1200", niche: `${STAMP} niche`, rateCard: "100", idType: "PAN",
  };
  for (const [label, engagementRate] of [["empty", ""], ["in words", "4-5%"]]) {
    await cleanRole("influencer");
    const r = await call(applicant, "/api/applications/submit", {
      method: "POST",
      body: JSON.stringify({ role: "influencer", values: { ...base, engagementRate }, agreementAccepted: true }),
    });
    const stored = json(sql(`select row_to_json(t) from (select engagement_rate, application->>'engagementRate' as typed from influencer_applications where applicant_user_id='${applicantId}') t`));
    const ok = r.status === 200 && stored && stored.engagement_rate === null && (engagementRate ? stored.typed === engagementRate : stored.typed == null);
    check("influencer", `an engagement rate left ${label} is accepted and kept as given`, ok, `${r.status} ${r.body?.error ?? ""} stored=${JSON.stringify(stored)}`);
  }
  await cleanRole("influencer");
}

/* ------------- the database itself keeps no bank details or ID number, however sent */
if (!ONLY.length || ONLY.includes("reseller")) {
  await cleanRole("reseller");
  const pub = {};
  for (const l of readFileSync(`${process.env.TEMP}/sv-public.env`, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) pub[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  // Straight to the database function, the way the old form did, with bank and ID fields.
  const direct = await fetch("https://softwarevala.net/rest/v1/rpc/submit_reseller_application", {
    method: "POST",
    headers: { apikey: pub.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${applicant.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_application: {
        fullName: `${STAMP} Direct`, email: "sv-e2e-direct@example.com", phone: "+91 90000 12345", country: "India",
        companyName: `${STAMP} Co`, businessType: "Retailer", agreementAccepted: true,
        accountHolder: "X", accountNumber: "123456789012", ifsc: "HDFC0001234", bankName: "HDFC", upi: "x@ok", idNumber: "ABCDE1234F",
      },
    }),
  });
  const kept = sql(`select coalesce(string_agg(k, ','), 'none') from resellers, jsonb_object_keys(application) k where user_id='${applicantId}' and k in ('accountHolder','accountNumber','ifsc','bankName','upi','idNumber')`);
  check("database", "bank details and ID numbers are not kept, however sent", direct.status === 200 && kept === "none", `${direct.status} kept=${kept}`);
  await cleanRole("reseller");
}

/* ------------------------------------------------ a vendor applies as an author */
{
  await cleanRole("vendor");
  const vendor = await submitThroughForm("vendor", { files: false });
  const author = await submitThroughForm("author");
  const rows = sql(`select string_agg(seller_kind || '/' || status, ',') from marketplace_sellers where owner_user_id='${applicantId}'`);
  const docs = sql(`select count(*) from application_documents where owner_user_id='${applicantId}' and uploaded_at > '${STARTED}'`);
  check("vendor>author", "the author form names the vendor application", author.screen.conflict && author.screen.number === vendor.screen.number && /vendor application/i.test(author.screen.text), `shown=${author.screen.number} vendor=${vendor.screen.number}`);
  check("vendor>author", "no second record, nothing attached to the vendor's", rows === "vendor/pending" && docs === "0" && author.uploads.length === 0, `rows=${rows} docs=${docs}`);
  await cleanRole("vendor");
}

/* ----------------------------------------------------- employee stays closed */
{
  const page = await applicant.context.newPage();
  await page.goto(`${BASE}/apply/employee`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);
  const closed = await page.evaluate(() => ({
    disabled: document.querySelector("form button[type='submit']")?.hasAttribute("disabled"),
    notice: Boolean(document.querySelector("[data-application-not-open]")),
  }));
  const server = await call(applicant, "/api/applications/submit", { method: "POST", body: JSON.stringify({ role: "employee", values: {}, agreementAccepted: true }) });
  check("employee", "closed on the page and on the server", closed.disabled && closed.notice && server.status === 403, `disabled=${closed.disabled} notice=${closed.notice} server=${server.status}`);
  await page.close();
}

/* -------------------------------------------- the role Managers show their own */
{
  await cleanRole("franchise");
  const f = await submitThroughForm("franchise", { files: false });
  const page = await operator.context.newPage();
  await page.goto(`${BASE}/franchise-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(8000);
  const tab = page.getByText(/^Applications$/).first();
  if (await tab.count()) {
    await tab.click().catch(() => undefined);
    await page.waitForTimeout(6000);
  }
  const seen = await page.locator(`[data-application="${f.screen.number}"]`).count();
  check("franchise", "the Franchise Manager's own queue shows it", seen === 1, `seen=${seen}`);
  await page.close();
  await cleanRole("franchise");
}

} catch (error) {
  check("run", "the run completed", false, String(error?.stack ?? error).slice(0, 300));
} finally {
  // Whatever happened above, nothing this run created is left behind.
  await browser.close().catch(() => undefined);
  for (const role of Object.keys(TABLES)) await cleanRole(role);
}
const left = sql(`select (select count(*) from application_documents where owner_user_id='${applicantId}') + (select count(*) from resellers where user_id='${applicantId}') + (select count(*) from marketplace_sellers where owner_user_id='${applicantId}') + (select count(*) from franchise_applications where applicant_user_id='${applicantId}') + (select count(*) from influencer_applications where applicant_user_id='${applicantId}') + (select count(*) from marketplace_affiliate_partners where user_id='${applicantId}')`);
const rolesAfter = sql(`select coalesce(string_agg(id::text, ','), '') from user_roles where user_id='${applicantId}'`);
check("cleanup", "every test row removed, the account as it was", left === "0" && rolesAfter === rolesBefore, `rows left=${left} roles same=${rolesAfter === rolesBefore}`);
writeFileSync(`${process.env.TEMP ?? "."}/apply-system-e2e.json`, JSON.stringify(results, null, 1));
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
