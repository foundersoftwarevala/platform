import { useState } from "react";
import { Download, HardDrive, Plus, Smartphone } from "lucide-react";

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

import { useInsertRecord, useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, StatusBadge } from "@/components/manager/primitives";

export function OnDevicePanel({ models }: { models: Row[] }) {
  const insert = useInsertRecord("On-device model added");
  const update = useUpdateRecord("Model updated");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [framework, setFramework] = useState("TFLite");
  const [version, setVersion] = useState("1.0.0");
  const [sizeMb, setSizeMb] = useState(100);
  const [platforms, setPlatforms] = useState("android,ios");

  const totalSize = models.reduce((s, m) => s + Number(m["size_mb"] ?? 0), 0);
  const totalDownloads = models.reduce((s, m) => s + Number(m["downloads"] ?? 0), 0);

  const addModel = () => {
    if (!name.trim()) return;
    insert.mutate({
      table: "on_device_models",
      values: {
        name,
        framework,
        version,
        size_mb: sizeMb,
        status: "pending",
        downloads: 0,
        accuracy: 0,
        platforms: platforms.split(",").map((p) => p.trim()).filter(Boolean),
      },
    });
    setOpen(false);
    setName("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Offline Models" value={models.length} icon={<Smartphone className="h-4 w-4" />} tone="violet" />
        <StatCard label="Total Size" value={`${totalSize.toLocaleString("en-US")} MB`} icon={<HardDrive className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Total Downloads" value={totalDownloads.toLocaleString("en-US")} icon={<Download className="h-4 w-4" />} tone="green" />
        <StatCard
          label="Synced"
          value={models.filter((m) => m["status"] === "synced" || m["status"] === "active").length}
          icon={<Smartphone className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <GlassCard
        title="On-Device Models"
        icon={<Smartphone className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Upload Model
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload On-Device Model</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Framework</Label>
                  <Input value={framework} onChange={(e) => setFramework(e.target.value)} />
                </div>
                <div>
                  <Label>Version</Label>
                  <Input value={version} onChange={(e) => setVersion(e.target.value)} />
                </div>
                <div>
                  <Label>Size (MB)</Label>
                  <Input type="number" value={sizeMb} onChange={(e) => setSizeMb(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Platforms (comma-separated)</Label>
                  <Input value={platforms} onChange={(e) => setPlatforms(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addModel}>Upload</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {models.length === 0 ? (
          <EmptyState message="No on-device models yet" />
        ) : (
          <div className="space-y-3">
            {models.map((m) => (
              <div key={m["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{String(m["name"])}</p>
                    <p className="text-xs text-muted-foreground">
                      v{String(m["version"])} · {Number(m["size_mb"] ?? 0)} MB · {String(m["framework"])}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{Number(m["downloads"] ?? 0).toLocaleString("en-US")} downloads</span>
                    <button
                      onClick={() =>
                        update.mutate({
                          table: "on_device_models",
                          id: m["id"] as string,
                          values: { status: m["status"] === "active" ? "paused" : "active" },
                        })
                      }
                    >
                      <StatusBadge value={String(m["status"])} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(m["platforms"] as string[] | null ?? []).map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px] capitalize">{p}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
