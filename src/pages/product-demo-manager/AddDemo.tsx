import { Suspense, lazy, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { MonitorPlay, AlertTriangle, Lock, Plus, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
/**
 * Loaded on demand, not at module scope.
 *
 * A static import of this section from here put Add Demo inside a module cycle
 * reaching back through marketplace-manager, and the chunk threw "Cannot access
 * G before initialization" the moment it evaluated - so the whole screen showed
 * "This page did not load". lazy() is the pattern the role dashboards already use
 * for heavy cross-module screens, and it keeps the edge out of the static graph.
 */
const DemoUrlManagerSection = lazy(() =>
  import("@/components/marketplace-manager/sections/DemoUrlManager").then((m) => ({
    default: m.DemoUrlManagerSection,
  })),
);

/**
 * operator-fetch is imported where it is used rather than at the top.
 *
 * A static import of it from this screen produced "Cannot access G before
 * initialization" at render - a module cycle through the Supabase client that
 * only bit once this file joined it - and the whole Add Demo screen fell to the
 * error boundary. Imported inside the two functions that need it, the cycle is
 * not there to trip over.
 */
const demoSchema = z.object({
  title: z.string().min(3, "Demo title must be at least 3 characters"),
  category: z.string().min(1, "Category is required"),
  demo_type: z.string().min(1, "Demo type is required"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  /**
   * The product this demo hangs on.
   *
   * Required, because a demo without one is unreachable: the proxy looks a demo
   * up by product and so does the storefront badge. This form had no product
   * field at all and wrote into `demos`, a table with no product relationship
   * that the storefront has never read - so every demo added here was invisible
   * and the screen said "Demo created successfully".
   */
  product: z.string().min(1, "Choose the product this demo belongs to"),
});

type DemoFormData = z.infer<typeof demoSchema>;

interface AddDemoProps {
  onSuccess: () => void;
}

const demoTypes = [
  { value: "time_based", label: "Time Based", description: "Access expires after set days" },
  { value: "feature_limited", label: "Feature Limited", description: "Limited features available" },
  { value: "user_limited", label: "User Limited", description: "Limited user accounts" },
];

const AddDemo = ({ onSuccess }: AddDemoProps) => {
  void onSuccess;
  return <Suspense fallback={<p className="text-sm text-slate-400">Loading the URL manager…</p>}><DemoUrlManagerSection /></Suspense>;

  /* Legacy wizard retained below for reference; the live manager owns the
     product_demo_urls contract and provides the complete CRUD/audit flow. */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validityDays, setValidityDays] = useState(14);
  const [step, setStep] = useState(1);

  const { data: categories } = useQuery({
    queryKey: ["demo-categories"],
    queryFn: async () => {
      // Read through the server: the browser client talks to hosted Supabase,
      // where demo_categories is empty, while the ninety categories are on the
      // VPS with the rest of the platform's data.
      const serverRows = await listDemoCategories().catch(() => []);
      const data = serverRows.map((row) => ({ id: row.name, name: row.name }));
      return data || [];
    }
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DemoFormData>({
    resolver: zodResolver(demoSchema),
  });

  const selectedType = watch("demo_type");
  const chosenProduct = watch("product");

  /**
   * Products to attach the demo to, searched from the real catalogue.
   *
   * /api/demo/process?products= is the operator-gated search the pipeline
   * already exposes, so this screen asks the same question the rest of the
   * module asks rather than introducing another path to the catalogue.
   */
  const [productTerm, setProductTerm] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const productHits = useQuery({
    queryKey: ["add-demo-products", productQuery],
    enabled: productQuery.trim().length >= 2,
    queryFn: async (): Promise<{ id: string; name: string; slug: string }[]> => {
      const response = await fetch(
        `/api/demo/process?products=${encodeURIComponent(productQuery.trim())}`,
        { headers: await (await import("@/lib/auth/operator-fetch")).authHeaders() },
      );
      if (!response.ok) throw new Error("The catalogue could not be searched");
      const body = (await response.json()) as { products?: { id: string; name: string; slug: string }[] };
      return body.products ?? [];
    },
  });

  const onSubmit = async (data: DemoFormData) => {
    setIsSubmitting(true);
    try {
      /**
       * The same canonical path Bulk Add uses.
       *
       * This wrote straight into `demos` with status "active" and reported
       * success. /api/demo/assign writes product_demo_urls, refuses a duplicate
       * mapping, refuses an address this server cannot reach, and reports what
       * actually happened per row - so the toast below can only say what the
       * database did.
       *
       * Nothing is published here. A new row is inactive and unprocessed and
       * still has to go through investigate and activate.
       */
      const response = await fetch("/api/demo/assign", {
        method: "POST",
        headers: {
          ...(await (await import("@/lib/auth/operator-fetch")).authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "commit",
          rows: [{ url: data.url, name: data.title, product: data.product }],
        }),
      });
      const report = (await response.json()) as {
        error?: string;
        rows?: { state: string; reason: string; productSlug?: string | null }[];
      };
      if (!response.ok) throw new Error(report.error ?? "The demo could not be taken in");

      const row = report.rows?.[0];
      if (!row) throw new Error("The server returned no result for this demo");

      if (row.state === "ASSIGNED") {
        toast.success("Demo added", {
          description: `Attached to ${row.productSlug ?? "the product"}. It is not live yet — investigate and activate it next.`,
        });
        onSuccess();
        return;
      }

      // Anything else is a real outcome the operator has to see, not a failure
      // to hide and not a success to claim.
      toast.error(`Not added: ${row.state}`, { description: row.reason });
    } catch (error: unknown) {
      toast.error("Failed to add demo", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plus className="w-6 h-6 text-blue-400" />
          Create New Demo
        </h1>
        <p className="text-slate-400 text-sm">Once submitted, demo becomes READ-ONLY forever</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              step >= s ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"
            )}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={cn("w-12 h-0.5", step > s ? "bg-blue-600" : "bg-slate-700")} />}
          </div>
        ))}
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-400 font-medium">Immutable Data Policy</p>
          <p className="text-xs text-amber-400/70">This demo cannot be edited or deleted after creation.</p>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MonitorPlay className="w-5 h-5 text-blue-400" />
            Demo Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Basic Details */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Demo Title *</Label>
                  <Input
                    {...register("title")}
                    placeholder="Enter demo title"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                  {errors.title && (
                    <p className="text-xs text-red-400">{errors.title.message}</p>
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
                      <SelectItem value="SaaS">SaaS</SelectItem>
                      <SelectItem value="E-commerce">E-commerce</SelectItem>
                      <SelectItem value="CRM">CRM</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="button" onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-700">
                  Next: Select Demo Type
                </Button>
              </div>
            )}

            {/* Step 2: Demo Type */}
            {step === 2 && (
              <div className="space-y-4">
                <Label className="text-slate-300">Demo Type *</Label>
                <div className="grid gap-3">
                  {demoTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setValue("demo_type", type.value)}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all",
                        selectedType === type.value
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                      )}
                    >
                      <p className="text-white font-medium">{type.label}</p>
                      <p className="text-xs text-slate-400">{type.description}</p>
                    </button>
                  ))}
                </div>

                {selectedType === "time_based" && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Validity Days</Label>
                    <Input
                      type="number"
                      value={validityDays}
                      onChange={(e) => setValidityDays(parseInt(e.target.value))}
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep(3)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    Next: Final Details
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Final Details */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Product</Label>
                  <div className="flex gap-2">
                    <Input
                      value={productTerm}
                      onChange={(e) => setProductTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setProductQuery(productTerm);
                        }
                      }}
                      placeholder="Search the catalogue — at least two letters"
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setProductQuery(productTerm)}
                    >
                      Search
                    </Button>
                  </div>
                  {productHits.data && productHits.data.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-slate-700">
                      {productHits.data.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setValue("product", product.id, { shouldValidate: true })}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                            chosenProduct === product.id
                              ? "bg-blue-600/20 text-white"
                              : "text-slate-300 hover:bg-slate-800",
                          )}
                        >
                          <span className="truncate">{product.name}</span>
                          {chosenProduct === product.id && <Check className="h-4 w-4 text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                  {productHits.data && productHits.data.length === 0 && (
                    <p className="text-xs text-slate-400">Nothing in the catalogue matched that.</p>
                  )}
                  {errors.product && (
                    <p className="text-xs text-red-400">{errors.product.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Demo URL</Label>
                  <Input
                    {...register("url")}
                    placeholder="https://demo.example.com"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                  {errors.url && (
                    <p className="text-xs text-red-400">{errors.url.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    {...register("description")}
                    placeholder="Demo description..."
                    className="bg-slate-800 border-slate-600 text-white min-h-25"
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSubmitting ? (
                      "Creating..."
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Create Demo (Locked Forever)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddDemo;
