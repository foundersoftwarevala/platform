import { useMemo, useState } from "react";
import { Bot, Pencil, Plus } from "lucide-react";

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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

import { useInsertRecord, useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, StatusBadge } from "@/components/manager/primitives";

interface AgentForm {
  id?: string;
  name: string;
  purpose: string;
  model_id: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  status: string;
}

const EMPTY_FORM: AgentForm = {
  name: "",
  purpose: "",
  model_id: "none",
  system_prompt: "",
  temperature: 0.7,
  max_tokens: 2048,
  status: "active",
};

export function AgentsPanel({ agents, models }: { agents: Row[]; models: Row[] }) {
  const update = useUpdateRecord("Agent updated");
  const insert = useInsertRecord("Agent created");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);

  const modelById = useMemo(() => new Map(models.map((m) => [m["id"], m])), [models]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setForm({
      id: row["id"] as string,
      name: String(row["name"]),
      purpose: String(row["purpose"]),
      model_id: (row["model_id"] as string) ?? "none",
      system_prompt: String(row["system_prompt"] ?? ""),
      temperature: Number(row["temperature"] ?? 0.7),
      max_tokens: Number(row["max_tokens"] ?? 2048),
      status: String(row["status"] ?? "active"),
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.purpose.trim()) return;
    const values = {
      name: form.name,
      purpose: form.purpose,
      model_id: form.model_id === "none" ? null : form.model_id,
      system_prompt: form.system_prompt,
      temperature: form.temperature,
      max_tokens: form.max_tokens,
      status: form.status,
    };
    if (form.id) {
      update.mutate({ table: "ai_agents", id: form.id, values });
    } else {
      insert.mutate({ table: "ai_agents", values });
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Agents" value={agents.length} icon={<Bot className="h-4 w-4" />} tone="violet" />
        <StatCard label="Active" value={agents.filter((a) => a["status"] === "active").length} icon={<Bot className="h-4 w-4" />} tone="green" />
        <StatCard
          label="Avg Success Rate"
          value={`${agents.length ? (agents.reduce((s, a) => s + Number(a["success_rate"] ?? 0), 0) / agents.length).toFixed(1) : "0"}%`}
          icon={<Bot className="h-4 w-4" />}
          tone="cyan"
        />
        <StatCard
          label="Runs (30d)"
          value={agents.reduce((s, a) => s + Number(a["runs_30d"] ?? 0), 0).toLocaleString("en-US")}
          icon={<Bot className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <GlassCard
        title="AI Models & Agents"
        icon={<Bot className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{form.id ? "Edit Agent" : "Create Agent"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Purpose</Label>
                  <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                </div>
                <div>
                  <Label>Model</Label>
                  <Select value={form.model_id} onValueChange={(v) => setForm({ ...form, model_id: v })}>
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
                  <Label>System Prompt</Label>
                  <Textarea
                    rows={4}
                    value={form.system_prompt}
                    onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Temperature: {form.temperature.toFixed(2)}</Label>
                  <Slider
                    value={[form.temperature]}
                    min={0}
                    max={2}
                    step={0.05}
                    onValueChange={(v) => setForm({ ...form, temperature: v[0] ?? 0.7 })}
                  />
                </div>
                <div>
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={form.max_tokens}
                    onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={save} disabled={insert.isPending || update.isPending}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {agents.length === 0 ? (
          <EmptyState message="No agents configured yet" />
        ) : (
          <div className="space-y-2">
            {agents.map((a) => {
              const model = modelById.get(a["model_id"]) as Row | undefined;
              return (
                <div key={a["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{String(a["name"])}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(a["purpose"])} · {model ? String(model["name"]) : "no model"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{Number(a["success_rate"] ?? 0)}% success</Badge>
                      <StatusBadge value={String(a["status"])} />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
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
