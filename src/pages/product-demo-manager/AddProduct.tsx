import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authHeaders } from "@/lib/auth/operator-fetch";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useResource } from "@/lib/manager/use-resource";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, AlertTriangle, Lock, Plus } from "lucide-react";

const productSchema = z.object({
  product_name: z.string().min(3, "Product name must be at least 3 characters"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  pricing_model: z.string().min(1, "Pricing plan is required"),
  lifetime_price: z.number().min(0).optional(),
  monthly_price: z.number().min(0).optional(),
  visibility: z.string().min(1),
});

type ProductFormData = z.infer<typeof productSchema>;

/**
 * An empty price is no price. Read with valueAsNumber it was NaN, which failed
 * the schema with no message on screen, so the form silently refused to submit
 * whenever either price was left blank.
 */
const priceInput = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : Number(value);

const featureOptions = [
  "Multi-user Support",
  "API Access",
  "Custom Branding",
  "Analytics Dashboard",
  "Export Reports",
  "Priority Support",
  "Mobile App",
  "Integrations",
];

interface AddProductProps {
  onSuccess: () => void;
}

const AddProduct = ({ onSuccess }: AddProductProps) => {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  /**
   * Categories from the catalogue the storefront reads.
   *
   * This and the insert below went through the browser Supabase client, which
   * is built against the hosted project - not the VPS database the marketplace
   * serves (the reason ProductList, the dashboard and analytics were moved off
   * it). A product created here was written somewhere no visitor could ever see
   * it, or refused there. Both go through /api/manager/resource now, the
   * server-side path every other catalogue write uses: operator-checked,
   * whitelisted, audited, and it empties the storefront caches.
   */
  const categoryPage = useResource("categories", { limit: 200, sort: "name", dir: "asc" });
  const categories = categoryPage.rows as { id: string; name: string }[];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      visibility: "global",
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      // The catalogue is marketplace_products (a "products" table was never
      // created). Price is stored as the label and period the storefront shows;
      // the new product starts as a draft and is published through the catalogue.
      const amount = data.pricing_model === "lifetime" ? data.lifetime_price : data.monthly_price;
      const base = data.product_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const response = await fetch("/api/manager/resource", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          resource: "products",
          values: {
            name: data.product_name,
            slug: `${base || "product"}-${crypto.randomUUID().slice(0, 8)}`,
            category_id: categories.find((cat) => cat.name === data.category)?.id ?? null,
            description: data.description || null,
            price_label: amount ? `₹${amount.toLocaleString("en-IN")}` : "",
            price_period: data.pricing_model === "subscription" ? "month" : data.pricing_model,
            features: selectedFeatures,
            visible: data.visibility !== "private",
          },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; row?: { id?: string } };
      if (!response.ok || !payload.ok || !payload.row?.id) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? t("manager.products.signin_to_add")
            : (payload.error ?? t("manager.products.not_created")),
        );
      }

      toast.success(t("manager.products.created"), {
        description: t("manager.products.created_as_draft")
      });
      onSuccess();
    } catch (error: any) {
      toast.error(t("manager.products.create_failed"), { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plus className="w-6 h-6 text-violet-400" />
          {t("manager.products.add_title")}
        </h1>
        <p className="text-slate-400 text-sm">{t("manager.products.read_only_here")}</p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-400 font-medium">{t("manager.products.policy_title")}</p>
          <p className="text-xs text-amber-400/70">{t("manager.products.policy_body")}</p>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-400" />
            {t("manager.products.details")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pm-product-name" className="text-slate-300">{t("manager.products.name_required")}</Label>
                <Input
                  id="pm-product-name"
                  {...register("product_name")}
                  placeholder={t("manager.products.name_placeholder")}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                {errors.product_name && (
                  <p className="text-xs text-red-400">{errors.product_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pm-category" className="text-slate-300">{t("manager.products.category_required")}</Label>
                <Select onValueChange={(val) => setValue("category", val)}>
                  <SelectTrigger id="pm-category" className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder={t("manager.products.category_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                    <SelectItem value="other">{t("manager.products.category_other")}</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-red-400">{errors.category.message}</p>
                )}
                {categoryPage.failed && (
                  <p className="text-xs text-red-400">{t("manager.products.categories_unreadable")}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-description" className="text-slate-300">{t("manager.products.description")}</Label>
              <Textarea
                id="pm-description"
                {...register("description")}
                placeholder={t("manager.products.description_placeholder")}
                className="bg-slate-800 border-slate-600 text-white min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">{t("manager.products.features")}</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {featureOptions.map((feature) => (
                  <label
                    key={feature}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors"
                  >
                    <Checkbox
                      checked={selectedFeatures.includes(feature)}
                      onCheckedChange={() => toggleFeature(feature)}
                    />
                    <span className="text-xs text-slate-300">{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pm-pricing-model" className="text-slate-300">{t("manager.products.pricing_model_required")}</Label>
                <Select onValueChange={(val) => setValue("pricing_model", val)}>
                  <SelectTrigger id="pm-pricing-model" className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder={t("manager.products.pricing_model_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lifetime">{t("manager.products.pricing_lifetime")}</SelectItem>
                    <SelectItem value="subscription">{t("manager.products.pricing_subscription")}</SelectItem>
                    <SelectItem value="freemium">{t("manager.products.pricing_freemium")}</SelectItem>
                  </SelectContent>
                </Select>
                {errors.pricing_model && (
                  <p className="text-xs text-red-400">{errors.pricing_model.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pm-lifetime-price" className="text-slate-300">{t("manager.products.lifetime_price_label")}</Label>
                <Input
                  id="pm-lifetime-price"
                  type="number"
                  {...register("lifetime_price", { setValueAs: priceInput })}
                  placeholder="0"
                  className="bg-slate-800 border-slate-600 text-white"
                />
                {errors.lifetime_price && (
                  <p className="text-xs text-red-400">{errors.lifetime_price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pm-monthly-price" className="text-slate-300">{t("manager.products.monthly_price_label")}</Label>
                <Input
                  id="pm-monthly-price"
                  type="number"
                  {...register("monthly_price", { setValueAs: priceInput })}
                  placeholder="0"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-visibility" className="text-slate-300">{t("manager.products.visibility")}</Label>
              <Select defaultValue="global" onValueChange={(val) => setValue("visibility", val)}>
                <SelectTrigger id="pm-visibility" className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">{t("manager.products.visibility_global")}</SelectItem>
                  <SelectItem value="country">{t("manager.products.visibility_country")}</SelectItem>
                  <SelectItem value="private">{t("manager.products.visibility_private")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                {isSubmitting ? (
                  t("manager.products.creating")
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    {t("manager.products.create_button")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddProduct;
