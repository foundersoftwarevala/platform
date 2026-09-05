import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
import { useQuery } from "@tanstack/react-query";

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

  const { data: categories } = useQuery({
    queryKey: ["business-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("business_categories").select("id, name");
      return data || [];
    }
  });

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
      const { error } = await supabase.from("products").insert({
        product_name: data.product_name,
        category: data.category,
        description: data.description,
        pricing_model: data.pricing_model,
        lifetime_price: data.lifetime_price || 0,
        monthly_price: data.monthly_price || 0,
        features_json: selectedFeatures,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Product created successfully!", {
        description: "Product is now READ-ONLY and cannot be edited."
      });
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to create product", { description: error.message });
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
          Add New Product
        </h1>
        <p className="text-slate-400 text-sm">Once submitted, product becomes READ-ONLY forever</p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-400 font-medium">Immutable Data Policy</p>
          <p className="text-xs text-amber-400/70">This product cannot be edited or deleted after creation. Review carefully before submitting.</p>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-400" />
            Product Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Product Name *</Label>
                <Input
                  {...register("product_name")}
                  placeholder="Enter product name"
                  className="bg-slate-800 border-slate-600 text-white"
                />
                {errors.product_name && (
                  <p className="text-xs text-red-400">{errors.product_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Category *</Label>
                <Select onValueChange={(val) => setValue("category", val)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-red-400">{errors.category.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Description</Label>
              <Textarea
                {...register("description")}
                placeholder="Product description..."
                className="bg-slate-800 border-slate-600 text-white min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Features</Label>
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
                <Label className="text-slate-300">Pricing Model *</Label>
                <Select onValueChange={(val) => setValue("pricing_model", val)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="freemium">Freemium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Lifetime Price (₹)</Label>
                <Input
                  type="number"
                  {...register("lifetime_price", { valueAsNumber: true })}
                  placeholder="0"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Monthly Price (₹)</Label>
                <Input
                  type="number"
                  {...register("monthly_price", { valueAsNumber: true })}
                  placeholder="0"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Visibility</Label>
              <Select defaultValue="global" onValueChange={(val) => setValue("visibility", val)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="country">Country Specific</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
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
                  "Creating..."
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Create Product (Locked Forever)
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
