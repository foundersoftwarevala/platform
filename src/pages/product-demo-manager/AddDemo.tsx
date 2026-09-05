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
import { MonitorPlay, AlertTriangle, Lock, Plus, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { DemoUrlManagerSection } from "@/components/marketplace-manager/sections/DemoUrlManager";

const demoSchema = z.object({
  title: z.string().min(3, "Demo title must be at least 3 characters"),
  category: z.string().min(1, "Category is required"),
  demo_type: z.string().min(1, "Demo type is required"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
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
  return <DemoUrlManagerSection />;

  /* Legacy wizard retained below for reference; the live manager owns the
     product_demo_urls contract and provides the complete CRUD/audit flow. */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validityDays, setValidityDays] = useState(14);
  const [step, setStep] = useState(1);

  const { data: categories } = useQuery({
    queryKey: ["demo-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("demo_categories").select("id, name");
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

  const onSubmit = async (data: DemoFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("demos").insert({
        title: data.title,
        category: data.category,
        demo_type: data.demo_type,
        url: data.url,
        description: data.description,
        status: "active",
      });

      if (error) throw error;

      toast.success("Demo created successfully!", {
        description: "Demo is now READ-ONLY and cannot be edited."
      });
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to create demo", { description: error.message });
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
