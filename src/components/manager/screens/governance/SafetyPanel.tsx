import { useState } from "react";
import { Plus, Shield, ShieldAlert } from "lucide-react";

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

import { useInsertRecord, useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard } from "@/components/manager/primitives";

export function SafetyPanel({ policies }: { policies: Row[] }) {
  const insert = useInsertRecord("Safety policy created");
  const update = useUpdateRecord("Policy updated");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("content");
  const [action, setAction] = useState("block");
  const [severity, setSeverity] = useState("medium");

  const totalViolations = policies.reduce((s, p) => s + Number(p["violations_30d"] ?? 0), 0);
  const enabledCount = policies.filter((p) => p["enabled"]).length;

  const createPolicy = () => {
    if (!name.trim()) return;
    insert.mutate({
      table: "safety_policies",
      values: { name, category, action, severity_threshold: severity, enabled: true },
    });
    setOpen(false);
    setName("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Policies" value={policies.length} icon={<Shield className="h-4 w-4" />} tone="violet" />
        <StatCard label="Enabled" value={enabledCount} icon={<ShieldAlert className="h-4 w-4" />} tone="green" />
        <StatCard label="Violations (30d)" value={totalViolations} icon={<ShieldAlert className="h-4 w-4" />} tone="amber" />
        <StatCard label="Disabled" value={policies.length - enabledCount} icon={<Shield className="h-4 w-4" />} tone="slate" />
      </div>

      <GlassCard
        title="AI Safety Policies"
        icon={<ShieldAlert className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Policy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Safety Policy</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
                <div>
                  <Label>Action</Label>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Block</SelectItem>
                      <SelectItem value="throttle">Throttle</SelectItem>
                      <SelectItem value="warn">Warn</SelectItem>
                      <SelectItem value="log">Log Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity Threshold</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createPolicy}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {policies.length === 0 ? (
          <EmptyState message="No safety policies configured" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {policies.map((p) => (
              <div key={p["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{String(p["name"])}</p>
                  <Switch
                    checked={Boolean(p["enabled"])}
                    onCheckedChange={(v) =>
                      update.mutate({ table: "safety_policies", id: p["id"] as string, values: { enabled: v } })
                    }
                  />
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{p["description"] ? String(p["description"]) : `${p["violations_30d"] ?? 0} violations in 30d`}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">{String(p["category"])}</Badge>
                  <Select
                    value={String(p["action"])}
                    onValueChange={(v) => update.mutate({ table: "safety_policies", id: p["id"] as string, values: { action: v } })}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Block</SelectItem>
                      <SelectItem value="throttle">Throttle</SelectItem>
                      <SelectItem value="warn">Warn</SelectItem>
                      <SelectItem value="log">Log Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(p["severity_threshold"])}
                    onValueChange={(v) =>
                      update.mutate({ table: "safety_policies", id: p["id"] as string, values: { severity_threshold: v } })
                    }
                  >
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
