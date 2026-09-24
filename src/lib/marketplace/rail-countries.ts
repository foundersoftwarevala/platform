/**
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
  { marker: "USA", label: "USA", code: "US", continent: "Americas", region: "North America" },
  { marker: "UAE", label: "UAE", code: "AE", continent: "Asia", region: "Middle East" },
  { marker: "Canada", label: "Canada", code: "CA", continent: "Americas", region: "North America" },
  { marker: "UK", label: "UK", code: "GB", continent: "Europe", region: "Europe" },
  { marker: "Australia", label: "Australia", code: "AU", continent: "Oceania", region: "Oceania" },
  { marker: "Saudi Arabia", label: "Saudi Arabia", code: "SA", continent: "Asia", region: "Middle East" },
  { marker: "Kenya", label: "Kenya", code: "KE", continent: "Africa", region: "Africa" },
  { marker: "Nigeria", label: "Nigeria", code: "NG", continent: "Africa", region: "Africa" },
  { marker: "South Africa", label: "South Africa", code: "ZA", continent: "Africa", region: "Africa" },
  { marker: "Malaysia", label: "Malaysia", code: "MY", continent: "Asia", region: "Southeast Asia" },
  { marker: "Nepal", label: "Nepal", code: "NP", continent: "Asia", region: "South Asia" },
  { marker: "Bangladesh", label: "Bangladesh", code: "BD", continent: "Asia", region: "South Asia" },
  { marker: "Philippines", label: "Philippines", code: "PH", continent: "Asia", region: "Southeast Asia" },
  { marker: "Tanzania", label: "Tanzania", code: "TZ", continent: "Africa", region: "Africa" },
  { marker: "Ghana", label: "Ghana", code: "GH", continent: "Africa", region: "Africa" },
  { marker: "Uganda", label: "Uganda", code: "UG", continent: "Africa", region: "Africa" },
  { marker: "Zambia", label: "Zambia", code: "ZM", continent: "Africa", region: "Africa" },
  { marker: "Zimbabwe", label: "Zimbabwe", code: "ZW", continent: "Africa", region: "Africa" },
  { marker: "Rwanda", label: "Rwanda", code: "RW", continent: "Africa", region: "Africa" },
  { marker: "Botswana", label: "Botswana", code: "BW", continent: "Africa", region: "Africa" },
  { marker: "Mauritius", label: "Mauritius", code: "MU", continent: "Africa", region: "Africa" },
  { marker: "Singapore", label: "Singapore", code: "SG", continent: "Asia", region: "Southeast Asia" },
  { marker: "New Zealand", label: "New Zealand", code: "NZ", continent: "Oceania", region: "Oceania" },
  { marker: "Thailand", label: "Thailand", code: "TH", continent: "Asia", region: "Southeast Asia" },
  { marker: "Vietnam", label: "Vietnam", code: "VN", continent: "Asia", region: "Southeast Asia" },
  { marker: "Indonesia", label: "Indonesia", code: "ID", continent: "Asia", region: "Southeast Asia" },
  { marker: "Cambodia", label: "Cambodia", code: "KH", continent: "Asia", region: "Southeast Asia" },
  { marker: "Sri Lanka", label: "Sri Lanka", code: "LK", continent: "Asia", region: "South Asia" },
  { marker: "Qatar", label: "Qatar", code: "QA", continent: "Asia", region: "Middle East" },
  { marker: "Kuwait", label: "Kuwait", code: "KW", continent: "Asia", region: "Middle East" },
  { marker: "Oman", label: "Oman", code: "OM", continent: "Asia", region: "Middle East" },
  { marker: "Bahrain", label: "Bahrain", code: "BH", continent: "Asia", region: "Middle East" },
  { marker: "Italy", label: "Italy", code: "IT", continent: "Europe", region: "Europe" },
  { marker: "Germany", label: "Germany", code: "DE", continent: "Europe", region: "Europe" },
  { marker: "France", label: "France", code: "FR", continent: "Europe", region: "Europe" },
  { marker: "Netherlands", label: "Netherlands", code: "NL", continent: "Europe", region: "Europe" },
  { marker: "Ireland", label: "Ireland", code: "IE", continent: "Europe", region: "Europe" },
  { marker: "Portugal", label: "Portugal", code: "PT", continent: "Europe", region: "Europe" },
  { marker: "Spain", label: "Spain", code: "ES", continent: "Europe", region: "Europe" },
  { marker: "Japan", label: "Japan", code: "JP", continent: "Asia", region: "East Asia" },
  { marker: "South Korea", label: "South Korea", code: "KR", continent: "Asia", region: "East Asia" },
  { marker: "Israel", label: "Israel", code: "IL", continent: "Asia", region: "Middle East" },
  { marker: "Jordan", label: "Jordan", code: "JO", continent: "Asia", region: "Middle East" },
  { marker: "Egypt", label: "Egypt", code: "EG", continent: "Africa", region: "Africa" },
  { marker: "Morocco", label: "Morocco", code: "MA", continent: "Africa", region: "Africa" },
  { marker: "Mozambique", label: "Mozambique", code: "MZ", continent: "Africa", region: "Africa" },
  { marker: "Angola", label: "Angola", code: "AO", continent: "Africa", region: "Africa" },
  { marker: "Namibia", label: "Namibia", code: "NA", continent: "Africa", region: "Africa" },
  { marker: "Cameroon", label: "Cameroon", code: "CM", continent: "Africa", region: "Africa" },
  { marker: "Cote d'Ivoire", label: "Côte d’Ivoire", code: "CI", continent: "Africa", region: "Africa" },
  { marker: "Senegal", label: "Senegal", code: "SN", continent: "Africa", region: "Africa" },
  { marker: "Ethiopia", label: "Ethiopia", code: "ET", continent: "Africa", region: "Africa" },
  { marker: "Guyana", label: "Guyana", code: "GY", continent: "Americas", region: "Caribbean" },
  { marker: "Trinidad & Tobago", label: "Trinidad & Tobago", code: "TT", continent: "Americas", region: "Caribbean" },
  { marker: "Fiji", label: "Fiji", code: "FJ", continent: "Oceania", region: "Oceania" },
  { marker: "Brunei", label: "Brunei", code: "BN", continent: "Asia", region: "Southeast Asia" },
  { marker: "Georgia", label: "Georgia", code: "GE", continent: "Asia", region: "Middle East" },
  { marker: "Cyprus", label: "Cyprus", code: "CY", continent: "Europe", region: "Middle East" },
  { marker: "Turkiye", label: "Türkiye", code: "TR", continent: "Asia", region: "Middle East" },
  { marker: "Kazakhstan", label: "Kazakhstan", code: "KZ", continent: "Asia", region: "Central Asia" },
  { marker: "Switzerland", label: "Switzerland", code: "CH", continent: "Europe", region: "Western Europe" },
  { marker: "Sweden", label: "Sweden", code: "SE", continent: "Europe", region: "Northern Europe" },
  { marker: "Norway", label: "Norway", code: "NO", continent: "Europe", region: "Northern Europe" },
  { marker: "Denmark", label: "Denmark", code: "DK", continent: "Europe", region: "Northern Europe" },
  { marker: "Finland", label: "Finland", code: "FI", continent: "Europe", region: "Northern Europe" },
  { marker: "Belgium", label: "Belgium", code: "BE", continent: "Europe", region: "Western Europe" },
  { marker: "Austria", label: "Austria", code: "AT", continent: "Europe", region: "Western Europe" },
  { marker: "Poland", label: "Poland", code: "PL", continent: "Europe", region: "Central Europe" },
  { marker: "Czechia", label: "Czechia", code: "CZ", continent: "Europe", region: "Central Europe" },
  { marker: "Romania", label: "Romania", code: "RO", continent: "Europe", region: "Southeast Europe" },
  { marker: "Hungary", label: "Hungary", code: "HU", continent: "Europe", region: "Central Europe" },
  { marker: "Greece", label: "Greece", code: "GR", continent: "Europe", region: "Southeast Europe" },
  { marker: "Luxembourg", label: "Luxembourg", code: "LU", continent: "Europe", region: "Western Europe" },
  { marker: "Estonia", label: "Estonia", code: "EE", continent: "Europe", region: "Northern Europe" },
  { marker: "Lithuania", label: "Lithuania", code: "LT", continent: "Europe", region: "Northern Europe" },
  { marker: "Latvia", label: "Latvia", code: "LV", continent: "Europe", region: "Northern Europe" },
  { marker: "Serbia", label: "Serbia", code: "RS", continent: "Europe", region: "Southeast Europe" },
  { marker: "Croatia", label: "Croatia", code: "HR", continent: "Europe", region: "Southeast Europe" },
  { marker: "Slovenia", label: "Slovenia", code: "SI", continent: "Europe", region: "Central Europe" },
  { marker: "Taiwan", label: "Taiwan", code: "TW", continent: "Asia", region: "East Asia" },
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
