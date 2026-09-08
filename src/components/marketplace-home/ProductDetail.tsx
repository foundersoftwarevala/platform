import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useProductActions } from "@/lib/marketplace/useActionLayer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Heart, Share2, Download, ExternalLink, ShoppingCart } from "lucide-react";
import { getPublicProduct, type PublicProduct } from "@/lib/marketplace.functions";
import {
  getPublishedProductContent,
  type PublishedContent,
} from "@/lib/marketplace-content.functions";
import { addMarketplaceCartItem } from "@/lib/marketplace-commerce.functions";
import { useServerFn } from "@/lib/serverFn";
import { useLoaderData } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
// useEffect was used without ever being imported. The product page never
// rendered - the marketplace layout swallowed it - so the reference error sat
// unnoticed until the page was finally drawn.
import { useEffect, useState } from "react";

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
    // The cart belongs to a signed-in buyer, so this refuses for anyone who is
    // not. It used to refuse silently: the button did nothing at all and the
    // visitor had no way to know why. Send them to sign in and bring them back
    // to this product afterwards.
    onError: (error: Error) => {
      const message = String(error?.message ?? "");
      if (/unauthor|sign in|jwt|not authenticated|401/i.test(message)) {
        toast.error("Please sign in to buy.");
        void navigate({
          to: "/login",
          search: { redirect: `/marketplace/product/${slug}` } as never,
        });
        return;
      }
      toast.error(message || "That did not work. Nothing was added to your cart.");
    },
  });

  // What the route already loaded on the server. With it the first render has
  // the product in hand, so the page leaves the server complete rather than as
  // a spinner. Without it - any route that draws this without a loader - the
  // query behaves exactly as it always did.
  const loaded = useLoaderData({
    from: "/marketplace/product/$slug",
    shouldThrow: false,
  }) as { product?: unknown } | undefined;
  const seededProduct = loaded?.product ?? undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const result = await getProductFn({ data: { slug } });
      return result;
    },
    initialData: seededProduct as never,
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
            {/* Published product content. Approved copy from the AI Content
                Generator is written into the product record, the SEO record,
                the keywords and the FAQ table; the long-form blocks had no
                consumer at all until this was added, so publishing them meant
                nothing a visitor could see. */}
            <PublishedProductContent slug={slug} description={product.description} />
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

              {/* Drawn from the Action Layer, not from this file. The resolver
                  decides which of these appear, in what order and with which
                  label; an action it refuses shows the reason instead. */}
              <ProductActionButtons
                product={product}
                adding={cartMutation.isPending}
                onAddToCart={() => cartMutation.mutate(product.id)}
              />
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

/**
 * The long-form copy this page never rendered.
 *
 * The route already selected `description` and `features` and drew neither, so
 * a product with a written description showed nothing but its price and rating.
 * This renders the product's own description alongside whatever the AI Content
 * Generator has published for it, and labels the generated blocks as generated
 * rather than letting them read as verified fact.
 *
 * Nothing here can break the page: an error or an empty answer renders nothing.
 */
function PublishedProductContent({
  slug,
  description,
}: {
  slug: string;
  description?: string | null;
}) {
  const load = useServerFn(getPublishedProductContent);
  const { data } = useQuery({
    queryKey: ["product-content", slug],
    queryFn: () => load({ data: { slug } }),
    staleTime: 300_000,
    retry: false,
  });

  const content = (data ?? {}) as PublishedContent;
  const overview = content.long_description?.content || content.summary?.content || description || "";
  const features = Array.isArray(content.features?.items)
    ? (content.features!.items as { text?: string; source?: string }[])
    : [];
  const benefits = Array.isArray(content.benefits?.items)
    ? (content.benefits!.items as string[])
    : [];
  const useCases = Array.isArray(content.use_cases?.items)
    ? (content.use_cases!.items as { title?: string; description?: string }[])
    : [];
  const faq = Array.isArray(content.faq?.items)
    ? (content.faq!.items as { question?: string; answer?: string }[])
    : [];

  if (!overview && !features.length && !benefits.length && !useCases.length && !faq.length) {
    return null;
  }

  const generated = Boolean(content.long_description || content.summary);

  return (
    <div className="mb-8 space-y-8">
      {overview && (
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-xl font-bold">About this software</h2>
            {generated && (
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                AI generated, reviewed before publication
              </span>
            )}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{overview}</div>
        </section>
      )}

      {features.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Features</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {features.map((f, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-2 rounded-lg border border-cyan-500/20 bg-white/5 px-3 py-2 text-sm"
              >
                <span className="text-slate-200">{f.text}</span>
                {f.source !== "PRODUCT_DATA" && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-300/80">
                    suggested
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {benefits.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Benefits</h2>
          <ul className="space-y-2">
            {benefits.map((b, i) => (
              <li key={i} className="rounded-lg border border-emerald-500/20 bg-white/5 px-3 py-2 text-sm text-slate-200">
                {String(b)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {useCases.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-xl font-bold">Where it is used</h2>
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Suggested scenarios, not customer references
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {useCases.map((u, i) => (
              <div key={i} className="rounded-lg border border-cyan-500/20 bg-white/5 px-3 py-2">
                <div className="text-sm font-semibold text-white">{u.title}</div>
                {u.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{u.description}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Questions</h2>
          <div className="space-y-2">
            {faq.map((f, i) => (
              <details key={i} className="rounded-lg border border-cyan-500/20 bg-white/5 px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-white">{f.question}</summary>
                <div className="mt-2 text-sm text-slate-300">{f.answer}</div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * The product's actions, as the Action Layer resolves them.
 *
 * Order, label, style and whether the action appears at all come from the
 * registry. The behaviour behind each one is unchanged - Request Demo still
 * scrolls to the enquiry form, Add to cart still calls the same mutation,
 * Share still uses the native sheet and falls back to copying - so nothing a
 * customer could already do has been taken away.
 */
function ProductActionButtons({
  product,
  adding,
  onAddToCart,
}: {
  product: { id: string; name: string; slug?: string | null; demo_url?: string | null;
    visible?: boolean | null; price_label?: string | null; content_status?: string | null };
  adding: boolean;
  onAddToCart: () => void;
}) {
  const { actions } = useProductActions({
    id: product.id,
    slug: product.slug ?? null,
    demo_url: product.demo_url ?? null,
    visible: product.visible ?? true,
    price_label: product.price_label ?? null,
    content_status: product.content_status ?? null,
  });

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url });
        return;
      } catch {
        /* the sheet was dismissed; fall through to copying */
      }
    }
    const { copyText } = await import("@/lib/export/download");
    if (await copyText(url)) toast.success("Link copied");
    else toast.error("Could not copy the link");
  };

  const style = (variant: string) =>
    variant === "primary"
      ? "bg-cyan-500 hover:bg-cyan-600 text-white"
      : variant === "outline"
        ? "border border-emerald-500/40 text-emerald-300 hover:border-emerald-500/70"
        : "border border-cyan-500/40 text-cyan-300 hover:border-cyan-500/60 hover:text-cyan-200";

  const shown = actions.filter((a) =>
    ["REQUEST_DEMO", "ADD_TO_CART", "BUY_NOW", "SHARE", "LIVE_DEMO"].includes(a.key),
  );

  return (
    <div className="space-y-2">
      {shown.map((a) => {
        const base = `w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition ${style(a.variant)}`;

        // Refused, and saying why. Better than a button that cannot finish.
        if (!a.available) {
          if (a.visibility === "HIDDEN" || !a.enabled) return null;
          return (
            <div
              key={a.key}
              title={a.reason ?? undefined}
              className="w-full rounded-lg border border-border/60 px-4 py-2.5 text-center text-xs text-muted-foreground"
            >
              {a.label} — unavailable
              <div className="mt-0.5 text-[10px] opacity-80">{a.reason}</div>
            </div>
          );
        }

        if (a.key === "LIVE_DEMO" && a.href) {
          return (
            <a key={a.key} href={a.href} target="_blank" rel="noopener noreferrer" className={base}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              {a.label}
            </a>
          );
        }
        if (a.key === "REQUEST_DEMO") {
          return (
            <a key={a.key} href="#contact-sales" className={base}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              {a.label}
            </a>
          );
        }
        if (a.key === "ADD_TO_CART" || a.key === "BUY_NOW") {
          return (
            <button key={a.key} type="button" disabled={adding} onClick={onAddToCart}
              className={`${base} disabled:opacity-50`}>
              <ShoppingCart className="h-4 w-4" aria-hidden />
              {adding ? "Adding..." : a.label}
            </button>
          );
        }
        if (a.key === "SHARE") {
          return (
            <button key={a.key} type="button" onClick={() => void share()} className={`${base} py-2`}>
              <Share2 className="h-4 w-4" aria-hidden />
              {a.label}
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}
