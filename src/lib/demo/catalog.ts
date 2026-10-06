export type CatalogDemoRow = {
  id: string;
  demo_name: string;
  status: string;
  processing_status: string;
  marketplace_products?: {
    name: string;
    slug: string;
    marketplace_categories?: { name: string } | null;
  } | null;
};

export function demoCatalogEntry(demo: CatalogDemoRow, index: number) {
  const product = demo.marketplace_products;
  return {
    id: demo.id,
    number: index + 1,
    name: product?.name ?? demo.demo_name,
    category: product?.marketplace_categories?.name ?? null,
    live: demo.status === "active" && demo.processing_status === "live",
    url:
      demo.status === "active" && demo.processing_status === "live" && product?.slug
        ? `/demo/${encodeURIComponent(product.slug)}`
        : null,
  };
}
