/**
 * LIVE DATA SERVER FUNCTIONS
 * Real production data sources (no mock values):
 *  - Open-Meteo  → weather, hourly + 7-day forecast, air quality (no key required)
 *  - Open-Meteo Geocoding → country / state / city search + GPS reverse lookup
 *  - Frankfurter (ECB) → live FX rates
 *  - CoinGecko → BTC / ETH / gold & silver tokenised spot
 * All fetches happen server-side so the browser never hits third-party CORS.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const num = (v: unknown, f = 0) => (typeof v === "number" && Number.isFinite(v) ? v : f);

async function j<T>(url: string, ms = 8000): Promise<T | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* -------------------------------- weather -------------------------------- */

export interface WeatherPayload {
  ok: boolean;
  error?: string;
  fetchedAt: number;
  place: { name: string; admin: string; country: string; lat: number; lon: number; timezone: string };
  current: {
    temp: number;
    apparent: number;
    code: number;
    isDay: boolean;
    humidity: number;
    wind: number;
    windDir: number;
    gust: number;
    pressure: number;
    precip: number;
    cloud: number;
    visibility: number;
    uv: number;
  };
  aqi: { us: number; pm25: number; pm10: number; o3: number } | null;
  today: { max: number; min: number; sunrise: string; sunset: string; rainProb: number; uvMax: number };
  hourly: { t: string; temp: number; code: number; rain: number }[];
  daily: { date: string; max: number; min: number; code: number; rain: number }[];
}

export const getWeather = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        lat: z.number(),
        lon: z.number(),
        name: z.string().default(""),
        admin: z.string().default(""),
        country: z.string().default(""),
        timezone: z.string().default("auto"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<WeatherPayload> => {
    const { lat, lon } = data;
    const base =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,` +
      `cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max` +
      `&timezone=${encodeURIComponent(data.timezone || "auto")}&forecast_days=7`;

    const aqUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=us_aqi,pm2_5,pm10,ozone&timezone=${encodeURIComponent(data.timezone || "auto")}`;

    const [w, a] = await Promise.all([j<any>(base), j<any>(aqUrl)]);

    if (!w?.current) {
      return {
        ok: false,
        error: "Weather service unavailable",
        fetchedAt: Date.now(),
        place: { name: data.name, admin: data.admin, country: data.country, lat, lon, timezone: data.timezone },
        current: {
          temp: 0, apparent: 0, code: 0, isDay: true, humidity: 0, wind: 0, windDir: 0,
          gust: 0, pressure: 0, precip: 0, cloud: 0, visibility: 0, uv: 0,
        },
        aqi: null,
        today: { max: 0, min: 0, sunrise: "", sunset: "", rainProb: 0, uvMax: 0 },
        hourly: [],
        daily: [],
      };
    }

    const c = w.current;
    const nowIso = new Date().toISOString().slice(0, 13);
    const hIdx = Math.max(
      0,
      (w.hourly?.time as string[] | undefined)?.findIndex((t) => t.slice(0, 13) >= nowIso) ?? 0,
    );

    return {
      ok: true,
      fetchedAt: Date.now(),
      place: {
        name: data.name,
        admin: data.admin,
        country: data.country,
        lat,
        lon,
        timezone: w.timezone ?? data.timezone,
      },
      current: {
        temp: num(c.temperature_2m),
        apparent: num(c.apparent_temperature),
        code: num(c.weather_code),
        isDay: num(c.is_day, 1) === 1,
        humidity: num(c.relative_humidity_2m),
        wind: num(c.wind_speed_10m),
        windDir: num(c.wind_direction_10m),
        gust: num(c.wind_gusts_10m),
        pressure: num(c.pressure_msl ?? c.surface_pressure),
        precip: num(c.precipitation),
        cloud: num(c.cloud_cover),
        visibility: num(c.visibility) / 1000,
        uv: num(w.daily?.uv_index_max?.[0]),
      },
      aqi: a?.current
        ? {
            us: num(a.current.us_aqi),
            pm25: num(a.current.pm2_5),
            pm10: num(a.current.pm10),
            o3: num(a.current.ozone),
          }
        : null,
      today: {
        max: num(w.daily?.temperature_2m_max?.[0]),
        min: num(w.daily?.temperature_2m_min?.[0]),
        sunrise: w.daily?.sunrise?.[0] ?? "",
        sunset: w.daily?.sunset?.[0] ?? "",
        rainProb: num(w.daily?.precipitation_probability_max?.[0]),
        uvMax: num(w.daily?.uv_index_max?.[0]),
      },
      hourly: (w.hourly?.time as string[] | undefined)
        ?.slice(hIdx, hIdx + 12)
        .map((t: string, i: number) => ({
          t,
          temp: num(w.hourly.temperature_2m?.[hIdx + i]),
          code: num(w.hourly.weather_code?.[hIdx + i]),
          rain: num(w.hourly.precipitation_probability?.[hIdx + i]),
        })) ?? [],
      daily: (w.daily?.time as string[] | undefined)?.map((d: string, i: number) => ({
        date: d,
        max: num(w.daily.temperature_2m_max?.[i]),
        min: num(w.daily.temperature_2m_min?.[i]),
        code: num(w.daily.weather_code?.[i]),
        rain: num(w.daily.precipitation_probability_max?.[i]),
      })) ?? [],
    };
  });

/* ------------------------------- geocoding -------------------------------- */

export interface GeoPlace {
  id: number;
  name: string;
  admin: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone: string;
}

export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<GeoPlace[]> => {
    const r = await j<any>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(data.q)}&count=8&language=en&format=json`,
    );
    return (r?.results ?? []).map((p: any) => ({
      id: num(p.id),
      name: String(p.name ?? ""),
      admin: String(p.admin1 ?? ""),
      country: String(p.country ?? ""),
      countryCode: String(p.country_code ?? ""),
      lat: num(p.latitude),
      lon: num(p.longitude),
      timezone: String(p.timezone ?? "auto"),
    }));
  });

export const reverseGeocode = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lat: z.number(), lon: z.number() }).parse(d))
  .handler(async ({ data }): Promise<GeoPlace | null> => {
    const r = await j<any>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${data.lat}&longitude=${data.lon}&localityLanguage=en`,
    );
    if (!r) return null;
    return {
      id: 0,
      name: String(r.city || r.locality || r.principalSubdivision || "Current location"),
      admin: String(r.principalSubdivision ?? ""),
      country: String(r.countryName ?? ""),
      countryCode: String(r.countryCode ?? ""),
      lat: data.lat,
      lon: data.lon,
      timezone: "auto",
    };
  });

/* -------------------------------- markets --------------------------------- */

export interface MarketsPayload {
  ok: boolean;
  fetchedAt: number;
  fxBase: string;
  fx: { code: string; rate: number }[];
  crypto: { code: string; name: string; usd: number; change24h: number }[];
  metals: { code: string; name: string; usd: number; change24h: number }[];
}

export const getMarkets = createServerFn({ method: "GET" }).handler(async (): Promise<MarketsPayload> => {
  const [fx, cg] = await Promise.all([
    j<any>("https://api.frankfurter.app/latest?from=USD&to=INR,EUR,GBP,AED,JPY,CNY,SGD"),
    j<any>(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold,tether-gold&vs_currencies=usd&include_24hr_change=true",
    ),
  ]);

  const rates = (fx?.rates ?? {}) as Record<string, number>;

  return {
    ok: Boolean(fx || cg),
    fetchedAt: Date.now(),
    fxBase: "USD",
    fx: Object.entries(rates).map(([code, rate]) => ({ code, rate: num(rate) })),
    crypto: [
      { code: "BTC", name: "Bitcoin", usd: num(cg?.bitcoin?.usd), change24h: num(cg?.bitcoin?.usd_24h_change) },
      { code: "ETH", name: "Ethereum", usd: num(cg?.ethereum?.usd), change24h: num(cg?.ethereum?.usd_24h_change) },
    ],
    metals: [
      {
        code: "XAU",
        name: "Gold (oz)",
        usd: num(cg?.["pax-gold"]?.usd),
        change24h: num(cg?.["pax-gold"]?.usd_24h_change),
      },
      {
        code: "XAUT",
        name: "Gold (T)",
        usd: num(cg?.["tether-gold"]?.usd),
        change24h: num(cg?.["tether-gold"]?.usd_24h_change),
      },
    ],
  };
});

/* ------------------------------ system pulse ------------------------------ */

export interface PulsePayload {
  ok: boolean;
  serverTime: number;
  region: string;
  runtime: string;
  weatherApi: { up: boolean; ms: number };
  marketApi: { up: boolean; ms: number };
  aiGateway: { up: boolean; ms: number };
}

async function probe(url: string): Promise<{ up: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    return { up: res.ok || res.status < 500, ms: Date.now() - t0 };
  } catch {
    return { up: false, ms: Date.now() - t0 };
  }
}

export const getSystemPulse = createServerFn({ method: "GET" }).handler(async (): Promise<PulsePayload> => {
  const [w, m, ai] = await Promise.all([
    probe("https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m"),
    probe("https://api.frankfurter.app/latest?from=USD&to=EUR"),
    probe("https://ai.gateway.lovable.dev/v1/models"),
  ]);

  return {
    ok: true,
    serverTime: Date.now(),
    region: process.env["CF_REGION"] ?? process.env["VERCEL_REGION"] ?? "edge",
    runtime: typeof navigator !== "undefined" ? "workerd" : "node",
    weatherApi: w,
    marketApi: m,
    aiGateway: ai,
  };
});
