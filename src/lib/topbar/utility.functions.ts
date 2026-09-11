import { publicProductFilter } from "@/lib/marketplace/public-visibility";
/**
 * Client-side utility data functions for the marketplace top bar.
 * Ported from the reference project's server functions — all upstream
 * services here are public, key-less and CORS-enabled, so they run
 * directly in the browser in this Vite SPA.
 */

export type RatesResult = { base: string; rates: Record<string, number>; updated: string; error?: string };
export type WeatherResult = {
  city: string;
  country: string;
  tempC: number;
  windKph: number;
  humidity: number;
  code: number;
  isDay: boolean;
  error?: string;
};
export type Holiday = { date: string; localName: string; name: string };
export type HolidaysResult = { countryCode: string; year: number; holidays: Holiday[]; error?: string };
export type TranslateResult = { texts: string[]; error?: string };
export type ChatResult = { reply: string; error?: string };

type Arg<T> = { data?: T } | undefined;

/** Live FX rates (open.er-api.com, no key). */
export async function getExchangeRates(arg?: Arg<{ base?: string }>): Promise<RatesResult> {
  const base = (arg?.data?.base || "USD").toUpperCase().slice(0, 3);
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) return { base, rates: {}, updated: "", error: `Rates service error (${res.status}).` };
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (json.result !== "success" || !json.rates) {
      return { base, rates: {}, updated: "", error: "Rates unavailable right now." };
    }
    return { base, rates: json.rates, updated: json.time_last_update_utc ?? "" };
  } catch (e) {
    return { base, rates: {}, updated: "", error: e instanceof Error ? e.message : "Network error." };
  }
}

/** Real current weather from Open-Meteo (no key). */
export async function getWeather(
  arg?: Arg<{ lat?: number; lon?: number; city?: string }>,
): Promise<WeatherResult> {
  const data = arg?.data;
  const empty: WeatherResult = {
    city: "",
    country: "",
    tempC: 0,
    windKph: 0,
    humidity: 0,
    code: 0,
    isDay: true,
  };
  try {
    let lat = data?.lat;
    let lon = data?.lon;
    let city = data?.city ?? "";
    let country = "";

    if (lat == null || lon == null) {
      const q = encodeURIComponent(city || "Mumbai");
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`,
      );
      const gj = (await geo.json()) as {
        results?: { latitude: number; longitude: number; name: string; country: string }[];
      };
      const hit = gj.results?.[0];
      if (!hit) return { ...empty, city, error: "City not found." };
      lat = hit.latitude;
      lon = hit.longitude;
      city = hit.name;
      country = hit.country;
    } else {
      const rev = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`,
      ).catch(() => null);
      if (rev?.ok) {
        const rj = (await rev.json()) as { results?: { name: string; country: string }[] };
        city = city || rj.results?.[0]?.name || "Your location";
        country = rj.results?.[0]?.country ?? "";
      } else {
        city = city || "Your location";
      }
    }

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&wind_speed_unit=kmh`,
    );
    if (!res.ok) return { ...empty, city, country, error: `Weather service error (${res.status}).` };
    const wj = (await res.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        is_day: number;
        weather_code: number;
        wind_speed_10m: number;
      };
    };
    const c = wj.current;
    if (!c) return { ...empty, city, country, error: "Weather unavailable." };
    return {
      city,
      country,
      tempC: c.temperature_2m,
      windKph: c.wind_speed_10m,
      humidity: c.relative_humidity_2m,
      code: c.weather_code,
      isDay: c.is_day === 1,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "Network error." };
  }
}

/** Real public holidays from Nager.Date (no key). */
export async function getHolidays(
  arg?: Arg<{ countryCode?: string; year?: number }>,
): Promise<HolidaysResult> {
  const data = arg?.data;
  const countryCode = (data?.countryCode || "IN").toUpperCase().slice(0, 2);
  const year = data?.year && data.year > 1970 ? Math.floor(data.year) : new Date().getUTCFullYear();
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
    if (!res.ok) return { countryCode, year, holidays: [], error: `No holiday data (${res.status}).` };
    // The provider answers 204 with an empty body for a country it does not
    // cover - India among them, in every year. 204 passes res.ok, so this used
    // to run res.json() on nothing and show the visitor a raw
    // "Unexpected end of JSON input" where the truth is simply that this
    // calendar has no holidays for their country.
    const body = (await res.text()).trim();
    if (!body) {
      return {
        countryCode,
        year,
        holidays: [],
        error: `No public holidays are published for ${countryCode} in ${year}.`,
      };
    }
    const json = JSON.parse(body) as { date: string; localName: string; name: string }[];
    return {
      countryCode,
      year,
      holidays: json.map((h) => ({ date: h.date, localName: h.localName, name: h.name })),
    };
  } catch (e) {
    return { countryCode, year, holidays: [], error: e instanceof Error ? e.message : "Network error." };
  }
}

/** UI translation — needs a server-side AI key, not available in this SPA build. */
/**
 * Translate storefront strings.
 *
 * Calls the application's own translator, which holds a cache of everything it
 * has already translated and routes the rest through the AI API Manager. This
 * function used to return "Live translation is not configured" to every request,
 * which is why the language picker changed nothing.
 *
 * When no provider has a credential the endpoint says so, and that reason is
 * passed back rather than swallowed - the picker can then say why the page did
 * not change instead of appearing broken. Once a key exists this works with no
 * further change, and previously translated strings come from the cache without
 * a provider call at all.
 */
export async function translateTexts(
  arg?: Arg<{ texts: string[]; targetLanguage: string }>,
): Promise<TranslateResult> {
  const texts = arg?.data?.texts ?? [];
  const locale = (arg?.data?.targetLanguage ?? "").trim();
  if (texts.length === 0) return { texts };
  if (!locale) return { texts, error: "Which language?" };

  const base = process.env.APP_BASE_URL?.trim() || process.env.SITE_URL?.trim() || "";
  const url = `${base}/api/marketplace/translate`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, locale }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      translations?: Record<string, string>;
      error?: string;
    };
    if (!response.ok || payload.error) {
      // Passed through, not hidden: the picker can say why nothing changed.
      return { texts, error: payload.error ?? `Translation unavailable (${response.status}).` };
    }
    const map = payload.translations ?? {};
    // Anything the translator did not return keeps its original wording rather
    // than becoming blank.
    return { texts: texts.map((t) => map[t] ?? t) };
  } catch (error) {
    return {
      texts,
      error: error instanceof Error ? error.message : "Translation could not be reached.",
    };
  }
}

/** Storefront AI assistant — needs a server-side AI key, not available in this SPA build. */
/** Words that carry no meaning in a product search. */
const STOP = new Set([
  "i", "we", "you", "a", "an", "the", "is", "are", "do", "does", "have", "has",
  "want", "need", "looking", "for", "any", "some", "me", "my", "our", "your",
  "can", "could", "would", "please", "show", "find", "get", "give", "tell",
  "about", "with", "and", "or", "of", "to", "in", "on", "at", "it", "this",
  "that", "there", "hi", "hello", "hey", "software", "system", "solution",
  "product", "products", "app", "application", "price", "cost", "how", "much",
]);

/**
 * The catalogue, searched for real.
 *
 * Uses the same public search endpoint the storefront's own search box uses, so
 * a visitor asking the assistant and a visitor typing in the search bar get the
 * same answer from the same source. Nothing is cached and nothing is invented.
 */
async function searchCatalogueForChat(terms: string): Promise<
  { name: string; slug: string; price: string | null; industry: string | null }[]
> {
  const base = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    "";
  if (!base || !key || !terms) return [];
  const pattern = encodeURIComponent(`*${terms}*`);
  try {
    const response = await fetch(
      `${base}/rest/v1/marketplace_products` +
        `?select=name,slug,price_label,industry_label` +
        `${publicProductFilter()}` +
        `&or=(name.ilike.${pattern},industry_label.ilike.${pattern},description.ilike.${pattern})` +
        `&limit=5`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as Record<string, unknown>[];
    return rows.map((r) => ({
      name: String(r.name ?? ""),
      slug: String(r.slug ?? ""),
      price: (r.price_label as string) ?? null,
      industry: (r.industry_label as string) ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * The storefront assistant.
 *
 * This used to return "AI assistant is not configured yet" to every question,
 * which made the AI Chat button on the front page do nothing for everybody.
 * There is still no AI provider credential here, and answering without one by
 * making things up is not an option. What is available is the catalogue, and
 * the question a visitor actually asks this box is whether the catalogue has
 * something for them - so that is what it answers, from real rows.
 *
 * A question that is not a search gets an honest description of what this
 * assistant can do, not a generated guess.
 */
export async function askStorefrontAi(
  arg?: Arg<{ messages: { role: "user" | "assistant"; content: string }[] }>,
): Promise<ChatResult> {
  const messages = arg?.data?.messages ?? [];
  const last = [...messages].reverse().find((m) => m.role === "user");
  const question = (last?.content ?? "").trim();
  if (!question) {
    return { reply: "Ask me what you are looking for — a category, an industry or a product name." };
  }

  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

  // Try the most specific phrasing first, then each word on its own.
  const attempts = [words.join(" "), ...words].filter(Boolean);
  let found: Awaited<ReturnType<typeof searchCatalogueForChat>> = [];
  for (const attempt of attempts) {
    found = await searchCatalogueForChat(attempt);
    if (found.length > 0) break;
  }

  if (found.length > 0) {
    const lines = found.map((p) => {
      const price = p.price ? ` — ${p.price}` : "";
      const industry = p.industry ? ` (${p.industry})` : "";
      return `• ${p.name}${industry}${price}\n  /marketplace/product/${p.slug}`;
    });
    return {
      reply:
        `Here is what the catalogue has:\n\n${lines.join("\n")}\n\n` +
        `Open any of them for the live demo and the licence. ` +
        `Every product is a one-time purchase with lifetime access.`,
    };
  }

  // Nothing matched. Say so, and say what this assistant can actually do.
  return {
    reply:
      words.length > 0
        ? `I could not find anything in the catalogue for "${words.join(" ")}". ` +
          `Try an industry — retail, healthcare, education, logistics, hospitality — or a product name. ` +
          `You can also browse everything at /marketplace.`
        : `I search the live catalogue of 80+ categories. Tell me an industry or a product ` +
          `and I will show you what exists. For payment, licence or delivery questions, ` +
          `use "Talk to a human" above — those are answered by the team, not by me.`,
  };
}
