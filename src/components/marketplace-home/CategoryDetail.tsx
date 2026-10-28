import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate, useMatch } from "@tanstack/react-router";
import { Loader2, ArrowLeft, Heart, Eye, Play, ShoppingCart } from "lucide-react";
import {
  getPublicProductsByCategory,
  getPublicStorefrontFilters,
  type MarketProduct,
  type PublicStorefrontFilterGroup,
} from "@/lib/marketplace.functions";
import { filterPublicProducts } from "@/lib/marketplace/public-filtering";
import { useFavorites } from "@/lib/marketplace-home/persistentState";
import { useServerFn } from "@/lib/serverFn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DemoLaunchButton } from "@/components/marketplace-home/DemoLaunchButton";

const EMPTY_PRODUCTS: MarketProduct[] = [];
const EMPTY_FILTER_GROUPS: PublicStorefrontFilterGroup[] = [];

export function CategoryDetail() {
  const { slug } = useParams({ from: "/marketplace/category/$slug" });
  const navigate = useNavigate();
  const getCategoryFn = useServerFn(getPublicProductsByCategory);
  const getFiltersFn = useServerFn(getPublicStorefrontFilters);
  const { favorites, toggle: toggleSavedProduct } = useFavorites();
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  // What the route already loaded. With it the first render has the products
  // in hand, so the page leaves the server complete rather than as a spinner.
  const loaded = useMatch({
    from: "/marketplace/category/$slug",
    shouldThrow: false,
  })?.loaderData;
  const seededProducts = loaded?.products ?? undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const result = await getCategoryFn({ data: { category_slug: slug } });
      return result;
    },
    initialData: seededProducts as never,
  });
  const filters = useQuery({
    queryKey: ["public-storefront-filters"],
    queryFn: () => getFiltersFn(),
    staleTime: 30_000,
  });
  const products = data?.products ?? EMPTY_PRODUCTS;
  const filterGroups = filters.data ?? EMPTY_FILTER_GROUPS;
  const visibleProducts = useMemo(
    () => filterPublicProducts(products, filterGroups, selectedFilters),
    [filterGroups, products, selectedFilters],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-slate-900 to-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          <p className="text-muted-foreground">Loading category...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.category) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-slate-900 to-slate-950">
        <Card className="max-w-md mx-auto border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-2">Category Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The category with slug "{slug}" could not be found.
          </p>
          <Link to="/marketplace" className="inline-block">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { category } = data;

  const toggleFavorite = (productId: string) => {
    const wasSaved = favorites.includes(productId);
    toggleSavedProduct(productId);
    toast.success(wasSaved ? "Removed from favorites" : "Added to favorites!");
  };

  const toggleFilterValue = (key: string, value: string, mode: "single" | "multi") => {
    setSelectedFilters((current) => {
      const selected = current[key] ?? [];
      if (mode === "single") {
        return { ...current, [key]: selected[0] === value ? [] : [value] };
      }
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [key]: next };
    });
  };

  const clearFilters = () => setSelectedFilters({});

  const handleProductClick = (productSlug: string) => {
    navigate({ to: "/marketplace/product/$slug", params: { slug: productSlug } });
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Marketplace</span>
          </Link>
        </div>
      </div>

      {/* Category Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Category Header */}
        <div className="mb-12">
          <div className="flex items-start gap-6 mb-8">
            <div className="h-20 w-20 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <span className="text-4xl font-bold text-cyan-300">
                {category.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">{category.name}</h1>
              <p className="text-muted-foreground text-lg">
                {visibleProducts.length === products.length
                  ? `${products.length} ${products.length === 1 ? "product" : "products"} available`
                  : `Showing ${visibleProducts.length} of ${products.length} products`}
              </p>
            </div>
          </div>
        </div>

        {filters.isError && (
          <div
            role="status"
            className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"
          >
            <span>Filters are temporarily unavailable. Products are still shown.</span>
            <Button variant="outline" size="sm" onClick={() => void filters.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {filters.isLoading && (
          <p role="status" className="mb-6 text-sm text-muted-foreground">
            Loading available filters…
          </p>
        )}
        {!filters.isError &&
          filterGroups.some((group) => group.enabled && group.values.length > 0) && (
            <section
              aria-label="Filter products"
              className="mb-8 rounded-xl border border-cyan-500/20 bg-white/[0.03] p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-cyan-100">Filter products</h2>
                {Object.values(selectedFilters).some((values) => values.length > 0) && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {filterGroups
                  .filter(
                    (group) =>
                      group.enabled &&
                      group.values.length > 0 &&
                      (group.visible_desktop || group.visible_mobile),
                  )
                  .map((group) => {
                    const visibility = group.visible_mobile
                      ? group.visible_desktop
                        ? ""
                        : "md:hidden"
                      : group.visible_desktop
                        ? "hidden md:block"
                        : "hidden";
                    const selected = selectedFilters[group.key] ?? [];
                    return (
                      <fieldset key={group.key} className={`min-w-0 ${visibility}`}>
                        <legend className="mb-2 text-xs font-medium text-muted-foreground">
                          {group.label}
                        </legend>
                        {group.source === "category" ? (
                          <select
                            aria-label={group.label}
                            value={category.slug}
                            onChange={(event) => {
                              const nextSlug = event.currentTarget.value;
                              if (nextSlug !== category.slug) {
                                void navigate({
                                  to: "/marketplace/category/$slug",
                                  params: { slug: nextSlug },
                                });
                                setSelectedFilters({});
                              }
                            }}
                            className="w-full rounded-md border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                          >
                            {group.values.map((value) => (
                              <option key={value.value} value={value.value}>
                                {value.label} ({value.count})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="max-h-40 space-y-1 overflow-y-auto">
                            {group.values
                              .filter((value) => value.count > 0)
                              .map((value) => {
                                const checked = selected.includes(value.value);
                                return (
                                  <label
                                    key={value.value}
                                    className="flex cursor-pointer items-center gap-2 text-xs text-gray-200"
                                  >
                                    <input
                                      type={group.select_mode === "single" ? "radio" : "checkbox"}
                                      name={`filter-${group.key}`}
                                      checked={checked}
                                      onChange={() =>
                                        toggleFilterValue(group.key, value.value, group.select_mode)
                                      }
                                      className="accent-cyan-400"
                                    />
                                    <span>{value.label}</span>
                                    <span className="ml-auto text-muted-foreground">
                                      {value.count}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>
                        )}
                      </fieldset>
                    );
                  })}
              </div>
            </section>
          )}

        {/* Products Grid */}
        {visibleProducts.length > 0 ? (
          <div>
            <h2 className="text-2xl font-bold mb-6">Featured Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleProducts.map((product) => {
                const isFavorite = favorites.includes(product.id);
                const activeDemo = product.demo_urls?.[0];

                return (
                  <Card
                    key={product.id}
                    onClick={() => handleProductClick(product.slug)}
                    className="bg-linear-to-br from-[#1a2d4a] to-[#0d1e36] border-cyan-500/20 overflow-hidden hover:border-cyan-500/40 transition cursor-pointer group"
                  >
                    <div className="bg-linear-to-r from-cyan-600 to-blue-600 p-4 flex justify-between items-start">
                      <div>
                        {/* The card has always navigated to the product, but it
                            did it with an onClick, so the page a crawler
                            receives listed ninety-one product names and no way
                            to reach any of them: one link in the whole document,
                            against a hundred and fifteen on the country page.
                            The name is the link now. Nothing moves - the anchor
                            inherits the heading's styling - and the card's own
                            click still works; the propagation stop only keeps
                            the two from firing at once. */}
                        <h3 className="text-lg font-bold text-white">
                          <Link
                            to="/marketplace/product/$slug"
                            params={{ slug: product.slug }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-white hover:underline"
                          >
                            {product.name}
                          </Link>
                        </h3>
                        <p className="text-xs text-cyan-100 opacity-75 mt-1">{category.name}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(product.id);
                        }}
                        className="p-2 hover:bg-white/20 rounded transition"
                      >
                        <Heart
                          className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-white"}`}
                        />
                      </button>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Product Info */}
                      <div>
                        <p className="text-sm text-gray-300 line-clamp-2">
                          {product.industry_label ||
                            "Software solution available in the marketplace."}
                        </p>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        {product.badge && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                            {product.badge}
                          </Badge>
                        )}
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                          {product.demo_urls?.length || 0} Demos
                        </Badge>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-cyan-300 font-bold">{product.rating.toFixed(1)}</div>
                          <div className="text-muted-foreground text-[10px]">Rating</div>
                        </div>
                        <div className="text-center">
                          <div className="text-emerald-300 font-bold">
                            {product.downloads_label || "N/A"}
                          </div>
                          <div className="text-muted-foreground text-[10px]">Downloads</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sky-300 font-bold">
                            {product.price_label || "Custom"}
                          </div>
                          <div className="text-muted-foreground text-[10px]">Price</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        {activeDemo && (
                          <DemoLaunchButton
                            slug={product.slug}
                            className="flex-1 inline-flex items-center justify-center rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-600"
                          >
                            <span className="inline-flex items-center">
                              <Play className="h-3 w-3 mr-1" />
                              Try Live
                            </span>
                          </DemoLaunchButton>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(product.slug);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <Card className="bg-white/5 border-cyan-500/20 p-12 text-center">
            <p className="text-muted-foreground text-lg">
              {products.length > 0
                ? "No products match these filters."
                : "No products available in this category yet."}
            </p>
            {products.length > 0 && (
              <Button type="button" variant="outline" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
