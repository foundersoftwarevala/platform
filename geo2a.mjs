/**
 * The twenty approved countries, as records the catalogue can hold.
 *
 * One product per category per country, which is the relationship the
 * catalogue already keeps for the sixty countries it covers. This builds the
 * records and checks them; it inserts nothing unless given --insert.
 *
 * What it will not do: invent a price, a technology stack, a feature list, a
 * demo address, a rating or a download count. The owner's instruction names
 * every one of those, so those columns are left empty and the card says the
 * stack has to be read off the implementation. Each record is tagged so the
 * batch can be found and updated in place when real software arrives, rather
 * than duplicated.
 */
import { readFileSync, writeFileSync } from "node:fs";

export function readEnv(f) {
  const o = {};
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return o;
}

/** The owner's approved second batch, in the order they gave. */
export const NEW_20 = [
  "Switzerland",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Belgium",
  "Austria",
  "Poland",
  "Czechia",
  "Romania",
  "Hungary",
  "Greece",
  "Luxembourg",
  "Estonia",
  "Lithuania",
  "Latvia",
  "Serbia",
  "Croatia",
  "Slovenia",
  "Taiwan",
];

/** The region a reader would name, over the continent the registry records. */
export const REGION = {
  CH: "Western Europe",
  BE: "Western Europe",
  AT: "Western Europe",
  LU: "Western Europe",
  SE: "Northern Europe",
  NO: "Northern Europe",
  DK: "Northern Europe",
  FI: "Northern Europe",
  EE: "Northern Europe",
  LT: "Northern Europe",
  LV: "Northern Europe",
  PL: "Central Europe",
  CZ: "Central Europe",
  HU: "Central Europe",
  SI: "Central Europe",
  RO: "Southeast Europe",
  RS: "Southeast Europe",
  HR: "Southeast Europe",
  GR: "Southeast Europe",
  TW: "East Asia",
};

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

/** "Healthcare" -> "Healthcare Software"; "ERP Systems" is left as it is. */
export function subject(categoryName) {
  if (/\b(software|system|systems|erp|platform|suite|management|crm|pos)\b/i.test(categoryName)) {
    return categoryName;
  }
  return `${categoryName} Software`;
}

/**
 * About forty search intents for one product in one country.
 *
 * Written the way a person types: the thing, the thing with the country, the
 * thing with the region, best and top, the audience, the question forms.
 * Nothing of the "buy-x-123" kind. No two cards share a list, because the
 * subject, the country and the region all differ.
 */
export function intents(categoryName, country, region) {
  const s = subject(categoryName).toLowerCase();
  const bare = categoryName.toLowerCase();
  const c = country;
  const out = [
    s,
    bare,
    `${s} ${c}`,
    `best ${s} ${c}`,
    `top ${s} ${c}`,
    `${s} in ${c}`,
    `${s} for ${c}`,
    `${bare} software ${c}`,
    `best ${bare} software ${c}`,
    `${s} ${region}`,
    `best ${s} ${region}`,
    `${s} providers ${region}`,
    `best ${s}`,
    `top ${s} 2026`,
    `${s} comparison`,
    `${s} alternatives`,
    `${s} vs spreadsheets`,
    `cloud ${s}`,
    `cloud based ${s} ${c}`,
    `web based ${s}`,
    `${s} with source code`,
    `self hosted ${s}`,
    `on premise ${s} ${c}`,
    `${s} for small business`,
    `${s} for small business ${c}`,
    `${s} for enterprise`,
    `${s} for startups ${c}`,
    `affordable ${s} ${c}`,
    `${s} pricing ${c}`,
    `${s} demo`,
    `${s} free trial`,
    `how to choose ${s}`,
    `what is ${s}`,
    `${s} features list`,
    `${s} reporting and dashboard`,
    `${s} multi user access`,
    `${s} multi branch`,
    `${s} data export`,
    `${s} api integration`,
    `${s} implementation ${c}`,
  ];
  // The country marker the catalogue already uses to record a product's country.
  return [...new Set(out)].concat(`country:${c}`);
}

export function save(path, value) {
  writeFileSync(path, JSON.stringify(value));
}
