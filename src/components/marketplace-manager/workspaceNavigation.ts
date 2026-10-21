import { filterSchema, type MarketplaceFilterName } from "./filterSchema";

export type MarketplaceFilter = { column: string; operator: string; value: string };
export type MarketplaceFilterState = {
  filters: MarketplaceFilter[];
  invalidParameters: MarketplaceFilterName[];
};

export function parseFilterParams(
  sectionId: string,
  searchParams: URLSearchParams | string,
  now = new Date(),
): MarketplaceFilterState {
  const params = new URLSearchParams(
    typeof searchParams === "string" ? searchParams : searchParams.toString(),
  );
  const schema = filterSchema[sectionId];
  if (!schema) return { filters: [], invalidParameters: [] };

  const filters: MarketplaceFilter[] = [];
  const invalidParameters: MarketplaceFilterName[] = [];

  for (const [name, rule] of Object.entries(schema) as [
    MarketplaceFilterName,
    NonNullable<(typeof schema)[MarketplaceFilterName]>,
  ][]) {
    const values = params.getAll(name);
    if (values.length === 0) continue;
    const value = values[0];
    if (values.length !== 1 || !rule.values.includes(value)) {
      invalidParameters.push(name);
      continue;
    }
    filters.push({
      column: rule.resolveColumn?.(value) ?? rule.column,
      operator: rule.operator,
      value: rule.resolveValue?.(value, now) ?? value,
    });
  }

  return { filters, invalidParameters };
}

export function resolveMarketplaceSection(
  search: string,
  sections: Record<string, unknown>,
  aliases: Record<string, string>,
): string {
  const requested = new URLSearchParams(search).get("section");
  const section = requested ? (aliases[requested] ?? requested) : "Dashboard";
  return Object.prototype.hasOwnProperty.call(sections, section) ? section : "Dashboard";
}

export function hrefWithMarketplaceSection(href: string, section: string): string {
  const url = new URL(href);
  url.searchParams.set("section", section);
  return `${url.pathname}${url.search}${url.hash}`;
}
