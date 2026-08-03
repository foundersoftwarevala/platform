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
    const json = (await res.json()) as { date: string; localName: string; name: string }[];
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
export async function translateTexts(
  arg?: Arg<{ texts: string[]; targetLanguage: string }>,
): Promise<TranslateResult> {
  const texts = arg?.data?.texts ?? [];
  return { texts, error: "Live translation is not configured." };
}

/** Storefront AI assistant — needs a server-side AI key, not available in this SPA build. */
export async function askStorefrontAi(
  _arg?: Arg<{ messages: { role: "user" | "assistant"; content: string }[] }>,
): Promise<ChatResult> {
  return { reply: "", error: "AI assistant is not configured yet." };
}
