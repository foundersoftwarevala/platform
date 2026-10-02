import { useResource } from "@/lib/manager/use-resource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Eye, Lock, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";

const PAGE = 100;

/**
 * What the storefront would say about this product. "Active" used to mean
 * visible alone, so a visible draft - which no visitor can see - read Active.
 */
function statusOf(product: Record<string, unknown>): { label: string; live: boolean } {
  const status = String(product.content_status ?? "");
  if (product.visible && (status === "published" || status === "")) return { label: "Active", live: true };
  if (!product.visible) return { label: "Inactive", live: false };
  return { label: status.charAt(0).toUpperCase() + status.slice(1), live: false };
}

const STATUS_KEYS: Record<string, MessageKey> = {
  Active: "manager.products.status_active",
  Inactive: "manager.products.status_inactive",
  Draft: "manager.products.status_draft",
  Archived: "manager.products.status_archived",
}

const ProductList = () => {
  // Dates and numbers in the viewer's language (they were English only).
  const { t, formatDate, formatNumber } = useTranslation();
  const [viewingProduct, setViewingProduct] = useState<any>(null);

  /**
   * Products, and the demo count beside each, from the VPS.
   *
   * Both lists came from the browser Supabase client, which is built against
   * the hosted project - and hosted holds one product_demo_urls row while the
   * VPS holds seventeen. So every product in this list read "0 demos",
   * including the ones with a live demo on the storefront.
   *
   * It also pulled all 7,365 products across to render them. This asks for a
   * page, which is what the screen shows anyway and a request the catalogue can
   * still answer when it holds fifty thousand.
   */
  //
  // The first hundred were all it showed, of more than seven thousand, with no
  // way to the rest and no way to find one. It pages and searches on the
  // server now. (A second request for 2,000 demo rows was made and never
  // shown; it is no longer made.)
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [typed]);
  const productPage = useResource("products", { limit: PAGE, offset, search: search || undefined });
  const products = productPage.rows;
  const isLoading = productPage.loading;
  const total = productPage.total;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-violet-400" />
            {t("manager.products.list_title")}
          </h1>
          <p className="text-slate-400 text-sm">{t("manager.products.list_subtitle")}</p>
        </div>
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          <Lock className="w-3 h-3 mr-1" />
          {t("manager.products.list_badge")}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t("manager.products.search_placeholder")}
          aria-label={t("manager.products.search_placeholder")}
          className="max-w-sm bg-slate-800 border-slate-600 text-white"
        />
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>
            {productPage.failed
              ? "—"
              : total === 0
                ? "0"
                : t("manager.products.range", {
                    from: formatNumber(offset + 1),
                    to: formatNumber(Math.min(offset + PAGE, total)),
                    total: formatNumber(total),
                  })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
          >
            {t("manager.products.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || offset + PAGE >= total}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            {t("manager.products.next")}
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardContent className="p-0">
          <ScrollArea className="h-150">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50">
                  <TableHead className="text-slate-400">{t("manager.products.col_name")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_category")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_status")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_price")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_created")}</TableHead>
                  <TableHead className="text-slate-400 text-right">{t("manager.products.col_action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                      {t("manager.products.list_loading")}
                    </TableCell>
                  </TableRow>
                ) : productPage.failed ? (
                  // A failed read is not an empty catalogue.
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-red-400 py-8">
                      {t("manager.products.list_unreadable")}
                    </TableCell>
                  </TableRow>
                ) : products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                      {t("manager.products.list_empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  products?.map((product) => (
                    <TableRow key={product.id} className="border-slate-700/50">
                      <TableCell className="text-white font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-slate-300">{product.industry_label || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={statusOf(product).live ? "default" : "secondary"}
                          className={statusOf(product).live ? "bg-emerald-600" : "bg-slate-600"}
                        >
                          {STATUS_KEYS[statusOf(product).label] ? t(STATUS_KEYS[statusOf(product).label]) : statusOf(product).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {product.price_label || "-"}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {product.created_at ? formatDate(String(product.created_at), { dateStyle: "medium" }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingProduct(product)}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {t("manager.products.view")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* View Product Dialog */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-400" />
              {t("manager.products.details_read_only")}
            </DialogTitle>
          </DialogHeader>
              {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">{t("manager.products.col_name")}</p>
                  <p className="text-white font-medium">{viewingProduct.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("manager.products.col_category")}</p>
                  <p className="text-white">{viewingProduct.industry_label || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("manager.products.col_status")}</p>
                  <Badge className={statusOf(viewingProduct).live ? "bg-emerald-600" : "bg-slate-600"}>
                    {STATUS_KEYS[statusOf(viewingProduct).label] ? t(STATUS_KEYS[statusOf(viewingProduct).label]) : statusOf(viewingProduct).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("manager.products.pricing_model")}</p>
                  <p className="text-white">{t("manager.products.marketplace_product")}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("manager.products.lifetime_price")}</p>
                  <p className="text-white">{viewingProduct.price_label || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("manager.products.monthly_price")}</p>
                  <p className="text-white">-</p>
                </div>
              </div>
              {viewingProduct.description && (
                <div>
                  <p className="text-xs text-slate-400">{t("manager.products.description")}</p>
                  <p className="text-slate-300 text-sm">{viewingProduct.description}</p>
                </div>
              )}
              <div className="p-3 bg-slate-800/50 rounded-lg flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <p className="text-xs text-amber-400">{t("manager.products.list_read_only")}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductList;
