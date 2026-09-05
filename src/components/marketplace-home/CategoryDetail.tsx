import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ArrowLeft, Heart, Eye, Play, ShoppingCart } from "lucide-react";
import { getPublicProductsByCategory } from "@/lib/marketplace.functions";
import { useServerFn } from "@/lib/serverFn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

export function CategoryDetail() {
  const { slug } = useParams({ from: "/marketplace/category/$slug" });
  const navigate = useNavigate();
  const getCategoryFn = useServerFn(getPublicProductsByCategory);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const result = await getCategoryFn({ data: { category_slug: slug } });
      return result;
    },
  });

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

  const { category, products } = data;

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const updated = new Set(prev);
      if (updated.has(productId)) {
        updated.delete(productId);
        toast.success("Removed from favorites");
      } else {
        updated.add(productId);
        toast.success("Added to favorites!");
      }
      return updated;
    });
  };

  const handleProductClick = (productSlug: string) => {
    navigate({ to: "/marketplace/product/$slug", params: { slug: productSlug } });
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link to="/marketplace" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition">
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
              <span className="text-4xl font-bold text-cyan-300">{category.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">{category.name}</h1>
              <p className="text-muted-foreground text-lg">
                {products.length} {products.length === 1 ? "product" : "products"} available
              </p>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {products.length > 0 ? (
          <div>
            <h2 className="text-2xl font-bold mb-6">Featured Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const isFavorite = favorites.has(product.id);
                const activeDemo = product.demo_urls?.[0];
                const demoGatewayUrl = `/demo/${product.slug}`;
                
                return (
                  <Card
                    key={product.id}
                    onClick={() => handleProductClick(product.slug)}
                    className="bg-linear-to-br from-[#1a2d4a] to-[#0d1e36] border-cyan-500/20 overflow-hidden hover:border-cyan-500/40 transition cursor-pointer group"
                  >
                    <div className="bg-linear-to-r from-cyan-600 to-blue-600 p-4 flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-white">{product.name}</h3>
                        <p className="text-xs text-cyan-100 opacity-75 mt-1">{category.name}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(product.id);
                        }}
                        className="p-2 hover:bg-white/20 rounded transition"
                      >
                        <Heart className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-white"}`} />
                      </button>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      {/* Product Info */}
                      <div>
                        <p className="text-sm text-gray-300 line-clamp-2">
                          {product.industry_label || "Software solution available in the marketplace."}
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
                          <div className="text-emerald-300 font-bold">{product.downloads_label || "N/A"}</div>
                          <div className="text-muted-foreground text-[10px]">Downloads</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sky-300 font-bold">{product.price_label || "Custom"}</div>
                          <div className="text-muted-foreground text-[10px]">Price</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        {activeDemo && (
                          <a href={demoGatewayUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button size="sm" className="w-full bg-cyan-500 hover:bg-cyan-600">
                              <Play className="h-3 w-3 mr-1" />
                              Try Live
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success("Opening in detail view...");
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
            <p className="text-muted-foreground text-lg">No products available in this category yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
