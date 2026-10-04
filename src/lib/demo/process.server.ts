import { aiComplete } from "@/lib/ai-gateway.server";
import { catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { parseStructured } from "@/lib/ai/content-provider";
import {
  applyPresentation,
  cleanBundle,
  evidenceCorpus,
  extractEvidence,
  hasStarterApp,
  hasBrandFavicon,
  remainingViolations,
  remainingBundleViolations,
  type Evidence,
  type PresentationRules,
} from "./presentation";
import { safeFetch, UnsafeUrlError } from "./safe-fetch.server";
import { canonicalFrom, demoIdentity, findByIdentity } from "./identity";
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
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  return {
    async get<T = Row[]>(path: string): Promise<T> {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers });
      if (!r.ok)
        throw new Error(`Database read failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      return (await r.json()) as T;
    },
    async post(table: string, body: unknown): Promise<Row> {
      const r = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok)
        throw new Error(`Database write failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      return ((await r.json()) as Row[])[0];
    },
    async patch(path: string, body: unknown): Promise<Row> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok)
        throw new Error(`Database write failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
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
    throw new Error(
      `The demo address returned ${page.contentType || "no content type"}, not a web page.`,
    );
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
   Public site-wide footer/header contact details and "Contact us" phone/email are vendor-facing
   contacts to replace with Software Vala. Form placeholders, login accounts, student/patient
   records and example users are application data to keep. Use the contact_contexts snippets to
   distinguish the two; do not treat a login placeholder as the developer's email.

Copy every value exactly as it appears in the evidence, character for character. Do not add values that are not in the evidence.

Keep the answer short. A demo is full of ordinary interface text and listing every
piece of it with a reason costs more than it is worth: at most 30 entries in
"kept", at most 20 in each of the other lists, and every "reason" in ten words or
fewer. List the clearest cases; a value you do not list is kept by default.

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
    .map((v) => ({
      value: v.value.trim(),
      kind: v.kind,
      reason: String(v.reason ?? "").slice(0, 200),
    }));
}

function evidenceForPrompt(e: Evidence, sources: string[]) {
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
    protected_application_values: e.protectedValues
      .slice(0, 40)
      .map((value) => value.slice(0, 160)),
    contact_contexts: [...e.emails, ...e.phones, ...e.whatsapp].map((value) => {
      const source = sources.find((text) => text.includes(value)) ?? "";
      const at = source.indexOf(value);
      return {
        value,
        context: at < 0 ? "" : source.slice(Math.max(0, at - 400), at + value.length + 400),
      };
    }),
    interface_strings: e.strings.slice(0, 200).map((s) => s.slice(0, 300)),
  };
}

/**
 * Take in a demo address without scanning it.
 *
 * investigateDemo does four things in order: work out whether this address is
 * a demo already known, put a row there to hold the outcome, fetch the page,
 * and ask the AI Manager about it. Only the last two are expensive, and only
 * the last two need the site to be up. Submitting a thousand demos should not
 * mean a thousand fetches and a thousand model calls held open on one request.
 *
 * So this is the first half on its own: normalise, decide whether it is
 * already known, and leave the row at 'unprocessed'. The Demo Scanner Worker
 * already queues exactly those, so nothing here enqueues anything - the two
 * would then be deciding the same thing and could disagree about it.
 *
 * The identity rules are not reimplemented. They are the same demoIdentity and
 * findByIdentity the interactive path uses, for the reason they exist: the
 * same demo arrives as http and https, with and without a trailing slash and
 * with a utm_ tail, and each of those used to become its own row with its own
 * investigation and its own AI spend.
 */
export async function intakeDemo(input: { productId: string; url: string; actor: Actor }) {
  const store = db();
  const [product] = await store.get<Row[]>(
    `marketplace_products?select=id,name,slug&id=eq.${encodeURIComponent(input.productId)}&limit=1`,
  );
  if (!product) throw new UnsafeUrlError("That product does not exist.");

  const existing = await store.get<Row[]>(
    `product_demo_urls?select=${DEMO_ROW_FIELDS}&product_id=eq.${product.id}&order=sort_order.asc`,
  );
  const same = findByIdentity(existing as { url?: string | null }[], input.url) as Row | undefined;

  // A demo already known is reported as known, and left exactly as it is. Its
  // state is the record of what has already happened to it: re-queueing a live
  // demo for another scan would spend on an answer that is already stored, and
  // moving one back to 'unprocessed' would unpublish it.
  if (same) {
    await audit(String(same.id), "demo_url.intake", input.actor, {
      url: input.url,
      outcome: "already known",
      identity: demoIdentity(input.url),
    });
    return { duplicate: true, demo: same };
  }

  const lowest = existing.reduce((m, r) => Math.min(m, Number(r.sort_order ?? 0)), 1);
  const row = await store.post("product_demo_urls", {
    product_id: product.id,
    demo_name: String(product.name ?? "Demo"),
    role_name: "Demo",
    url: input.url,
    environment: "production",
    status: "inactive",
    sort_order: lowest - 1,
    processing_status: "unprocessed",
  });
  await audit(String(row.id), "demo_url.intake", input.actor, {
    url: input.url,
    outcome: "queued for scanning",
    identity: demoIdentity(input.url),
  });
  return { duplicate: false, demo: row };
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
  // By identity, not by string. The same demo arrives as http and https, with
  // and without a trailing slash, and with a utm_ tail on it; each of those
  // used to become its own row, with its own investigation and its own AI spend.
  const identity = demoIdentity(input.url);
  const same = findByIdentity(existing as { url?: string | null }[], input.url) as Row | undefined;
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
    // Fetch the address this demo is already known by, not the one just
    // typed. Identity has decided they are the same demo, and the stored one
    // is the form that has been reached before: a www. prefix that the
    // certificate does not cover, or a http form that only redirects, would
    // otherwise fail a check the demo itself would pass. The submitted form is
    // kept in the record either way.
    const target = String(row.url ?? input.url);
    const { page, bundles } = await fetchDemo(target);
    if (hasStarterApp(page.body, bundles)) {
      throw new Error(
        "The original demo contains an unbuilt starter landing page. Supply the completed application's URL; no replacement data was created.",
      );
    }
    // Where it actually landed. A demo submitted as http that redirects to
    // https is the same demo as one already stored under its destination, and
    // only a fetch can say so.
    const finalIdentity = canonicalFrom(page.url);
    const evidence = extractEvidence(page.body, page.url, bundles);
    const corpus = evidenceCorpus(page.body, bundles);

    const categories = await store.get<{ id: string; slug: string; name: string }[]>(
      "marketplace_categories?select=id,slug,name&is_hidden=eq.false&order=sort_order.asc",
    );
    const ai = await aiComplete({
      module: "demo-manager",
      serviceName: "OpenAI API",
      json: true,
      temperature: 0,
      // Raising this was the wrong instinct and the numbers said so: at 1,800
      // the answer was cut off, and at 4,000 it was cut off again having used
      // every token. The model fills whatever room it is given, because the
      // prompt asked it to justify every piece of ordinary interface text it
      // kept — a list the code then truncates to thirty anyway. The prompt
      // bounds the lists now, so the budget is back to something reasonable
      // with room to spare.
      maxTokens: 2500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            demo_address: page.url,
            marketplace_product: product.name,
            categories: categories.map((c) => `${c.slug}: ${c.name}`),
            evidence: evidenceForPrompt(evidence, [page.body, ...bundles]),
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
    const navigable = new Set(evidence.externalLinks.map((link) => link.href));
    const contactValues = new Set([...evidence.emails, ...evidence.phones, ...evidence.whatsapp]);
    const navigableFinding = (finding: Finding) => {
      if (navigable.has(finding.value)) return true;
      dropped.push({ value: finding.value, reason: "not a navigable external link" });
      return false;
    };
    const contacts = findings(answer.contacts_to_remove)
      .filter(present)
      .filter((finding) => {
        if (finding.kind === "link" || finding.kind === "whatsapp")
          return navigableFinding(finding);
        if (contactValues.has(finding.value)) return true;
        dropped.push({
          value: finding.value,
          reason: "application/form/vector data, not a public contact",
        });
        return false;
      });
    const branding = findings(answer.developer_branding).filter(present);
    const devLinks = findings(answer.developer_links).filter(present).filter(navigableFinding);
    const logos = findings(answer.logo_images).filter(
      (f) =>
        evidence.logos.includes(f.value) ||
        (dropped.push({ value: f.value, reason: "not a logo image in the demo" }), false),
    );
    const slug = String(answer.category_slug ?? "").trim();
    const category = categories.find((c) => c.slug === slug) ?? null;
    if (!category) dropped.push({ value: slug, reason: "not a marketplace category" });

    const rules: PresentationRules = {
      remove: contacts.filter((c) => c.kind !== "link").map((c) => c.value),
      rebrand: branding.map((b) => b.value),
      logos: logos.map((l) => l.value),
      links: [
        ...devLinks.map((l) => l.value),
        ...contacts.filter((c) => c.kind === "link" || c.kind === "whatsapp").map((c) => c.value),
      ],
    };
    const softwareName = String(answer.software_name ?? "")
      .trim()
      .slice(0, 120);
    const processing = {
      investigated_at: new Date().toISOString(),
      source: {
        url: input.url,
        fetched: target,
        final_url: page.url,
        canonical_url: finalIdentity,
        submitted_canonical: identity.canonical,
        canonical_notes: identity.notes,
        redirected_elsewhere: finalIdentity !== identity.canonical,
        http_status: page.status,
        redirects: page.redirects,
        bundles: bundles.length,
      },
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
      findings: {
        contacts,
        branding,
        developer_links: devLinks,
        logos,
        kept: findings(answer.kept).slice(0, 30),
        dropped,
      },
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
    const previous = same?.processing;
    const lastGoodProcessing =
      same?.status === "active" &&
      previous &&
      typeof previous === "object" &&
      !Array.isArray(previous)
        ? previous
        : {};
    row = await store.patch(`product_demo_urls?id=eq.${row.id}`, {
      processing_status: "failed",
      processing: {
        ...lastGoodProcessing,
        failed_at: new Date().toISOString(),
        stage: "investigate",
        error: message,
      },
      ...(same?.status === "active" ? {} : { status: "inactive" }),
    });
    await audit(String(row.id), "demo_url.investigate.failed", input.actor, { error: message });
    return row;
  }
}

/** Verify the presented demo and, only if it is clean, make it the product's live demo. */
export async function activateDemo(input: {
  id: string;
  actor: Actor;
  /**
   * An operator's explicit decision to publish a demo whose detected category
   * is not the category of the product it hangs on. Nothing else can set it,
   * and the reason is written into the audit trail.
   */
  confirmCategoryMismatch?: boolean;
}) {
  const store = db();
  const [row] = await store.get<Row[]>(
    `product_demo_urls?select=${DEMO_ROW_FIELDS}&id=eq.${encodeURIComponent(input.id)}&limit=1`,
  );
  if (!row) throw new UnsafeUrlError("That demo does not exist.");
  const processing = (row.processing ?? {}) as { rules?: PresentationRules } & Row;
  if (!["review", "live"].includes(String(row.processing_status)) || !processing.rules) {
    throw new UnsafeUrlError("Investigate this demo before activating it.");
  }

  /**
   * The canonical relationship, checked here rather than on a screen.
   *
   * A live demo is served to visitors by product: the proxy looks up
   * product_demo_urls by product_id, and the storefront badge comes from the
   * same row. So a demo with no product, or hanging on a product that no longer
   * exists, cannot be published at all - and a demo whose own detected category
   * is not the product's category is how admissionschool-desk came to show an
   * AnnadanamKitchen demo.
   *
   * Eight of the seventeen demos live today are in that state. They are left
   * exactly as they are - deactivating a working demo is not this function's
   * decision - but no further one can be published into it without an operator
   * saying so explicitly, and that decision is recorded.
   */
  if (!row.product_id) {
    throw new UnsafeUrlError(
      "This demo is not attached to a product, so it cannot be published. Assign a product first.",
    );
  }
  const [product] = await store.get<Row[]>(
    `marketplace_products?select=id,name,slug,category_id,visible,moderation_status` +
      `&id=eq.${encodeURIComponent(String(row.product_id))}&limit=1`,
  );
  if (!product) {
    throw new UnsafeUrlError(
      "The product this demo is attached to no longer exists. Re-assign it before publishing.",
    );
  }
  if (product.visible !== true || String(product.moderation_status) !== "approved") {
    throw new UnsafeUrlError(
      `"${String(product.name)}" is not published, so a demo on it would be reachable by address only. ` +
        "Publish the product first.",
    );
  }
  const detected = row.detected_category_id ? String(row.detected_category_id) : null;
  const productCategory = product.category_id ? String(product.category_id) : null;
  const categoryMismatch = Boolean(detected && productCategory && detected !== productCategory);
  if (categoryMismatch && !input.confirmCategoryMismatch) {
    const [detectedCategory] = await store.get<Row[]>(
      `marketplace_categories?select=name&id=eq.${encodeURIComponent(detected as string)}&limit=1`,
    );
    const [productCategoryRow] = await store.get<Row[]>(
      `marketplace_categories?select=name&id=eq.${encodeURIComponent(productCategory as string)}&limit=1`,
    );
    await audit(String(row.id), "demo_url.activate.category_blocked", input.actor, {
      detected_category_id: detected,
      product_category_id: productCategory,
      product_id: row.product_id,
    });
    throw new UnsafeUrlError(
      `This demo looks like ${String(detectedCategory?.name ?? "another category")} software, but ` +
        `"${String(product.name)}" is filed under ${String(productCategoryRow?.name ?? "a different category")}. ` +
        "Re-assign it to the right product, or confirm the mismatch to publish it anyway.",
    );
  }

  const rules = processing.rules;
  const checks: { check: string; ok: boolean; detail?: string }[] = [];
  let ok = false;
  try {
    const { page, bundles } = await fetchDemo(String(row.url));
    checks.push({ check: "demo answers", ok: true, detail: `HTTP ${page.status}` });
    const starterApp = hasStarterApp(page.body, bundles);
    checks.push({
      check: "real application",
      ok: !starterApp,
      detail: starterApp
        ? "The original source contains an unbuilt starter landing page."
        : undefined,
    });
    const presented = applyPresentation(page.body, rules, DEMO_BRAND);
    const favicon = hasBrandFavicon(presented, DEMO_BRAND.favicon);
    checks.push({ check: "Software Vala favicon", ok: favicon });
    const left = [
      ...new Set([
        ...remainingViolations(presented, rules),
        ...bundles.flatMap((bundle) =>
          remainingBundleViolations(cleanBundle(bundle, rules, DEMO_BRAND.name), rules),
        ),
      ]),
    ];
    checks.push({
      check: "developer contact and branding removed",
      ok: left.length === 0,
      detail: left.length ? `still present: ${left.join(", ")}` : undefined,
    });
    const script = presented.includes("data-sv-presentation");
    checks.push({ check: "presentation script installed", ok: script });
    ok = checks.every((c) => c.ok);
  } catch (error) {
    checks.push({
      check: "demo answers",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // The category decision is part of the record, so a demo published across a
  // mismatch can be found later and explained.
  const verification = {
    verified_at: new Date().toISOString(),
    ok,
    checks,
    ...(categoryMismatch ? { category_mismatch_confirmed_by: input.actor } : {}),
  };
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
  const lowest = siblings.reduce(
    (m, r) => Math.min(m, Number(r.sort_order ?? 0)),
    Number(row.sort_order ?? 0) + 1,
  );
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
  catalogueChanged();
  return updated;
}

export async function publishDemo(input: { productId: string; url: string; actor: Actor }) {
  const investigated = await investigateDemo(input);
  if (investigated.processing_status === "failed") {
    const processing = investigated.processing;
    const message =
      processing &&
      typeof processing === "object" &&
      "error" in processing &&
      typeof processing.error === "string"
        ? processing.error
        : "Demo investigation failed; publication was not attempted.";
    throw new Error(message);
  }
  const demo = await activateDemo({ id: String(investigated.id), actor: input.actor });
  if (demo.processing_status !== "live") {
    throw new Error(
      "Demo presentation verification failed. Its recorded checks must pass before publication.",
    );
  }
  const [product] = await db().get<Row[]>(
    `marketplace_products?select=slug&id=eq.${encodeURIComponent(input.productId)}&limit=1`,
  );
  if (!product?.slug) throw new Error("The published demo product could not be read.");
  return { demo, demoUrl: `/demo/${String(product.slug)}` };
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
