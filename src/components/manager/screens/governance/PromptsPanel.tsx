import { useMemo, useState } from "react";
import { FileText, GitBranch, Plus, RotateCcw } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";

import { useInsertRecord, useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, when } from "@/components/manager/primitives";

export function PromptsPanel({ prompts, versions }: { prompts: Row[]; versions: Row[] }) {
  const insertPrompt = useInsertRecord("Prompt created");
  const insertVersion = useInsertRecord("Version created");
  const updateVersion = useUpdateRecord("Version activated");
  const updatePrompt = useUpdateRecord("Prompt updated");

  const [selected, setSelected] = useState<string | null>(prompts[0]?.["id"] as string | undefined ?? null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("general");

  const [versionOpen, setVersionOpen] = useState(false);
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");

  const versionsByPrompt = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const v of versions) {
      const key = String(v["prompt_id"] ?? "");
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => Number(b["version"]) - Number(a["version"]));
    return map;
  }, [versions]);

  const selectedVersions = selected ? versionsByPrompt.get(selected) ?? [] : [];

  const createPrompt = () => {
    if (!name.trim() || !slug.trim()) return;
    insertPrompt.mutate({
      table: "prompts",
      values: { name, slug, category, status: "draft", current_version: 0, owner: "Admin" },
    });
    setNewOpen(false);
    setName("");
    setSlug("");
  };

  const createVersion = () => {
    if (!selected || !content.trim()) return;
    const prompt = prompts.find((p) => p["id"] === selected);
    const nextVersion = (selectedVersions[0] ? Number(selectedVersions[0]["version"]) : 0) + 1;
    insertVersion.mutate({
      table: "prompt_versions",
      values: { prompt_id: selected, version: nextVersion, content, notes, is_active: false, created_by: "Admin" },
    });
    if (prompt) {
      updatePrompt.mutate({ table: "prompts", id: selected, values: { updated_at: new Date().toISOString() } });
    }
    setVersionOpen(false);
    setContent("");
    setNotes("");
  };

  const activateVersion = (version: Row) => {
    if (!selected) return;
    for (const v of selectedVersions) {
      if (v["id"] !== version["id"] && v["is_active"]) {
        updateVersion.mutate({ table: "prompt_versions", id: v["id"] as string, values: { is_active: false } });
      }
    }
    updateVersion.mutate({ table: "prompt_versions", id: version["id"] as string, values: { is_active: true } });
    updatePrompt.mutate({
      table: "prompts",
      id: selected,
      values: { current_version: Number(version["version"]), status: "active" },
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Prompts" value={prompts.length} icon={<FileText className="h-4 w-4" />} tone="violet" />
        <StatCard label="Total Versions" value={versions.length} icon={<GitBranch className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Active Prompts" value={prompts.filter((p) => p["status"] === "active").length} icon={<FileText className="h-4 w-4" />} tone="green" />
        <StatCard label="Active Versions" value={versions.filter((v) => v["is_active"]).length} icon={<RotateCcw className="h-4 w-4" />} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard
          title="System Prompts"
          icon={<FileText className="h-4 w-4 text-primary" />}
          actions={
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  New Prompt
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Prompt</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createPrompt}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        >
          {prompts.length === 0 ? (
            <EmptyState message="No prompts yet" />
          ) : (
            <div className="space-y-2">
              {prompts.map((p) => (
                <div
                  key={p["id"] as string}
                  onClick={() => setSelected(p["id"] as string)}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    selected === p["id"] ? "border-primary/50 bg-primary/10" : "border-border/50 bg-secondary/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{String(p["name"])}</p>
                    <Badge variant="outline">v{Number(p["current_version"] ?? 0)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {String(p["category"])} · {String(p["status"])} · updated {when(p["updated_at"] as string)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard
          title="Version History"
          icon={<GitBranch className="h-4 w-4 text-primary" />}
          actions={
            <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={!selected}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Version
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Version</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Content</Label>
                    <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createVersion}>Create Version</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        >
          {!selected ? (
            <EmptyState message="Select a prompt to view versions" />
          ) : selectedVersions.length === 0 ? (
            <EmptyState message="No versions yet" />
          ) : (
            <div className="space-y-2">
              {selectedVersions.map((v) => (
                <div key={v["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">v{Number(v["version"])}</p>
                      {v["is_active"] ? <Badge>Active</Badge> : null}
                    </div>
                    {!v["is_active"] ? (
                      <Button size="sm" variant="ghost" onClick={() => activateVersion(v)}>
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Activate
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{String(v["content"])}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {String(v["notes"] ?? "")} · {when(v["created_at"] as string)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
