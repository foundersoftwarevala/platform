import type { MarketProduct, PublicStorefrontFilterGroup } from "@/lib/marketplace.functions";

type Selections = Readonly<Record<string, readonly string[]>>;

function matchesValue(product: MarketProduct, source: string, value: string): boolean {
  switch (source) {
    case "industry":
      return product.industry_label === value;
    case "deployment":
      return product.deployment === value;
    case "platform": {
      const deployment = product.deployment?.toLowerCase() ?? "";
      if (value === "Cloud") return deployment.includes("cloud");
      if (value === "On-premise") return deployment.includes("premise");
      if (value === "Mobile") return Boolean(product.mobile?.trim());
      return false;
    }
    case "tag":
      return (
        {
          new: product.is_new_release,
          trending: product.is_trending,
          featured: product.is_featured,
          best_seller: product.is_best_seller,
          ai_ready: product.is_ai,
        }[value] ?? false
      );
    case "price":
      if (value === "lifetime_249") return product.price_label === "$249";
      if (value === "custom") return product.price_label === "Custom";
      if (value === "contact") return product.price_label === "Contact";
      return false;
    case "rating":
      return Number.isFinite(Number(value)) && product.rating >= Number(value);
    case "license":
      return product.license === value;
    default:
      return false;
  }
}

/** Applies the enabled Manager facets and each group's configured value-combine policy. */
export function filterPublicProducts(
  products: readonly MarketProduct[],
  groups: readonly PublicStorefrontFilterGroup[],
  selections: Selections,
): MarketProduct[] {
  return products.filter((product) =>
    groups.every((group) => {
      if (!group.enabled || group.source === "category") return true;
      const selected = selections[group.key] ?? [];
      if (selected.length === 0) return true;
      const matches = selected.map((value) => matchesValue(product, group.source, value));
      return group.combine === "and" ? matches.every(Boolean) : matches.some(Boolean);
    }),
  );
}
