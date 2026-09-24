/**
 * Write the SEO and GEO blueprint onto every card slot.
 *
 * The blueprint belongs to the address, not to the tenant: the heading, the
 * title, the description, the search intents and the engines a country
 * actually uses stay the same whichever product is in the slot. Only
 * {category}, {country} and {product} are left as variables, filled when the
 * page renders, so a slot reads correctly while it is vacant as well.
 *
 * Nothing here invents a country fact. The engines and the free tools come
 * from the api_services registry and only where that registry says the service
 * covers the slot's country; "free" is written only for a service the registry
 * records as free or free-tier. No currency, tax rule or local regulation is
 * claimed, because the platform holds no verified source for any of them - the
 * gap is reported instead.
 *
 *   node scripts/ops/card-slots-blueprint.mjs           # dry run
 *   node scripts/ops/card-slots-blueprint.mjs --apply   # write the blueprint
 */
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 0 || line.trim().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}
const env = readEnv(".env.ops");
const BASE = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed in .env.ops");
  process.exit(1);
}
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function readAll(path) {
  const rows = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${BASE}/rest/v1/${path}`, {
      headers: { ...HEAD, Range: `${from}-${from + 999}` },
    });
    if (!res.ok)
      throw new Error(`${path} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
    from += 1000;
  }
}

// ------------------------------------------------------ the service registry
/** "South Korea", "south-korea" and "SouthKorea" are the same country. */
const key = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Case as the registry's own commonest spelling, so "google" and "Google" merge. */
function canonicalEngine(name) {
  const known = [
    "Google",
    "Bing",
    "Yandex",
    "Baidu",
    "Naver",
    "Brave Search",
    "DuckDuckGo",
    "Seznam",
    "Ecosia",
    "YouTube",
    "LinkedIn",
    "Facebook",
    "Instagram",
    "Pinterest",
    "Reddit",
    "TikTok",
    "Vimeo",
    "X",
  ];
  const match = known.find((k) => key(k) === key(name));
  return match ?? String(name);
}

const services = await readAll(
  "api_services?select=id,slug,name,category,status,approval_status,pricing_tier," +
    "supported_countries,supported_search_engines&order=slug.asc",
);

/**
 * Which services cover a country.
 *
 * "global" and "*" cover everywhere. Anything else has to name the country or
 * its ISO code. A value that names neither - "cis" is the one in the registry
 * today - is not expanded into a list of countries here, because guessing
 * which countries a bloc covers would be inventing a fact the registry has not
 * recorded. It is reported instead.
 */
const EVERYWHERE = new Set(["global", "*", "worldwide", "all"]);
const unmatchedScopes = new Set();
for (const service of services) {
  for (const scope of service.supported_countries ?? []) {
    if (EVERYWHERE.has(String(scope).toLowerCase())) continue;
    unmatchedScopes.add(String(scope));
  }
}

/** True when the registry records no country restriction for a service at all. */
const unrestricted = (service) => {
  const scopes = service.supported_countries ?? [];
  return scopes.length === 0 || scopes.some((s) => EVERYWHERE.has(String(s).toLowerCase()));
};

/** True when the registry names this country, and not merely "everywhere". */
function namesCountry(service, country, code) {
  const wanted = new Set([key(country), key(code)].filter(Boolean));
  return (service.supported_countries ?? []).some(
    (s) => !EVERYWHERE.has(String(s).toLowerCase()) && wanted.has(key(s)),
  );
}

function servicesFor(country, code) {
  return services.filter((s) => unrestricted(s) || namesCountry(s, country, code));
}

/**
 * The engines a card can actually reach from this country.
 *
 * Two sources, both evidence rather than assumption:
 *
 *   - a service the registry marks active, which is a submission route that
 *     has been proven to work - IndexNow is the one today, and it really does
 *     reach Bing, Yandex, Naver, Seznam and Ecosia from anywhere;
 *   - a service whose scope names this country, which is how Baidu belongs to
 *     China and Naver to South Korea.
 *
 * What is deliberately NOT used is the engine list of a globally scoped tool.
 * SerpAPI and DataForSEO both list Baidu and Yandex, but that says the tool can
 * query them, not that they matter in Angola. Reading it the other way is how
 * every country ends up with the same meaningless list.
 */
function enginesFor(country, code) {
  const engines = new Set();
  for (const service of services) {
    const active = service.status === "active";
    const local = namesCountry(service, country, code);
    if (!active && !local) continue;
    for (const engine of service.supported_search_engines ?? []) {
      engines.add(canonicalEngine(engine));
    }
  }
  return [...engines].sort();
}

const FREE = new Set(["free", "free-tier"]);
/**
 * Which of the registry's categories belong on a card. A card's blueprint is
 * about being found and about generating its content, so payment, messaging
 * and infrastructure services are not mapped onto it even when they are free.
 */
const SLOT_CATEGORIES = (category) => {
  const name = String(category ?? "");
  return (
    name.startsWith("seo") || name === "ai" || name === "business-local" || name === "analytics"
  );
};

// ------------------------------------------------------------- the blueprint
/** A category name reads badly inside a phrase when it carries a slash or an ampersand. */
function subject(name) {
  return String(name)
    .replace(/\s*\/\s*/g, " and ")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The search intents a card is written for.
 *
 * Eight groups of five, all of them phrases a buyer types, all naming the
 * country. They are search terms, not claims about a product: nothing here
 * asserts a price, a rating or a capability.
 */
function keywordSet(category, country) {
  const c = subject(category).toLowerCase();
  const n = country;
  return [
    `${c} software ${n}`,
    `${c} system ${n}`,
    `${c} software for ${n} businesses`,
    `${c} management software ${n}`,
    `${c} solution ${n}`,

    `buy ${c} software ${n}`,
    `${c} software price ${n}`,
    `${c} software cost ${n}`,
    `affordable ${c} software ${n}`,
    `${c} software one time payment ${n}`,

    `best ${c} software ${n}`,
    `top ${c} software ${n}`,
    `${c} software comparison ${n}`,
    `${c} software reviews ${n}`,
    `${c} software list ${n}`,

    `${c} software demo ${n}`,
    `free ${c} software trial ${n}`,
    `${c} software free demo ${n}`,
    `try ${c} software ${n}`,
    `${c} software online demo ${n}`,

    `${c} software company ${n}`,
    `${c} software provider ${n}`,
    `${c} software vendor ${n}`,
    `${c} software developer ${n}`,
    `local ${c} software ${n}`,

    `${c} software with source code ${n}`,
    `ready made ${c} software ${n}`,
    `custom ${c} software ${n}`,
    `white label ${c} software ${n}`,
    `${c} software installation ${n}`,

    `cloud ${c} software ${n}`,
    `on premise ${c} software ${n}`,
    `web based ${c} software ${n}`,
    `${c} software integration ${n}`,
    `${c} software api ${n}`,

    `${c} software for small business ${n}`,
    `${c} software for enterprise ${n}`,
    `${c} software for startups ${n}`,
    `${c} automation software ${n}`,
    `${c} software support ${n}`,
  ];
}

const H2 = [
  "Best {category} Software for {country} Businesses",
  "What {country} Businesses Need From {category} Software",
  "Features and Modules",
  "Pricing in {country}",
  "Local Implementation and Support in {country}",
  "Search and Discovery in {country}",
  "Integrations and Source Code",
  "Frequently Asked Questions",
];

const SCHEMA = ["BreadcrumbList", "SoftwareApplication", "FAQPage"];

/**
 * The questions this page can answer truthfully.
 *
 * Every answer is a fact about the platform or about the slot itself. Nothing
 * asserts a local tax rule, a currency, an office or a regulation, because the
 * platform records none of those, and a confident answer about one would be
 * invented.
 */
function faqSet(category, country) {
  const c = subject(category);
  return [
    {
      question: `Is ${c.toLowerCase()} software available for businesses in ${country}?`,
      answer:
        `Yes. This page is the ${country} card of the ${c} row on Software Vala, and it ` +
        `shows whichever ${c.toLowerCase()} product is currently published for ${country}. ` +
        `If the card is empty, no product is published for ${country} in this category yet.`,
    },
    {
      question: `How much does ${c.toLowerCase()} software cost in ${country}?`,
      answer:
        `The price of the product currently in this card is shown on this page, exactly as ` +
        `the catalogue records it. Software Vala sells a one-time lifetime licence rather ` +
        `than a subscription.`,
    },
    {
      question: `Can I see a live demo before buying?`,
      answer:
        `This page says whether the product currently listed has a live demo. Where one ` +
        `exists it is opened from the product's own page after you sign in.`,
    },
    {
      question: `Do I get the source code?`,
      answer:
        `Software Vala lists ready-to-deploy software with full source code and a one-time ` +
        `lifetime licence. What a specific product includes is recorded on that product's page.`,
    },
    {
      question: `What happens to this page if the product changes?`,
      answer:
        `Nothing moves. This address belongs to the ${c} card for ${country}, not to any one ` +
        `product. If a different ${c.toLowerCase()} product is published for ${country}, it ` +
        `appears here and the page keeps its URL.`,
    },
  ];
}

// -------------------------------------------------------------------- build
const slots = await readAll(
  "marketplace_card_slots?select=id,category_id,slot_no,country_marker,country_code,region,slot_url," +
    "marketplace_categories(name,slug)&order=slot_url.asc",
);
console.log(`slots read : ${slots.length}`);
console.log(`services   : ${services.length}`);

const engineCache = new Map();
const toolCache = new Map();
const perCountry = new Map();

const updates = slots.map((slot) => {
  const category = (slot.marketplace_categories ?? {}).name ?? "";
  const country = slot.country_marker;
  const code = slot.country_code;

  if (!engineCache.has(country)) {
    const covering = servicesFor(country, code).filter((s) => SLOT_CATEGORIES(s.category));
    const free = covering.filter((s) => FREE.has(String(s.pricing_tier ?? "").toLowerCase()));
    const engines = enginesFor(country, code);
    engineCache.set(country, engines);
    toolCache.set(
      country,
      free.map((s) => s.id),
    );
    perCountry.set(country, {
      covering: covering.length,
      free: free.length,
      active: covering.filter((s) => s.status === "active").length,
      approved: covering.filter((s) => s.approval_status === "approved").length,
      local: services.filter((s) => namesCountry(s, country, code)).map((s) => s.slug),
      engines,
    });
  }

  const subjectName = subject(category);
  return {
    id: slot.id,
    // The address is repeated unchanged because an upsert has to satisfy the
    // table's NOT NULL columns before it can find the row to update. The
    // tenant columns - current_product_id, status, occupied_since - are left
    // out on purpose, so writing a blueprint can never move a product.
    category_id: slot.category_id,
    slot_no: slot.slot_no,
    country_marker: slot.country_marker,
    country_code: slot.country_code,
    region: slot.region,
    slot_url: slot.slot_url,

    slot_title: `${subjectName} Software in ${country}`,
    business_type: subjectName,
    software_type: subjectName,
    h1_template: "{category} Software in {country}",
    h2_templates: H2,
    meta_title_template: "{category} Software in {country} | Price, Demo & Source Code",
    meta_description_template:
      "{category} software for businesses in {country}. One-time lifetime licence, full " +
      "source code and a live demo on Software Vala.",
    primary_keyword: `${subjectName.toLowerCase()} software ${country.toLowerCase()}`,
    keyword_set: keywordSet(category, country),
    schema_types: SCHEMA,
    faq_set: faqSet(category, country),
    search_engines: engineCache.get(country),
    free_tool_ids: toolCache.get(country),
    indexnow_enabled: true,
  };
});

// ------------------------------------------------------------------ report
const sample = perCountry.get(slots[0]?.country_marker);
console.log("");
console.log(`rows to write        : ${updates.length}`);
console.log(`intents per card     : ${updates[0]?.keyword_set.length}`);
console.log(`H2 sections per card : ${H2.length}`);
console.log(`FAQ entries per card : ${updates[0]?.faq_set.length}`);
console.log("");
console.log("engines and free tools per country (registry-derived):");
const named = [...perCountry].filter(([, info]) => info.local.length);
for (const [country, info] of [...named, ...[...perCountry].slice(0, 3)]) {
  console.log(
    `  ${country.padEnd(16)} seo/ai services ${String(info.covering).padStart(3)}` +
      ` | free ${String(info.free).padStart(3)}` +
      ` | active ${String(info.active).padStart(2)}` +
      ` | country-named ${info.local.join(",") || "none"}` +
      ` | engines ${info.engines.join(", ")}`,
  );
}
const counts = [...perCountry.values()];
console.log(
  `  ... ${perCountry.size} countries, free-tool count ` +
    `${Math.min(...counts.map((c) => c.free))}-${Math.max(...counts.map((c) => c.free))}, ` +
    `active ${Math.min(...counts.map((c) => c.active))}-${Math.max(...counts.map((c) => c.active))}`,
);
console.log("");
console.log(`registry scopes not matched to a rail country: ${[...unmatchedScopes].join(", ")}`);
console.log(
  "NOT WRITTEN, no verified source on this platform: currency, tax or invoicing rules, " +
    "local regulations, local offices, review counts, ratings.",
);
void sample;

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. First card:");
  const first = updates[0];
  console.log(`  ${slots[0].slot_url}`);
  console.log(`  title    : ${first.meta_title_template}`);
  console.log(`  keyword  : ${first.primary_keyword}`);
  console.log(`  intents  : ${first.keyword_set.slice(0, 3).join(" | ")} ...`);
  console.log(`  engines  : ${first.search_engines.join(", ")}`);
  console.log(`  free ids : ${first.free_tool_ids.length}`);
  console.log("\nRe-run with --apply to write the blueprint.");
  process.exit(0);
}

let written = 0;
for (let at = 0; at < updates.length; at += 150) {
  const batch = updates.slice(at, at + 150);
  const res = await fetch(`${BASE}/rest/v1/marketplace_card_slots?on_conflict=id`, {
    method: "POST",
    headers: {
      ...HEAD,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    console.error(`\nbatch at ${at} failed — HTTP ${res.status}`);
    console.error((await res.text()).slice(0, 600));
    process.exit(1);
  }
  written += batch.length;
  if (written % 1000 === 0 || written === updates.length) {
    console.log(`  written ${written}/${updates.length}`);
  }
}
console.log("\ndone");
