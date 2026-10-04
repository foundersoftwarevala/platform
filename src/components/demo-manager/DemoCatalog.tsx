import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDemoHealth } from "@/lib/marketplace-demo.functions";
import DataStateNotice from "./DataStateNotice";
import { useTranslation } from "@/lib/i18n/use-translation";
import { motion } from "framer-motion";
import {
  Package,
  Search,
  Filter,
  ExternalLink,
  Download,
  Smartphone,
  Monitor,
  Apple,
  Globe,
  Code,
  FileText,
  Image,
  Eye,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  stack: string;
  platforms: string[];
  /** Null where the platform holds no figure. The card shows a dash. */
  rating: number | null;
  demos: number;
  downloads: number | null;
  hasAPK: boolean;
  hasWeb: boolean;
  hasIOS: boolean;
  thumbnail: string;
  featured: boolean;
  /** The demo's own URL, opened by View Demo. Null when none is stored. */
  url: string | null;
}

/**
 * Eight invented products used to live here - "E-Commerce Pro", "Banking
 * Portal", "Food Delivery" - each with a rating, a download count and a tech
 * stack, none of which this platform sells or records. An operator browsing
 * this tab was browsing fiction.
 *
 * It shows the seventeen real demos now, from mm_demo_health, which is the same
 * source the status grid beside it uses. Where the card was designed for a
 * figure the platform does not hold - a star rating per demo, a download count,
 * whether there is an APK or an iOS build - it shows a dash instead of a number.
 * A missing capability should look missing.
 */
type CatalogDemo = {
  id: string;
  demo_name: string | null;
  product_name: string | null;
  url: string | null;
  status: string | null;
  environment: string | null;
  uptime_percent: number | null;
  clicks: number;
  latest_result: string | null;
};

const DemoCatalog = () => {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<CatalogDemo[]>({
    queryKey: ["demo-health", "catalog"],
    queryFn: () => listDemoHealth({ data: { days: 30 } }) as Promise<CatalogDemo[]>,
    staleTime: 60_000,
  });

  /**
   * Mapped onto the shape this card already renders, so the design is
   * untouched. Every field that has no source is null, and the card shows a
   * dash for it rather than a number nobody measured.
   */
  const products: Product[] = (data ?? []).map((d) => ({
    id: d.id,
    name: d.product_name ?? d.demo_name ?? "Demo",
    category: d.environment ?? "demo",
    description: [
      d.demo_name,
      `${d.clicks} open${d.clicks === 1 ? "" : "s"}`,
      d.uptime_percent == null ? null : `${d.uptime_percent}% uptime`,
      d.latest_result ? `last check: ${d.latest_result}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    stack: "",
    platforms: ["web"],
    rating: null,
    demos: 1,
    downloads: null,
    hasAPK: false,
    hasWeb: true,
    hasIOS: false,
    thumbnail: d.status === "active" ? "🟢" : "⚪",
    featured: d.status === "active",
    url: d.url,
  }));
  const categories = [...new Set(products.map((p) => p.category))].sort();
  const openDemo = (url: string | null) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Product Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse and manage all software products with demos
          </p>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/50 px-4 py-1">
          <Package className="w-4 h-4 mr-2" />
          {isLoading ? "…" : isError ? "—" : t("demo.catalog.count", { count: products.length })}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product Grid */}
      <DataStateNotice
        isLoading={isLoading}
        error={isError ? error : null}
        isEmpty={filteredProducts.length === 0}
        resource="demos"
        emptyTitle={t("demo.catalog.empty_title")}
        emptyDescription={
          products.length === 0 ? t("demo.catalog.empty_none") : t("demo.catalog.empty_filtered")
        }
        emptyIcon={<Package className="w-8 h-8 text-muted-foreground" />}
        onRetry={() => void refetch()}
      >
        <div className="grid grid-cols-2 gap-6">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-panel p-5 hover:border-neon-teal/50 transition-all duration-300 group"
            >
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-secondary to-card flex items-center justify-center text-4xl flex-shrink-0">
                  {product.thumbnail}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-semibold text-foreground">{product.name}</h3>
                        {product.featured && (
                          <Badge className="bg-neon-orange/20 text-neon-orange border-neon-orange/50 text-[10px]">
                            Featured
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{product.category}</div>
                    </div>
                    <div className="flex items-center gap-1 text-neon-orange">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-mono text-sm">{product.rating ?? "—"}</span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>

                  {/* Tech Stack */}
                  <div className="flex items-center gap-2 mb-3">
                    <Code className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-mono text-primary">{product.stack}</span>
                  </div>

                  {/* Platform Availability */}
                  <div className="flex items-center gap-3 mb-3">
                    {product.hasWeb && (
                      <div className="flex items-center gap-1 text-xs text-neon-cyan">
                        <Monitor className="w-3 h-3" />
                        Web
                      </div>
                    )}
                    {product.hasAPK && (
                      <div className="flex items-center gap-1 text-xs text-neon-green">
                        <Smartphone className="w-3 h-3" />
                        Android
                      </div>
                    )}
                    {product.hasIOS && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Apple className="w-3 h-3" />
                        iOS
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {product.demos} demos
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {product.downloads == null ? "—" : product.downloads.toLocaleString()}{" "}
                      downloads
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/30">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openDemo(product.url)}
                  disabled={!product.url}
                  title={product.url ? undefined : t("demo.catalog.no_url")}
                >
                  <Eye className="w-3 h-3 mr-2" />
                  View Demo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled
                  title={t("demo.catalog.no_docs")}
                >
                  <FileText className="w-3 h-3 mr-2" />
                  Docs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled
                  title={t("demo.catalog.no_screenshots")}
                >
                  <Image className="w-3 h-3 mr-2" />
                  Screenshots
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openDemo(product.url)}
                  disabled={!product.url}
                  aria-label={t("demo.catalog.open_in_new_tab", { name: product.name })}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </DataStateNotice>
    </div>
  );
};

export default DemoCatalog;
