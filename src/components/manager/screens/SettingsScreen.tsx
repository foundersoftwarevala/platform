import { useMemo, useState } from "react";
import { AlertTriangle, Bell, Gauge, Search, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";
import {
  downloadRows,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatCard,
  when,
} from "@/components/manager/primitives";
import { Download } from "lucide-react";

const SUBSECTIONS = ["settings-limits", "settings-thresholds", "settings-notifications", "settings-all"];

function boolFromValue(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export default function SettingsScreen({ view }: { view?: string | undefined }) {
  const tab = view && SUBSECTIONS.includes(view) ? view : "settings-limits";
  const [activeTab, setActiveTab] = useState(tab);
  const [search, setSearch] = useState("");

  const query = useRecords({ table: "system_settings", orderBy: "category", ascending: true, limit: 500 });
  const update = useUpdateRecord("Setting saved");

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Configure limits, thresholds and notification preferences" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Configure limits, thresholds and notification preferences" />
        <ErrorState error={query.error} />
      </div>
    );
  }

  const rows = query.data ?? [];
  const limitsRows = rows.filter((r) => r["category"] === "limits");
  const thresholdRows = rows.filter((r) => r["category"] === "thresholds");
  const notificationRows = rows.filter((r) => r["category"] === "notifications");
  const otherCategories = [...new Set(rows.map((r) => String(r["category"])))];

  const filteredAll = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(r["label"]).toLowerCase().includes(q) ||
      String(r["key"]).toLowerCase().includes(q) ||
      String(r["category"]).toLowerCase().includes(q) ||
      String(r["description"] ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure default limits, alert thresholds, notification preferences and all system settings"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadRows(
                "system-settings.csv",
                rows.map((r) => ({ key: r["key"], label: r["label"], category: r["category"], value: r["value"], value_type: r["value_type"] })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Default Limits" value={limitsRows.length} icon={<Gauge className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Alert Thresholds" value={thresholdRows.length} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
        <StatCard label="Notification Prefs" value={notificationRows.length} icon={<Bell className="h-4 w-4" />} tone="violet" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="settings-limits">Default Limits</TabsTrigger>
          <TabsTrigger value="settings-thresholds">Alert Thresholds</TabsTrigger>
          <TabsTrigger value="settings-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="settings-all">All Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="settings-limits">
          <SettingsGroup
            title="Default Limits"
            icon={<Gauge className="h-4 w-4 text-primary" />}
            rows={limitsRows}
            update={update}
            empty="No default limit settings configured"
          />
        </TabsContent>

        <TabsContent value="settings-thresholds">
          <SettingsGroup
            title="Alert Thresholds"
            icon={<AlertTriangle className="h-4 w-4 text-primary" />}
            rows={thresholdRows}
            update={update}
            empty="No alert threshold settings configured"
          />
        </TabsContent>

        <TabsContent value="settings-notifications">
          <SettingsGroup
            title="Notification Preferences"
            icon={<Bell className="h-4 w-4 text-primary" />}
            rows={notificationRows}
            update={update}
            empty="No notification preferences configured"
          />
        </TabsContent>

        <TabsContent value="settings-all">
          <GlassCard
            title="All Settings"
            icon={<Settings className="h-4 w-4 text-primary" />}
            actions={
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search settings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 pl-8"
                />
              </div>
            }
          >
            {filteredAll.length === 0 ? (
              <EmptyState message="No settings found" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAll.map((r) => (
                    <TableRow key={String(r["id"])}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{String(r["key"])}</TableCell>
                      <TableCell className="text-foreground">{String(r["label"])}</TableCell>
                      <TableCell className="capitalize">
                        <Badge variant="outline">{String(r["category"])}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">{String(r["value_type"])}</TableCell>
                      <TableCell className="font-mono text-xs text-foreground">{String(r["value"])}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{when(r["updated_at"] as string | null)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsGroup({
  title,
  icon,
  rows,
  update,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Row[];
  update: ReturnType<typeof useUpdateRecord>;
  empty: string;
}) {
  const byCategory = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = String(r["category"]);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [rows]);

  if (rows.length === 0) {
    return (
      <GlassCard title={title} icon={icon}>
        <EmptyState message={empty} />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {byCategory.map(([category, catRows]) => (
        <GlassCard key={category} title={title} icon={icon}>
          <div className="space-y-4">
            {catRows.map((row) => (
              <SettingRow key={String(row["id"])} row={row} update={update} />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function SettingRow({ row, update }: { row: Row; update: ReturnType<typeof useUpdateRecord> }) {
  const valueType = String(row["value_type"] ?? "string");
  const originalValue = String(row["value"] ?? "");
  const [value, setValue] = useState(originalValue);
  const dirty = value !== originalValue;

  const save = () => {
    update.mutate({ table: "system_settings", id: String(row["id"]), values: { value } });
  };

  const reset = () => setValue(originalValue);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/30 bg-muted/10 p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{String(row["label"])}</p>
        {row["description"] ? <p className="text-xs text-muted-foreground">{String(row["description"])}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {valueType === "boolean" ? (
          <Switch checked={boolFromValue(value)} onCheckedChange={(checked) => setValue(checked ? "true" : "false")} />
        ) : valueType === "number" ? (
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-32 text-right"
          />
        ) : (
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="w-48" />
        )}
        <Button size="sm" variant="outline" onClick={reset} disabled={!dirty}>
          Reset
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}
