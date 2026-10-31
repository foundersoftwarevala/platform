export const HOMEPAGE_CARDS_PER_ROW = 100;

type RailProduct = {
  id: string;
  status: "ACTIVE" | "COMING_SOON";
};

export function fillProductRail<T extends RailProduct>(
  products: readonly T[],
  target = HOMEPAGE_CARDS_PER_ROW,
): T[] {
  if (!Number.isInteger(target) || target < 0) {
    throw new RangeError("Product rail target must be a non-negative integer.");
  }
  if (target === 0 || products.length === 0) return [];

  const prioritized = [
    ...products.filter((product) => product.status === "ACTIVE"),
    ...products.filter((product) => product.status === "COMING_SOON"),
  ].slice(0, target);

  return Array.from({ length: target }, (_, index) => prioritized[index % prioritized.length]!);
}

export function countryCardCapacity(
  staticProducts: readonly Pick<RailProduct, "id">[],
  availableCountryCards: number,
  target = HOMEPAGE_CARDS_PER_ROW,
): number {
  if (!Number.isInteger(target) || target < 0) {
    throw new RangeError("Product rail target must be a non-negative integer.");
  }
  if (!Number.isInteger(availableCountryCards) || availableCountryCards < 0) {
    throw new RangeError("Available country card count must be a non-negative integer.");
  }

  const remainingSlots = Math.max(
    target - new Set(staticProducts.map((product) => product.id)).size,
    0,
  );
  return Math.min(availableCountryCards, remainingSlots);
}
