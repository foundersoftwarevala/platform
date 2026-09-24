import { readFileSync, writeFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("C:/Users/oooo/AppData/Local/Temp/claude/countries.json", "utf8"));

// The sub-region a reader would name, over the continent the registry records.
// This is public geography, not a judgement about any product.
const MIDDLE_EAST = new Set(["SA", "AE", "QA", "KW", "OM", "BH", "IL", "JO", "TR", "CY", "GE"]);
const NORTH_AMERICA = new Set(["US", "CA"]);
const CARIBBEAN = new Set(["TT", "GY"]);
const SOUTH_ASIA = new Set(["NP", "BD", "LK", "IN", "PK"]);
const SOUTHEAST_ASIA = new Set(["MY", "PH", "TH", "VN", "ID", "KH", "SG", "BN"]);
const EAST_ASIA = new Set(["JP", "KR", "CN"]);
const CENTRAL_ASIA = new Set(["KZ"]);
// The approved second batch only. The first sixty are locked, so none of their
// codes appears here: naming Germany "Central Europe" would have been an
// improvement to a row the owner said not to touch.
const WESTERN_EUROPE = new Set(["CH", "BE", "AT", "LU"]);
const NORTHERN_EUROPE = new Set(["SE", "NO", "DK", "FI", "EE", "LT", "LV"]);
const CENTRAL_EUROPE = new Set(["PL", "CZ", "HU", "SI"]);
const SOUTHEAST_EUROPE = new Set(["RO", "RS", "HR", "GR"]);

function regionOf(code, continent) {
  if (!code) return continent ?? "Global";
  if (MIDDLE_EAST.has(code)) return "Middle East";
  if (NORTH_AMERICA.has(code)) return "North America";
  if (CARIBBEAN.has(code)) return "Caribbean";
  if (SOUTH_ASIA.has(code)) return "South Asia";
  if (SOUTHEAST_ASIA.has(code)) return "Southeast Asia";
  if (EAST_ASIA.has(code)) return "East Asia";
  if (CENTRAL_ASIA.has(code)) return "Central Asia";
  if (EAST_ASIA.has(code) || code === "TW") return "East Asia";
  if (WESTERN_EUROPE.has(code)) return "Western Europe";
  if (NORTHERN_EUROPE.has(code)) return "Northern Europe";
  if (CENTRAL_EUROPE.has(code)) return "Central Europe";
  if (SOUTHEAST_EUROPE.has(code)) return "Southeast Europe";
  if (continent === "africa") return "Africa";
  if (continent === "europe") return "Europe";
  if (continent === "oceania") return "Oceania";
  if (continent === "americas") return "Americas";
  if (continent) return continent.charAt(0).toUpperCase() + continent.slice(1);
  return "Global";
}

const lines = rows.map((r) => {
  const continent = r.region ? r.region.charAt(0).toUpperCase() + r.region.slice(1) : null;
  return `  { marker: ${JSON.stringify(r.marker)}, label: ${JSON.stringify(r.label)}, code: ${JSON.stringify(r.code)}, continent: ${JSON.stringify(continent)}, region: ${JSON.stringify(regionOf(r.code, r.region))} },`;
});

const file = `/**
 * The order the home page's country cards are shown in.
 *
 * A row is one product category and every card in it is one country, so the
 * order has to be the same in every row: the fifth card is the same country
 * whichever row a visitor is looking at. The order is the owner's published
 * first geographic batch, the names are the markers the catalogue already
 * carries on its products (search_keywords holds "country:<name>"), the code
 * and continent come from registry_countries, and the region is the one a
 * reader would name.
 *
 * Nothing here decides which product belongs to which country. That
 * relationship is already in the database - one product per category per
 * country - and this only says what order to read it in. Adding a country to
 * this list adds a card to every row; nothing is hard-coded to sixty.
 *
 * Generated from the catalogue and the registry on 23 September 2026 by
 * scripts/ops/home-countries.mjs, and checked in so the order is stable.
 */

export type RailCountry = {
  /** The marker on the product row: search_keywords holds "country:<marker>". */
  marker: string;
  /** What the owner's list calls it, which is what a card shows. */
  label: string;
  /** ISO code from registry_countries, for hreflang and structured data. */
  code: string | null;
  /** The continent registry_countries records. */
  continent: string | null;
  /** The region a reader would name, for the product-country-region chain. */
  region: string;
};

export const RAIL_COUNTRIES: RailCountry[] = [
${lines.join("\n")}
];

/** Where a country sits in the rail, or -1 when it is not part of the batch. */
export function railPosition(marker: string): number {
  return RAIL_COUNTRIES.findIndex((c) => c.marker === marker);
}

/** The country a product's keywords mark it for, or null. */
export function countryMarker(keywords: unknown): string | null {
  if (!Array.isArray(keywords)) return null;
  const found = keywords.find((k) => typeof k === "string" && k.startsWith("country:"));
  return typeof found === "string" ? found.slice("country:".length) : null;
}

export const RAIL_COUNTRY_BY_MARKER = new Map(RAIL_COUNTRIES.map((c) => [c.marker, c]));
`;

writeFileSync("src/lib/marketplace/rail-countries.ts", file.replace(/\r?\n/g, "\r\n"));
console.log(`written: ${rows.length} countries`);
