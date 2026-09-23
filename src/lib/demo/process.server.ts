import { aiComplete } from "@/lib/ai-gateway.server";
import { parseStructured } from "@/lib/ai/content-provider";
import {
  applyPresentation,
  evidenceCorpus,
  extractEvidence,
  hasBrandFavicon,
  remainingViolations,
  type Evidence,
  type PresentationRules,
} from "./presentation";
import { safeFetch, UnsafeUrlError } from "./safe-fetch.server";
import { DEMO_BRAND } from "./brand";

/**
 * The Demo Manager's processing of a submitted demo address.
 *
 *   investigate(product, url)
 *     fetch the page safely, collect the evidence, ask the AI Manager what the
 *     software is, which marketplace category it belongs to and which of the
 *     contact details and branding are the developer's; keep only answers that
 *     can be checked against the page; store the result on the product's
 *     demo row (status inactive, processing_status 'review').
 *
 *   activate(row)
 *     fetch the page again, apply the presentation, and check that it is
 *     clean - Software Vala favicon present, none of the removed details left.
 *     Only then does the row become status 'active', which is what the
 *     marketplace card's LIVE DEMO badge and the demo gateway read.
 *
 * Nothing here writes to the product itself. The product's own category,
 * name and content are the catalogue's; the category the investigation finds
 * is recorded on the demo row.
 */

type Row = Record<string, unknown>;

function db() {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The database is not configured on this server.");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    async get<T = Row[]>(path: string): Promise<T> {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers });
      if (!r.ok) throw new Error(`Database read failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      return (await r.json()) as T;
    },
    async post(table: string, body: unknown): Promise<Row> {
      const r = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Database write failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      return ((await r.json()) as Row[])[0];
    },
    async patch(path: string, body: unknown): Promise<Row> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Database write failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      return ((await r.json()) as Row[])[0];
    },
  };
}

export const DEMO_ROW_FIELDS =
  "id,product_id,demo_name,url,status,sort_order,processing_status,processing,processed_at,detected_category_id,updated_at";

async function audit(demoUrlId: string, action: string, actor: Actor, metadata: Row) {
  try {
    await db().post("demo_url_audit_log", {
      demo_url_id: demoUrlId,
      action,
      actor_id: actor.id,
      actor_email: actor.email,
      metadata,
    });
  } catch (error) {
    console.error("[demo-process] audit write failed", error);
  }
}

export type Actor = { id: string | null; email: string | null };

/** The page and the scripts it loads from its own host (a single-page app's words live there). */
async function fetchDemo(url: string) {
  const page = await safeFetch(url);
  if (page.status < 200 || page.status >= 300) {
    throw new Error(`The demo answered HTTP ${page.status}.`);
  }
  if (!/html/i.test(page.contentType)) {
    throw new Error(`The demo address returned ${page.contentType || "no content type"}, not a web page.`);
  }
  const base = new URL(page.url);
  const scripts = [...page.body.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => {
      try {
        return new URL(m[1], base);
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => Boolean(u) && u!.hostname === base.hostname)
    .slice(0, 3);
  const bundles: string[] = [];
  for (const script of scripts) {
    try {
      const js = await safeFetch(script.toString(), { maxBytes: 6_000_000, timeoutMs: 20_000 });
      if (js.status >= 200 && js.status < 300) bundles.push(js.body);
    } catch (error) {
      console.warn("[demo-process] bundle skipped", script.toString(), String(error));
    }
  }
  return { page, bundles };
}

const SYSTEM_PROMPT = `You prepare third-party software demos for the Software Vala marketplace.
A developer supplied a demo of their software. Software Vala will show it to buyers under the Software Vala brand.
You receive evidence extracted from the demo: page title, meta tags, favicons, logo images, e-mail addresses, phone numbers,
WhatsApp links, outside links, "developed by" credits and interface strings. You also receive the marketplace's category list.

Decide:
1. What the software is: its product name as shown in the demo, and a one-sentence summary.
2. The single best marketplace category, as a slug from the list. Never invent a slug.
3. Which evidence is the DEVELOPER's or a third party's presence that would let a buyer bypass Software Vala:
   the developer's or agency's own phone, WhatsApp, e-mail, website or social links, "developed by / powered by" credits,
   developer or agency names, and the developer's logo images.
4. Which evidence is ORDINARY APPLICATION DATA that belongs to the software's working demo content and must stay:
   sample customers, sample patients, sample students, sample orders, demo records, the software's own feature text.
   When unsure whether a value is developer contact or application data, keep it and say why.

Copy every value exactly as it appears in the evidence, character for character. Do not add values that are not in the evidence.
Answer with one JSON object only:
{
  "software_name": string,
  "summary": string,
  "category_slug": string,
  "category_reason": string,
  "confidence": number between 0 and 1,
  "contacts_to_remove": [{"value": string, "kind": "email"|"phone"|"whatsapp"|"link", "reason": string}],
  "developer_branding": [{"value": string, "kind": "name"|"credit", "reason": string}],
  "developer_links": [{"value": string, "reason": string}],
  "logo_images": [{"value": string, "reason": string}],
  "kept": [{"value": string, "reason": string}]
}`;

type Finding = { value: string; kind?: string; reason?: string };

function findings(value: unknown): Finding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v && typeof v === "object" ? (v as Finding) : null))
    .filter((v): v is Finding => Boolean(v && typeof v.value === "string" && v.value.trim()))
    .map((v) => ({ value: v.value.trim(), kind: v.kind, reason: String(v.reason ?? "").slice(0, 200) }));
}

function evidenceForPrompt(e: Evidence) {
  return {
    title: e.title,
    meta: e.meta,
    favicons: e.favicons,
    logo_images: e.logos,
    emails: e.emails,
    phones: e.phones,
    whatsapp: e.whatsapp,
    outside_links: e.externalLinks.slice(0, 30),
    credits: e.credits,
    interface_strings: e.strings.slice(0, 200).map((s) => s.slice(0, 300)),
  };
}

export async function investigateDemo(input: { productId: string; url: string; actor: Actor }) {
  const store = db();
  const [product] = await store.get<Row[]>(
    `marketplace_products?select=id,name,slug,category_id&id=eq.${encodeURIComponent(input.productId)}&limit=1`,
  );
  if (!product) throw new UnsafeUrlError("That product does not exist.");

  // The row exists from the start, so a failed investigation is recorded as
  // failed rather than vanishing. It is inactive: nothing public reads it.
  const existing = await store.get<Row[]>(
    `product_demo_urls?select=${DEMO_ROW_FIELDS}&product_id=eq.${product.id}&order=sort_order.asc`,
  );
  const same = existing.find((r) => r.url === input.url);
  const lowest = existing.reduce((m, r) => Math.min(m, Number(r.sort_order ?? 0)), 1);
  let row: Row;
  if (same) {
    row = await store.patch(`product_demo_urls?id=eq.${same.id}`, {
      processing_status: "investigating",
      ...(same.status === "active" ? {} : { status: "inactive" }),
    });
  } else {
    row = await store.post("product_demo_urls", {
      product_id: product.id,
      demo_name: String(product.name ?? "Demo"),
      role_name: "Demo",
      url: input.url,
      environment: "production",
      status: "inactive",
      sort_order: lowest - 1,
      processing_status: "investigating",
    });
  }
  await audit(String(row.id), "demo_url.investigate.start", input.actor, { url: input.url });

  try {
    const { page, bundles } = await fetchDemo(input.url);
    const evidence = extractEvidence(page.body, page.url, bundles);
    const corpus = evidenceCorpus(page.body, bundles);

    const categories = await store.get<{ id: string; slug: string; name: string }[]>(
      "marketplace_categories?select=id,slug,name&is_hidden=eq.false&order=sort_order.asc",
    );
    const ai = await aiComplete({
      module: "demo-manager",
      json: true,
      temperature: 0,
      maxTokens: 1800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            demo_address: page.url,
            marketplace_product: product.name,
            categories: categories.map((c) => `${c.slug}: ${c.name}`),
            evidence: evidenceForPrompt(evidence),
          }),
        },
      ],
    });
    const answer = parseStructured(ai.text);
    if (!answer) throw new Error("The AI Manager's answer was not valid JSON.");

    // Keep only what can be checked: a value the page really contains, a
    // category that really exists. Anything else is recorded as dropped.
    const dropped: { value: string; reason: string }[] = [];
    const present = (f: Finding) => {
      if (corpus.includes(f.value)) return true;
      dropped.push({ value: f.value, reason: "not found in the demo" });
      return false;
    };
    const contacts = findings(answer.contacts_to_remove).filter(present);
    const branding = findings(answer.developer_branding).filter(present);
    const devLinks = findings(answer.developer_links).filter(present);
    const logos = findings(answer.logo_images).filter(
      (f) => evidence.logos.includes(f.value) || (dropped.push({ value: f.value, reason: "not a logo image in the demo" }), false),
    );
    const slug = String(answer.category_slug ?? "").trim();
    const category = categories.find((c) => c.slug === slug) ?? null;
    if (!category) dropped.push({ value: slug, reason: "not a marketplace category" });

    const rules: PresentationRules = {
      remove: contacts.filter((c) => c.kind !== "link").map((c) => c.value),
      rebrand: branding.map((b) => b.value),
      logos: logos.map((l) => l.value),
      links: [...devLinks.map((l) => l.value), ...contacts.filter((c) => c.kind === "link" || c.kind === "whatsapp").map((c) => c.value)],
    };
    const softwareName = String(answer.software_name ?? "").trim().slice(0, 120);
    const processing = {
      investigated_at: new Date().toISOString(),
      source: { url: input.url, final_url: page.url, http_status: page.status, redirects: page.redirects, bundles: bundles.length },
      ai: { service: ai.service, model: ai.model, module: "demo-manager" },
      identity: {
        software_name: softwareName || null,
        summary: String(answer.summary ?? "").slice(0, 400) || null,
        category_slug: category?.slug ?? null,
        category_name: category?.name ?? null,
        category_reason: String(answer.category_reason ?? "").slice(0, 300) || null,
        confidence: Number(answer.confidence) || null,
        product_category_matches: category ? category.id === product.category_id : null,
      },
      findings: { contacts, branding, developer_links: devLinks, logos, kept: findings(answer.kept).slice(0, 30), dropped },
      evidence: {
        title: evidence.title,
        favicons: evidence.favicons,
        logos: evidence.logos,
        emails: evidence.emails.length,
        phones: evidence.phones.length,
        whatsapp: evidence.whatsapp.length,
        outside_links: evidence.externalLinks.length,
        credits: evidence.credits,
      },
      rules,
    };
    row = await store.patch(`product_demo_urls?id=eq.${row.id}`, {
      processing_status: "review",
      processing,
      detected_category_id: category?.id ?? null,
      demo_name: softwareName || String(product.name ?? "Demo"),
    });
    await audit(String(row.id), "demo_url.investigate", input.actor, {
      ai: processing.ai,
      category: processing.identity.category_slug,
      removed: rules.remove.length + rules.links.length,
      rebranded: rules.rebrand.length,
      logos: rules.logos.length,
    });
    return row;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    row = await store.patch(`product_demo_urls?id=eq.${row.id}`, {
      processing_status: "failed",
      processing: { failed_at: new Date().toISOString(), stage: "investigate", error: message },
      ...(same?.status === "active" ? {} : { status: "inactive" }),
    });
    await audit(String(row.id), "demo_url.investigate.failed", input.actor, { error: message });
    return row;
  }
}

/** Verify the presented demo and, only if it is clean, make it the product's live demo. */
export async function activateDemo(input: { id: string; actor: Actor }) {
  const store = db();
  const [row] = await store.get<Row[]>(
    `product_demo_urls?select=${DEMO_ROW_FIELDS}&id=eq.${encodeURIComponent(input.id)}&limit=1`,
  );
  if (!row) throw new UnsafeUrlError("That demo does not exist.");
  const processing = (row.processing ?? {}) as { rules?: PresentationRules } & Row;
  if (!["review", "live"].includes(String(row.processing_status)) || !processing.rules) {
    throw new UnsafeUrlError("Investigate this demo before activating it.");
  }

  const checks: { check: string; ok: boolean; detail?: string }[] = [];
  let ok = false;
  try {
    const { page } = await fetchDemo(String(row.url));
    checks.push({ check: "demo answers", ok: true, detail: `HTTP ${page.status}` });
    const presented = applyPresentation(page.body, processing.rules, DEMO_BRAND);
    const favicon = hasBrandFavicon(presented, DEMO_BRAND.favicon);
    checks.push({ check: "Software Vala favicon", ok: favicon });
    const left = remainingViolations(presented, processing.rules);
    checks.push({
      check: "developer contact and branding removed",
      ok: left.length === 0,
      detail: left.length ? `still present: ${left.join(", ")}` : undefined,
    });
    const script = presented.includes("data-sv-presentation");
    checks.push({ check: "presentation script installed", ok: script });
    ok = checks.every((c) => c.ok);
  } catch (error) {
    checks.push({ check: "demo answers", ok: false, detail: error instanceof Error ? error.message : String(error) });
  }

  const verification = { verified_at: new Date().toISOString(), ok, checks };
  if (!ok) {
    const updated = await store.patch(`product_demo_urls?id=eq.${row.id}`, {
      processing_status: "failed",
      processing: { ...processing, verification },
      ...(row.processing_status === "live" ? {} : { status: "inactive" }),
    });
    await audit(String(row.id), "demo_url.activate.failed", input.actor, { checks });
    return updated;
  }

  // The processed demo is the one the proxy serves: it sorts first.
  const siblings = await store.get<Row[]>(
    `product_demo_urls?select=id,sort_order&product_id=eq.${row.product_id}&id=neq.${row.id}`,
  );
  const lowest = siblings.reduce((m, r) => Math.min(m, Number(r.sort_order ?? 0)), Number(row.sort_order ?? 0) + 1);
  const updated = await store.patch(`product_demo_urls?id=eq.${row.id}`, {
    status: "active",
    processing_status: "live",
    processed_at: verification.verified_at,
    processing: { ...processing, verification },
    sort_order: Math.min(Number(row.sort_order ?? 0), lowest - 1),
    last_checked_at: verification.verified_at,
    last_result: "working",
  });
  await audit(String(row.id), "demo_url.activate", input.actor, { checks });
  return updated;
}

/** Demos the Demo Manager has processed or is processing, newest first. */
export async function listProcessedDemos() {
  const rows = await db().get<Row[]>(
    `product_demo_urls?select=${DEMO_ROW_FIELDS},marketplace_products(name,slug)` +
      `&processing_status=neq.unprocessed&order=updated_at.desc&limit=50`,
  );
  // Operators see the source address (they submitted it); visitors never do.
  return rows;
}

export async function searchProducts(q: string) {
  const term = q.replace(/[%*,()]/g, " ").trim();
  if (term.length < 2) return [];
  return db().get<Row[]>(
    `marketplace_products?select=id,name,slug,category_id,marketplace_categories(name)` +
      `&name=ilike.*${encodeURIComponent(term)}*&order=name.asc&limit=20`,
  );
}
