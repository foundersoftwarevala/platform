import { useMemo, useState } from "react";
import { Boxes, Eye, Globe, Plus, Server } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useInsertRecord, useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, StatusBadge } from "@/components/manager/primitives";

export function RegistryPanel({ models, providers }: { models: Row[]; providers: Row[] }) {
  const update = useUpdateRecord("Model updated");
  const insert = useInsertRecord("Model registered");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [providerId, setProviderId] = useState<string>("none");
  const [modality, setModality] = useState("text");

  const providerById = useMemo(() => new Map(providers.map((p) => [p["id"], p])), [providers]);

  const internalCount = providers.filter((p) => String(p["category"]) === "internal").length;
  const externalCount = providers.length - internalCount;

  const registerModel = () => {
    if (!name.trim() || !modelId.trim()) return;
    insert.mutate({
      table: "ai_models",
      values: {
        name,
        model_id: modelId,
        modality,
        provider_id: providerId === "none" ? null : providerId,
        status: "active",
      },
    });
    setOpen(false);
    setName("");
    setModelId("");
    setProviderId("none");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Registered Models" value={models.length} icon={<Boxes className="h-4 w-4" />} tone="violet" />
        <StatCard label="Providers" value={providers.length} icon={<Server className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Active Models" value={models.filter((m) => m["status"] === "active").length} icon={<Globe className="h-4 w-4" />} tone="green" />
        <StatCard label="Default Models" value={models.filter((m) => m["is_default"]).length} icon={<Eye className="h-4 w-4" />} tone="amber" />
      </div>

      <GlassCard
        title="Model Registry"
        icon={<Boxes className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Register Model
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register Model</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="GPT-4 Turbo" />
                </div>
                <div>
                  <Label>Model ID</Label>
                  <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="gpt-4-turbo" />
                </div>
                <div>
                  <Label>Modality</Label>
                  <Select value={modality} onValueChange={setModality}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="voice">Voice</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="multimodal">Multimodal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Provider</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p["id"] as string} value={p["id"] as string}>
                          {String(p["name"])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={registerModel} disabled={insert.isPending}>Register</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {models.length === 0 ? (
          <EmptyState message="No models registered yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => {
                const provider = providerById.get(m["provider_id"]) as Row | undefined;
                return (
                  <TableRow key={m["id"] as string}>
                    <TableCell>
                      <p className="font-medium text-foreground">{String(m["name"])}</p>
                      <p className="text-xs text-muted-foreground">{String(m["model_id"])}</p>
                    </TableCell>
                    <TableCell>{provider ? String(provider["name"]) : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{String(m["modality"])}</Badge></TableCell>
                    <TableCell>{Number(m["quality_score"] ?? 0)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() =>
                          update.mutate({
                            table: "ai_models",
                            id: m["id"] as string,
                            values: { status: m["status"] === "active" ? "inactive" : "active" },
                          })
                        }
                      >
                        <StatusBadge value={String(m["status"])} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(m["is_default"])}
                        onCheckedChange={(v) =>
                          update.mutate({ table: "ai_models", id: m["id"] as string, values: { is_default: v } })
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </GlassCard>
    </div>
  );
}
