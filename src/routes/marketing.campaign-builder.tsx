import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Layers, Pencil, Plus, Target, Trash2 } from "lucide-react";

import {
  ProgressBar,
  QueryState,
  ScreenHeader,
  SectionCard,
  StatusBadge,
} from "@/components/marketing/kit";
import {
  CampaignForm,
  campaignToForm,
  emptyCampaign,
  type CampaignFormValues,
} from "@/components/marketing/campaign-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  recordAudit,
  tableQuery,
  useCreateRow,
  useDeleteRow,
  useUpdateRow,
  type Row,
} from "@/lib/marketing/api";
import { compactInr, num, shortDate } from "@/lib/marketing/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketing/campaign-builder")({
  head: () => ({
    meta: [
      { title: "Campaign Builder — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Build and edit Software Vala campaigns end to end: campaign settings, ad groups and linked creatives in one workspace.",
      },
      { property: "og:title", content: "Campaign Builder — Software Vala" },
      {
        property: "og:description",
        content: "Create campaigns and their ad group → creative hierarchy against live data.",
      },
    ],
  }),
  component: CampaignBuilderScreen,
});

type Campaign = Row<"marketing_campaigns">;
type AdGroup = Row<"marketing_ad_groups">;
type Creative = Row<"marketing_creatives">;

const AD_GROUP_LEVELS = ["ad_group", "ad_set", "keyword_group", "audience"] as const;
const AD_GROUP_PLATFORMS = [
  "Google Ads",
  "Meta Ads",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "WhatsApp",
  "Email",
] as const;
const AD_GROUP_STATUSES = ["draft", "active", "paused", "completed"] as const;
const CREATIVE_TYPES = ["image", "video", "carousel", "html5", "copy"] as const;
const CREATIVE_FORMATS = ["static", "animated", "story", "reel", "banner", "email"] as const;
const CREATIVE_STATUSES = ["draft", "in_review", "approved", "active", "archived"] as const;

type AdGroupForm = {
  name: string;
  platform: string;
  level: string;
  status: string;
  budget: number;
};

type CreativeForm = {
  name: string;
  asset_type: string;
  format: string;
  status: string;
  dimensions: string;
  tags: string;
  uploaded_by: string;
};

const emptyAdGroup = (platform: string): AdGroupForm => ({
  name: "",
  platform,
  level: "ad_group",
  status: "draft",
  budget: 25000,
});

const emptyCreative = (): CreativeForm => ({
  name: "",
  asset_type: "image",
  format: "static",
  status: "draft",
  dimensions: "1080x1080",
  tags: "",
  uploaded_by: "",
});

function CampaignBuilderScreen() {
  const campaigns = useQuery(tableQuery("marketing_campaigns", { column: "created_at" }));
  const adGroups = useQuery(tableQuery("marketing_ad_groups", { column: "created_at" }));
  const creatives = useQuery(tableQuery("marketing_creatives", { column: "created_at" }));

  const createCampaign = useCreateRow("marketing_campaigns");
  const updateCampaign = useUpdateRow("marketing_campaigns");
  const createGroup = useCreateRow("marketing_ad_groups");
  const updateGroup = useUpdateRow("marketing_ad_groups");
  const deleteGroup = useDeleteRow("marketing_ad_groups");
  const createCreative = useCreateRow("marketing_creatives");
  const updateCreative = useUpdateRow("marketing_creatives");
  const deleteCreative = useDeleteRow("marketing_creatives");

  const rows = campaigns.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => rows.find((c) => c.id === selectedId) ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    if (!selectedId && rows.length > 0) setSelectedId(rows[0]!.id);
  }, [rows, selectedId]);

  const [campaignForm, setCampaignForm] = useState<CampaignFormValues>(emptyCampaign());
  const [mode, setMode] = useState<"create" | "edit">("edit");

  useEffect(() => {
    if (mode === "edit" && selected) setCampaignForm(campaignToForm(selected));
  }, [selected, mode]);

  const [groupForm, setGroupForm] = useState<AdGroupForm | null>(null);
  const [editingGroup, setEditingGroup] = useState<AdGroup | null>(null);
  const [creativeForm, setCreativeForm] = useState<CreativeForm | null>(null);
  const [editingCreative, setEditingCreative] = useState<Creative | null>(null);

  const groups = (adGroups.data ?? []).filter((g) => g.campaign_id === selected?.id);
  const assets = (creatives.data ?? []).filter((c) => c.campaign_id === selected?.id);

  /* ------------------------------------------------------------ campaign */

  const submitCampaign = () => {
    const values = {
      code: campaignForm.code.trim(),
      name: campaignForm.name.trim(),
      channel: campaignForm.channel,
      objective: campaignForm.objective,
      status: campaignForm.status,
      start_date: campaignForm.start_date,
      end_date: campaignForm.end_date,
      budget: campaignForm.budget,
      kpi_target: campaignForm.kpi_target.trim() || null,
      region: campaignForm.region || null,
      owner: campaignForm.owner.trim() || null,
    };

    if (mode === "edit" && selected) {
      updateCampaign.mutate(
        { id: selected.id, values: { ...values, updated_at: new Date().toISOString() } },
        {
          onSuccess: (saved) => {
            void recordAudit({
              actor: "marketing_manager",
              action: "update",
              entity_type: "campaign",
              entity_id: saved.id,
              entity_name: saved.name,
              module: "campaign_builder",
              details: "Campaign settings updated in builder",
            });
            toast.success("Campaign saved");
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
      return;
    }

    createCampaign.mutate(values, {
      onSuccess: (saved) => {
        void recordAudit({
          actor: "marketing_manager",
          action: "create",
          entity_type: "campaign",
          entity_id: saved.id,
          entity_name: saved.name,
          module: "campaign_builder",
          details: `Campaign built on ${saved.channel}`,
        });
        toast.success(`Created “${saved.name}”`);
        setSelectedId(saved.id);
        setMode("edit");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  /* ----------------------------------------------------------- ad groups */

  const submitGroup = () => {
    if (!groupForm || !selected) return;
    if (!groupForm.name.trim()) {
      toast.error("Ad group name is required");
      return;
    }

    const values = {
      campaign_id: selected.id,
      name: groupForm.name.trim(),
      platform: groupForm.platform,
      level: groupForm.level,
      status: groupForm.status,
      budget: groupForm.budget,
    };

    const done = (action: string) => (saved: AdGroup) => {
      void recordAudit({
        actor: "marketing_manager",
        action,
        entity_type: "ad_group",
        entity_id: saved.id,
        entity_name: saved.name,
        module: "campaign_builder",
        details: `${action === "create" ? "Added to" : "Updated in"} ${selected.name}`,
      });
      toast.success(action === "create" ? "Ad group added" : "Ad group updated");
      setGroupForm(null);
      setEditingGroup(null);
    };

    if (editingGroup) {
      updateGroup.mutate(
        { id: editingGroup.id, values },
        { onSuccess: done("update"), onError: (e: Error) => toast.error(e.message) },
      );
    } else {
      createGroup.mutate(values, {
        onSuccess: done("create"),
        onError: (e: Error) => toast.error(e.message),
      });
    }
  };

  const removeGroup = (g: AdGroup) => {
    deleteGroup.mutate(g.id, {
      onSuccess: () => {
        void recordAudit({
          actor: "marketing_manager",
          action: "delete",
          entity_type: "ad_group",
          entity_id: g.id,
          entity_name: g.name,
          module: "campaign_builder",
          details: "Ad group removed",
        });
        toast.success("Ad group removed");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  /* ----------------------------------------------------------- creatives */

  const submitCreative = () => {
    if (!creativeForm || !selected) return;
    if (!creativeForm.name.trim()) {
      toast.error("Creative name is required");
      return;
    }

    const values = {
      campaign_id: selected.id,
      name: creativeForm.name.trim(),
      asset_type: creativeForm.asset_type,
      format: creativeForm.format,
      status: creativeForm.status,
      dimensions: creativeForm.dimensions.trim() || null,
      tags: creativeForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      uploaded_by: creativeForm.uploaded_by.trim() || null,
    };

    const done = (action: string) => (saved: Creative) => {
      void recordAudit({
        actor: "marketing_manager",
        action,
        entity_type: "creative",
        entity_id: saved.id,
        entity_name: saved.name,
        module: "campaign_builder",
        details: `${action === "create" ? "Linked to" : "Updated in"} ${selected.name}`,
      });
      toast.success(action === "create" ? "Creative linked" : "Creative updated");
      setCreativeForm(null);
      setEditingCreative(null);
    };

    if (editingCreative) {
      updateCreative.mutate(
        { id: editingCreative.id, values },
        { onSuccess: done("update"), onError: (e: Error) => toast.error(e.message) },
      );
    } else {
      createCreative.mutate(values, {
        onSuccess: done("create"),
        onError: (e: Error) => toast.error(e.message),
      });
    }
  };

  const removeCreative = (c: Creative) => {
    deleteCreative.mutate(c.id, {
      onSuccess: () => {
        void recordAudit({
          actor: "marketing_manager",
          action: "delete",
          entity_type: "creative",
          entity_id: c.id,
          entity_name: c.name,
          module: "campaign_builder",
          details: "Creative unlinked",
        });
        toast.success("Creative removed");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  /* --------------------------------------------------------------- view */

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Campaign Builder"
        description="Compose a campaign, then build its ad group → creative hierarchy against live data."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setMode("create");
              setCampaignForm(emptyCampaign());
            }}
          >
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <SectionCard title="Campaigns" description="Select a campaign to build.">
          <QueryState
            isLoading={campaigns.isLoading}
            error={campaigns.error}
            data={rows}
            emptyMessage="No campaigns yet — create your first one."
            skeletonRows={6}
          >
            {(data) => (
              <ul className="space-y-2">
                {data.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setMode("edit");
                      }}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        selectedId === c.id && mode === "edit"
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/50 bg-secondary/30 hover:bg-secondary/60",
                      )}
                    >
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.code} · {c.channel}
                      </p>
                      <div className="mt-2">
                        <ProgressBar value={Number(c.spend)} max={Number(c.budget)} tone="teal" />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <StatusBadge value={c.status} className="text-[10px]" />
                        <span className="text-[11px] text-muted-foreground">
                          {compactInr(Number(c.budget))}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </SectionCard>

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="settings">
              <Target className="mr-2 h-4 w-4" /> Campaign
            </TabsTrigger>
            <TabsTrigger value="groups" disabled={mode === "create" || !selected}>
              <Layers className="mr-2 h-4 w-4" /> Ad groups ({groups.length})
            </TabsTrigger>
            <TabsTrigger value="creatives" disabled={mode === "create" || !selected}>
              <ImageIcon className="mr-2 h-4 w-4" /> Creatives ({assets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <SectionCard
              title={mode === "create" ? "New campaign" : `Edit ${selected?.name ?? "campaign"}`}
              description={
                mode === "create"
                  ? "Saved directly to the marketing database — delivery metrics start at zero."
                  : "Changes are written straight to the live campaign record."
              }
              actions={
                mode === "create" && rows.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                    Back to selection
                  </Button>
                ) : null
              }
            >
              <CampaignForm
                value={campaignForm}
                onChange={setCampaignForm}
                onSubmit={submitCampaign}
                submitLabel={mode === "create" ? "Create campaign" : "Save changes"}
                isPending={createCampaign.isPending || updateCampaign.isPending}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="groups">
            <SectionCard
              title="Ad groups"
              description={`Hierarchy under ${selected?.name ?? "—"}`}
              actions={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGroup(null);
                    setGroupForm(emptyAdGroup(selected?.channel ?? AD_GROUP_PLATFORMS[0]));
                  }}
                >
                  <Plus className="h-4 w-4" /> Add ad group
                </Button>
              }
            >
              <QueryState
                isLoading={adGroups.isLoading}
                error={adGroups.error}
                data={groups}
                emptyMessage="No ad groups yet for this campaign."
              >
                {(data) => (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ad group</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Budget</TableHead>
                          <TableHead className="text-right">Spend</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Conv.</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{g.name}</TableCell>
                            <TableCell className="text-muted-foreground">{g.platform}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">
                              {g.level.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              <StatusBadge value={g.status} />
                            </TableCell>
                            <TableCell className="text-right">{compactInr(Number(g.budget))}</TableCell>
                            <TableCell className="text-right">{compactInr(Number(g.spend))}</TableCell>
                            <TableCell className="text-right">{num(Number(g.clicks))}</TableCell>
                            <TableCell className="text-right">{num(Number(g.conversions))}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Edit ad group"
                                  onClick={() => {
                                    setEditingGroup(g);
                                    setGroupForm({
                                      name: g.name,
                                      platform: g.platform,
                                      level: g.level,
                                      status: g.status,
                                      budget: Number(g.budget),
                                    });
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Delete ad group"
                                  onClick={() => removeGroup(g)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </QueryState>
            </SectionCard>
          </TabsContent>

          <TabsContent value="creatives">
            <SectionCard
              title="Creatives"
              description={`Assets linked to ${selected?.name ?? "—"}`}
              actions={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCreative(null);
                    setCreativeForm(emptyCreative());
                  }}
                >
                  <Plus className="h-4 w-4" /> Add creative
                </Button>
              }
            >
              <QueryState
                isLoading={creatives.isLoading}
                error={creatives.error}
                data={assets}
                emptyMessage="No creatives linked to this campaign."
              >
                {(data) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-border/50 bg-secondary/30 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.asset_type} · {c.format}
                              {c.dimensions ? ` · ${c.dimensions}` : ""}
                            </p>
                          </div>
                          <StatusBadge value={c.status} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Score {Number(c.performance_score).toFixed(1)} · used {c.usage_count}×
                          </span>
                          <span>{shortDate(c.created_at)}</span>
                        </div>
                        <div className="mt-3 flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit creative"
                            onClick={() => {
                              setEditingCreative(c);
                              setCreativeForm({
                                name: c.name,
                                asset_type: c.asset_type,
                                format: c.format,
                                status: c.status,
                                dimensions: c.dimensions ?? "",
                                tags: c.tags.join(", "),
                                uploaded_by: c.uploaded_by ?? "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Remove creative"
                            onClick={() => removeCreative(c)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </QueryState>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* ad group dialog */}
      <Dialog open={groupForm !== null} onOpenChange={(o) => !o && (setGroupForm(null), setEditingGroup(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit ad group" : "Add ad group"}</DialogTitle>
            <DialogDescription>
              Ad groups sit under {selected?.name ?? "the selected campaign"} and hold their own
              budget and delivery.
            </DialogDescription>
          </DialogHeader>
          {groupForm ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ag-name">Name</Label>
                <Input
                  id="ag-name"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Bengaluru — SMB retargeting"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Platform</Label>
                  <Select
                    value={groupForm.platform}
                    onValueChange={(v) => setGroupForm({ ...groupForm, platform: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set([groupForm.platform, ...AD_GROUP_PLATFORMS])).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Select
                    value={groupForm.level}
                    onValueChange={(v) => setGroupForm({ ...groupForm, level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AD_GROUP_LEVELS.map((l) => (
                        <SelectItem key={l} value={l} className="capitalize">
                          {l.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={groupForm.status}
                    onValueChange={(v) => setGroupForm({ ...groupForm, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AD_GROUP_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ag-budget">Budget (₹)</Label>
                  <Input
                    id="ag-budget"
                    type="number"
                    min={0}
                    value={groupForm.budget}
                    onChange={(e) => setGroupForm({ ...groupForm, budget: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setGroupForm(null);
                    setEditingGroup(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitGroup}
                  disabled={createGroup.isPending || updateGroup.isPending}
                >
                  {editingGroup ? "Save ad group" : "Add ad group"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* creative dialog */}
      <Dialog
        open={creativeForm !== null}
        onOpenChange={(o) => !o && (setCreativeForm(null), setEditingCreative(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCreative ? "Edit creative" : "Add creative"}</DialogTitle>
            <DialogDescription>
              Creatives are linked to {selected?.name ?? "the selected campaign"} and reused across
              ad groups.
            </DialogDescription>
          </DialogHeader>
          {creativeForm ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cr-name">Name</Label>
                <Input
                  id="cr-name"
                  value={creativeForm.name}
                  onChange={(e) => setCreativeForm({ ...creativeForm, name: e.target.value })}
                  placeholder="Diwali offer — square static"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Asset type</Label>
                  <Select
                    value={creativeForm.asset_type}
                    onValueChange={(v) => setCreativeForm({ ...creativeForm, asset_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATIVE_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Format</Label>
                  <Select
                    value={creativeForm.format}
                    onValueChange={(v) => setCreativeForm({ ...creativeForm, format: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATIVE_FORMATS.map((f) => (
                        <SelectItem key={f} value={f} className="capitalize">
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={creativeForm.status}
                    onValueChange={(v) => setCreativeForm({ ...creativeForm, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATIVE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cr-dim">Dimensions</Label>
                  <Input
                    id="cr-dim"
                    value={creativeForm.dimensions}
                    onChange={(e) =>
                      setCreativeForm({ ...creativeForm, dimensions: e.target.value })
                    }
                    placeholder="1080x1080"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cr-tags">Tags (comma separated)</Label>
                  <Input
                    id="cr-tags"
                    value={creativeForm.tags}
                    onChange={(e) => setCreativeForm({ ...creativeForm, tags: e.target.value })}
                    placeholder="festival, offer, hindi"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cr-owner">Uploaded by</Label>
                  <Input
                    id="cr-owner"
                    value={creativeForm.uploaded_by}
                    onChange={(e) =>
                      setCreativeForm({ ...creativeForm, uploaded_by: e.target.value })
                    }
                    placeholder="Design team"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreativeForm(null);
                    setEditingCreative(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitCreative}
                  disabled={createCreative.isPending || updateCreative.isPending}
                >
                  {editingCreative ? "Save creative" : "Add creative"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
