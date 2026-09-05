import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle, GitBranch, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useInsertRecord, useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, StatusBadge, when } from "@/components/manager/primitives";

const STAGES = ["development", "staging", "production", "deprecated", "retired"];

export function LifecyclePanel({ versions, models }: { versions: Row[]; models: Row[] }) {
  const insert = useInsertRecord("Version registered");
  const update = useUpdateRecord("Stage updated");
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState<string>("none");
  const [version, setVersion] = useState("");
  const [stage, setStage] = useState("development");
  const [notes, setNotes] = useState("");

  const modelById = useMemo(() => new Map(models.map((m) => [m["id"], m])), [models]);

  const production = versions.filter((v) => v["stage"] === "production").length;
  const deprecated = versions.filter((v) => v["stage"] === "deprecated").length;

  const createVersion = () => {
    if (!version.trim()) return;
    insert.mutate({
      table: "model_versions",
      values: {
        model_id: modelId === "none" ? null : modelId,
        version,
        stage,
        notes,
        released_at: new Date().toISOString(),
      },
    });
    setOpen(false);
    setVersion("");
    setNotes("");
  };

  const promote = (row: Row) => {
    const idx = STAGES.indexOf(String(row["stage"]));
    const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
    if (!next) return;
    update.mutate({ table: "model_versions", id: row["id"] as string, values: { stage: next } });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Versions" value={versions.length} icon={<GitBranch className="h-4 w-4" />} tone="violet" />
        <StatCard label="In Production" value={production} icon={<CheckCircle className="h-4 w-4" />} tone="green" />
        <StatCard label="Deprecated" value={deprecated} icon={<GitBranch className="h-4 w-4" />} tone="amber" />
        <StatCard label="Models Tracked" value={new Set(versions.map((v) => v["model_id"])).size} icon={<GitBranch className="h-4 w-4" />} tone="cyan" />
      </div>

      <GlassCard
        title="Model Version Lifecycle"
        icon={<GitBranch className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Version
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register Version</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Model</Label>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {models.map((m) => (
                        <SelectItem key={m["id"] as string} value={m["id"] as string}>
                          {String(m["name"])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Version</Label>
                  <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
                </div>
                <div>
                  <Label>Stage</Label>
                  <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createVersion}>Register</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {versions.length === 0 ? (
          <EmptyState message="No model versions tracked yet" />
        ) : (
          <div className="space-y-3">
            {versions.map((v) => {
              const model = modelById.get(v["model_id"]) as Row | undefined;
              const isFinal = v["stage"] === "retired";
              return (
                <div key={v["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {model ? String(model["name"]) : "Unknown model"} · v{String(v["version"])}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Released {when(v["released_at"] as string | null)} · {String(v["notes"] ?? "")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={String(v["stage"])} />
                      {!isFinal ? (
                        <Button size="sm" variant="ghost" onClick={() => promote(v)}>
                          <ArrowRight className="mr-1 h-3 w-3" />
                          Promote
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
