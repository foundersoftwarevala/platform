import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trophy, Award as AwardIcon, Crown, Sparkles, Save, Send, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaUploader } from "@/components/ams/shared/MediaUploader";
import { RuleBuilder } from "@/components/ams/shared/RuleBuilder";
import { PreviewStage } from "@/components/ams/shared/PreviewStage";
import {
  AWARD_CATEGORIES, RARITIES, DEPARTMENTS,
  type Award, type AwardCategory, type AwardRewards,
  type AwardType, type AwardMedia, type Rarity, type Department,
  type UnlockCondition, type AwardVisibility,
} from "@/lib/ams/types";

import {
  createAward, updateAward, publishAward,
} from "@/lib/ams/awards.api";
import { toast } from "sonner";

const TYPES: AwardType[] = ["trophy", "badge", "achievement", "rank", "milestone", "streak"];
const VISIBILITIES: AwardVisibility[] = ["public", "private", "role-restricted", "module-restricted"];

interface FormState {
  name: string;
  description: string;
  type: AwardType;
  category: AwardCategory;
  rarity: Rarity;
  department?: Department;
  priority: number;
  visibility: AwardVisibility;
  media: AwardMedia;
  rewards: AwardRewards;
  unlockConditions: UnlockCondition[];
  supportedModules: string[];
  supportedRoles: string[];
}


function init(award?: Award | null): FormState {
  return {
    name: award?.name ?? "",
    description: award?.description ?? "",
    type: award?.type ?? "trophy",
    category: award?.category ?? "global",
    rarity: award?.rarity ?? "common",
    department: award?.department,
    priority: award?.priority ?? 0,

    visibility: award?.visibility ?? "public",
    media: award?.media ?? {},
    rewards: award?.rewards ?? { xp: 0, coins: 0, rankImpact: 0, levelImpact: 0, monetaryValue: 0 },
    unlockConditions: award?.unlockConditions ?? [],
    supportedModules: award?.supportedModules ?? [],
    supportedRoles: award?.supportedRoles ?? [],
  };
}

export function AwardForm({ initial, mode = "create" }: { initial?: Award | null; mode?: "create" | "edit" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(init(initial));
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      let saved: Award;
      if (mode === "edit" && initial) {
        saved = await updateAward(initial.id, { ...form });
      } else {
        saved = await createAward(form);
      }
      if (publish) saved = await publishAward(saved.id);
      return saved;
    },
    onSuccess: async (saved, publish) => {
      await qc.invalidateQueries({ queryKey: ["awards"] });
      toast.success(publish ? "Award published" : "Award saved");
      navigate({ to: "/awards/$id", params: { id: saved.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewAward = useMemo(() => ({
    name: form.name || "Untitled Award", type: form.type, rarity: form.rarity,
    department: form.department, media: form.media,
  }), [form]);


  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <Tabs defaultValue="basics">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="visibility">Visibility</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="surface-card p-5 space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Top Affiliate of the Quarter" />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Awarded for…" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => patch({ type: v as AwardType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => patch({ category: v as AwardCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AWARD_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rarity</Label>
                <Select value={form.rarity} onValueChange={(v) => patch({ rarity: v as Rarity })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RARITIES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={form.department ?? "_none"} onValueChange={(v) => patch({ department: v === "_none" ? undefined : (v as Department) })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No department</SelectItem>
                    {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Input type="number" value={form.priority} onChange={(e) => patch({ priority: Number(e.target.value) })} />
              </div>

            </div>
          </TabsContent>

          <TabsContent value="media" className="mt-4">
            <MediaUploader value={form.media} onChange={(m) => patch({ media: m })} />
          </TabsContent>

          <TabsContent value="rules" className="surface-card p-5 space-y-4 mt-4">
            <div>
              <Label className="text-sm">Unlock conditions</Label>
              <p className="text-xs text-muted-foreground mb-3">All conditions must be true for the award to fire.</p>
              <RuleBuilder value={form.unlockConditions} onChange={(c) => patch({ unlockConditions: c })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label>Supported modules</Label>
                <Input
                  placeholder="comma-separated, e.g. sales, marketplace"
                  value={form.supportedModules.join(", ")}
                  onChange={(e) => patch({ supportedModules: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Supported roles</Label>
                <Input
                  placeholder="comma-separated, e.g. affiliate, vendor"
                  value={form.supportedRoles.join(", ")}
                  onChange={(e) => patch({ supportedRoles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="surface-card p-5 grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {([
              ["xp", "XP", Sparkles],
              ["coins", "Coins", Trophy],
              ["rankImpact", "Rank impact", Crown],
              ["levelImpact", "Level impact", AwardIcon],
              ["monetaryValue", "Monetary", Trophy],
            ] as const).map(([key, label, Icon]) => (
              <div key={key} className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-trophy" /> {label}</Label>
                <Input type="number" value={form.rewards[key]} onChange={(e) => patch({ rewards: { ...form.rewards, [key]: Number(e.target.value) } })} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={form.rewards.currency ?? ""} onChange={(e) => patch({ rewards: { ...form.rewards, currency: e.target.value || undefined } })} placeholder="USD" />
            </div>
          </TabsContent>

          <TabsContent value="visibility" className="surface-card p-5 space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v) => patch({ visibility: v as AwardVisibility })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VISIBILITIES.map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Public awards appear in catalogs. Role/module-restricted awards only render for matching audiences.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => navigate({ to: "/awards" })} className="gap-1.5">
            <X className="h-4 w-4" /> Cancel
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending || !form.name} className="gap-1.5">
              <Save className="h-4 w-4" /> Save draft
            </Button>
            <Button onClick={() => save.mutate(true)} disabled={save.isPending || !form.name} className="gap-1.5 bg-gradient-to-r from-trophy to-legendary text-background hover:opacity-90">
              <Send className="h-4 w-4" /> Save & publish
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live preview</div>
        <PreviewStage award={previewAward} />
      </div>
    </div>
  );
}
