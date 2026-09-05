import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Heart, Share2, Download, ExternalLink, ShoppingCart } from "lucide-react";
import { getPublicProduct, type PublicProduct } from "@/lib/marketplace.functions";
import { addMarketplaceCartItem } from "@/lib/marketplace-commerce.functions";
import { useServerFn } from "@/lib/serverFn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export function ProductDetail() {
  const { slug } = useParams({ from: "/marketplace/product/$slug" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getProductFn = useServerFn(getPublicProduct);
  const addToCart = useServerFn(addMarketplaceCartItem);
  const [isFavorite, setIsFavorite] = useState(false);
  const cartMutation = useMutation({
    mutationFn: (productId: string) => addToCart({ data: { productId, quantity: 1 } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-cart"] });
      void navigate({ to: "/checkout" });
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const result = await getProductFn({ data: { slug } });
      return result;
    },
  });

  useEffect(() => {
    if (!data?.product) return;
    const seo = data.seo;
    const title = seo?.meta_title || seo?.title || `${data.product.name} | Software Vala`;
    const description = seo?.meta_description || `Explore ${data.product.name} on Software Vala.`;
    const canonical = seo?.canonical_url || `${window.location.origin}/marketplace/product/${slug}`;
    document.title = title;
    const setMeta = (selector: string, attribute: string, value: string) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, selector.includes("property=") ? selector.split('"')[1] : selector.split('"')[1]);
        document.head.appendChild(element);
      }
      element.content = value;
    };
    setMeta('meta[name="description"]', "name", description);
    setMeta('meta[property="og:title"]', "property", title);
    setMeta('meta[property="og:description"]', "property", description);
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
    if (seo?.schema_json) {
      let script = document.head.querySelector('script[data-product-schema="true"]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.dataset.productSchema = "true";
        document.head.appendChild(script);
      }
      script.textContent = typeof seo.schema_json === "string" ? seo.schema_json : JSON.stringify(seo.schema_json);
    }
  }, [data, slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <Card className="max-w-md mx-auto border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-2">Product Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The product with slug "{slug}" could not be found.
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

  const product = data.product as PublicProduct;
  const demos = data.active_demos || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link to="/marketplace" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Marketplace</span>
          </Link>
        </div>
      </div>

      {/* Product Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Product Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-cyan-300">{product.icon.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
                    <div className="flex flex-wrap gap-2">
                      {product.badge && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                          {product.badge}
                        </Badge>
                      )}
                      {product.industry_label && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">
                          {product.industry_label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className="text-muted-foreground hover:text-red-400 transition"
                >
                  <Heart className={`h-6 w-6 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <Card className="bg-white/5 border-cyan-500/20 p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Rating</div>
                <div className="text-2xl font-bold text-cyan-300">{product.rating.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">/ 5.0</div>
              </Card>
              <Card className="bg-white/5 border-cyan-500/20 p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Downloads</div>
                <div className="text-2xl font-bold text-emerald-300">{product.downloads_label || product.downloads.toLocaleString()}</div>
              </Card>
              <Card className="bg-white/5 border-cyan-500/20 p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Demos</div>
                <div className="text-2xl font-bold text-sky-300">{demos.length}</div>
              </Card>
            </div>

            {/* Live Demos */}
            {demos.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Live Demos</h2>
                <div className="grid gap-3">
                  {demos.map((demo) => (
                    <Card key={demo.id} className="bg-white/5 border-cyan-500/20 p-4 hover:bg-white/10 transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">{demo.demo_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Role: {demo.role_name} · Environment: {demo.environment}
                          </div>
                        </div>
                        <a
                          href={`/demo/${slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 hover:text-cyan-200 transition font-medium text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Launch Demo
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Pricing Card */}
            <Card className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/40 p-6 mb-6 sticky top-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Price</div>
              <div className="text-3xl font-bold text-cyan-300 mb-1">{product.price_label || "Custom"}</div>
              {product.price_period && (
                <div className="text-sm text-muted-foreground mb-4">per {product.price_period}</div>
              )}

              <div className="space-y-2">
                <a
                  href={`#contact-sales`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition"
                >
                  <ExternalLink className="h-4 w-4" />
                  Request Demo
                </a>
                <button
                  type="button"
                  disabled={cartMutation.isPending}
                  onClick={() => cartMutation.mutate(product.id)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-emerald-500/40 text-emerald-300 hover:border-emerald-500/70 disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {cartMutation.isPending ? "Adding..." : "Add to cart"}
                </button>
                <button
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-300 hover:text-cyan-200 font-semibold transition"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </Card>

            {/* Product Info */}
            <Card className="bg-white/5 border-cyan-500/20 p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</div>
                <div className="text-sm text-white">{product.industry_label || "General"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                <div className="text-sm text-emerald-300">Available</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
