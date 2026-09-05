import { useState } from "react";
import { FileText, Globe, Plus, Shield } from "lucide-react";

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

export function DataGovernancePanel({ rules }: { rules: Row[] }) {
  const insert = useInsertRecord("Governance rule created");
  const update = useUpdateRecord("Rule updated");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dataClass, setDataClass] = useState("pii");
  const [region, setRegion] = useState("global");
  const [retentionDays, setRetentionDays] = useState(90);
  const [masking, setMasking] = useState("full");

  const enabledCount = rules.filter((r) => r["enabled"]).length;
  const regions = new Set(rules.map((r) => String(r["region"]))).size;

  const createRule = () => {
    if (!name.trim()) return;
    insert.mutate({
      table: "data_governance_rules",
      values: {
        name,
        data_class: dataClass,
        region,
        retention_days: retentionDays,
        masking,
        encryption: "aes-256",
        enabled: true,
        compliance_tags: [],
      },
    });
    setOpen(false);
    setName("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Governance Rules" value={rules.length} icon={<Shield className="h-4 w-4" />} tone="violet" />
        <StatCard label="Enabled" value={enabledCount} icon={<Shield className="h-4 w-4" />} tone="green" />
        <StatCard label="Regions Covered" value={regions} icon={<Globe className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Disabled" value={rules.length - enabledCount} icon={<FileText className="h-4 w-4" />} tone="amber" />
      </div>

      <GlassCard
        title="Data Governance Rules"
        icon={<FileText className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Data Governance Rule</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Data Class</Label>
                  <Input value={dataClass} onChange={(e) => setDataClass(e.target.value)} placeholder="pii" />
                </div>
                <div>
                  <Label>Region</Label>
                  <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="EU" />
                </div>
                <div>
                  <Label>Retention Days</Label>
                  <Input type="number" value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Masking</Label>
                  <Select value={masking} onValueChange={setMasking}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createRule}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {rules.length === 0 ? (
          <EmptyState message="No data governance rules yet" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rules.map((r) => (
              <div key={r["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{String(r["name"])}</p>
                  <Switch
                    checked={Boolean(r["enabled"])}
                    onCheckedChange={(v) =>
                      update.mutate({ table: "data_governance_rules", id: r["id"] as string, values: { enabled: v } })
                    }
                  />
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px] capitalize">{String(r["data_class"])}</Badge>
                  <Badge variant="outline" className="text-[10px]">{String(r["region"])}</Badge>
                  <Badge variant="outline" className="text-[10px]">{String(r["encryption"])}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    Retention (days)
                    <Input
                      type="number"
                      className="h-7 w-20"
                      value={Number(r["retention_days"] ?? 0)}
                      onChange={(e) =>
                        update.mutate({
                          table: "data_governance_rules",
                          id: r["id"] as string,
                          values: { retention_days: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    Masking
                    <Select
                      value={String(r["masking"])}
                      onValueChange={(v) =>
                        update.mutate({ table: "data_governance_rules", id: r["id"] as string, values: { masking: v } })
                      }
                    >
                      <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
