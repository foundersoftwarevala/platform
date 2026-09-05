import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Pencil, Copy, Archive, Trash2, Send, Ban,
  Check, X, RotateCcw, Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { RarityBadge } from "@/components/ams/shared/RarityBadge";
import { StatusPill } from "@/components/ams/shared/StatusPill";
import { PreviewStage } from "@/components/ams/shared/PreviewStage";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import {
  getAward, cloneAward, archiveAward, deleteAward,
  publishAward, unpublishAward, approveAward, rejectAward,
  enableAward, disableAward, restoreAward,
} from "@/lib/ams/awards.api";
import { toast } from "sonner";

export const Route = createFileRoute("/ams/awards/$id")({
  head: () => ({
    meta: [
      { title: "Award Detail — AMS" },
      { name: "description", content: "It may have been deleted or you don't have permission to view it." },
      { property: "og:title", content: "Award Detail — AMS" },
      { property: "og:description", content: "It may have been deleted or you don't have permission to view it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AwardDetailPage,
});

function AwardDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: award, isLoading } = useQuery({
    queryKey: ["award", id],
    queryFn: () => getAward(id),
  });

  const action = useMutation({
    mutationFn: async (op: "publish" | "unpublish" | "approve" | "reject" | "enable" | "disable" | "archive" | "restore" | "clone" | "delete") => {
      switch (op) {
        case "publish":   return publishAward(id);
        case "unpublish": return unpublishAward(id);
        case "approve":   return approveAward(id);
        case "reject":    return rejectAward(id);
        case "enable":    return enableAward(id);
        case "disable":   return disableAward(id);
        case "archive":   return archiveAward(id);
        case "restore":   return restoreAward(id);
        case "clone":     return cloneAward(id);
        case "delete":    return deleteAward(id);
      }
    },
    onSuccess: async (res, op) => {
      await qc.invalidateQueries({ queryKey: ["award", id] });
      await qc.invalidateQueries({ queryKey: ["awards"] });
      toast.success(`Award ${op}d`);
      if (op === "delete") navigate({ to: "/awards" });
      if (op === "clone" && res && typeof res === "object" && "id" in res) {
        navigate({ to: "/awards/$id", params: { id: (res as { id: string }).id } });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!award) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2"><Link to="/ams/awards"><ChevronLeft className="h-4 w-4" /> Back</Link></Button>
        <EmptyState title="Award not found" description="It may have been deleted or you don't have permission to view it." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2"><Link to="/ams/awards"><ChevronLeft className="h-4 w-4" /> Back to awards</Link></Button>

      <PageHeader
        kicker={`${award.type} · ${award.category}`}
        title={award.name}
        description={award.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RarityBadge rarity={award.rarity} />
            <StatusPill status={award.status} />
            <Button asChild variant="outline" className="gap-1.5"><Link to="/awards/$id/edit" params={{ id: award.id }}><Pencil className="h-4 w-4" /> Edit</Link></Button>
            <Button variant="outline" className="gap-1.5" onClick={() => action.mutate("clone")}><Copy className="h-4 w-4" /> Clone</Button>
            {award.status === "published"
              ? <Button variant="outline" className="gap-1.5" onClick={() => action.mutate("unpublish")}><Ban className="h-4 w-4" /> Unpublish</Button>
              : <Button className="gap-1.5 bg-gradient-to-r from-trophy to-legendary text-background hover:opacity-90" onClick={() => action.mutate("publish")}><Send className="h-4 w-4" /> Publish</Button>
            }
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/30 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="surface-card p-6 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Slug</div>
              <div className="font-mono text-sm">{award.slug}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
              <Stat label="XP" value={`+${award.rewards.xp.toLocaleString()}`} />
              <Stat label="Coins" value={award.rewards.coins.toLocaleString()} />
              <Stat label="Rank impact" value={`${award.rewards.rankImpact}`} />
              <Stat label="Level impact" value={`${award.rewards.levelImpact}`} />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
              <Stat label="Visibility" value={award.visibility} cap />
              <Stat label="Priority" value={String(award.priority)} />
              <Stat label="Modules" value={award.supportedModules.join(", ") || "—"} />
              <Stat label="Roles" value={award.supportedRoles.join(", ") || "—"} />
            </div>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => action.mutate("approve")}><Check className="h-3.5 w-3.5" /> Approve</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => action.mutate("reject")}><X className="h-3.5 w-3.5" /> Reject</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => action.mutate("enable")}><Power className="h-3.5 w-3.5" /> Enable</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => action.mutate("disable")}><Power className="h-3.5 w-3.5" /> Disable</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => action.mutate("archive")}><Archive className="h-3.5 w-3.5" /> Archive</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => action.mutate("restore")}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => action.mutate("delete")}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </div>
          <PreviewStage award={award} />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <PreviewStage award={award} />
        </TabsContent>

        <TabsContent value="rules" className="mt-4 surface-card p-6 space-y-3">
          <div className="text-sm font-semibold">Unlock conditions</div>
          {award.unlockConditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Manual grant only — no automatic unlock conditions are defined.</p>
          ) : (
            <ul className="space-y-1.5">
              {award.unlockConditions.map((c, i) => (
                <li key={c.id} className="font-mono text-sm">
                  {i > 0 && <span className="text-[10px] mr-2 text-muted-foreground">AND</span>}
                  {c.metric} <span className="text-trophy">{c.operator}</span> {String(c.value)}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="rewards" className="mt-4 surface-card p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="XP" value={`+${award.rewards.xp.toLocaleString()}`} />
          <Stat label="Coins" value={award.rewards.coins.toLocaleString()} />
          <Stat label="Rank impact" value={String(award.rewards.rankImpact)} />
          <Stat label="Level impact" value={String(award.rewards.levelImpact)} />
          <Stat label="Monetary" value={`${award.rewards.monetaryValue.toLocaleString()} ${award.rewards.currency ?? ""}`} />
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          {award.usage.earnedCount === 0
            ? <EmptyState title="Not earned yet" description="Once users start unlocking this award, usage stats appear here." />
            : (
              <div className="surface-card p-6">
                <Stat label="Total earned" value={award.usage.earnedCount.toLocaleString()} />
              </div>
            )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4 surface-card p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {award.audit.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{e.action}</div>
                  <div className="text-xs text-muted-foreground">by {e.actor}</div>
                </div>
                <time className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 surface-card p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {award.versions.map((v) => (
              <li key={v.version} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">v{v.version}</div>
                  <div className="text-xs text-muted-foreground">{v.notes ?? "—"}</div>
                </div>
                <time className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-semibold ${cap ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}
