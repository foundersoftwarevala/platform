import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Download,
  Globe,
  Key,
  Lock,
  Map as MapIcon,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useInsertRecord,
  useManyRecords,
  useUpdateRecord,
  type Row,
} from "@/lib/manager-queries";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  downloadRows,
  num,
  when,
} from "@/components/manager/primitives";

function useScrollIntoFocus(view: string | undefined) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!view) return;
    const el = refs.current[view];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/60");
      const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [view]);
  return refs;
}

const IP_LIST_KEY = "security_ip_restrictions";

interface IpEntry {
  ip: string;
  type: "allow" | "deny";
  reason: string;
  addedAt: string;
}

function parseIpList(raw: string | undefined): IpEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IpEntry[]) : [];
  } catch {
    return [];
  }
}

export default function SecurityScreen({ view }: { view?: string | undefined }) {
  const refs = useScrollIntoFocus(view);

  const many = useManyRecords([
    { table: "api_request_logs", orderBy: "occurred_at", ascending: false, limit: 500 },
    { table: "security_alerts", orderBy: "detected_at", ascending: false, limit: 200 },
    { table: "data_governance_rules", orderBy: "name", ascending: true, limit: 200 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 500 },
    { table: "system_settings", orderBy: "key", ascending: true, limit: 500 },
    { table: "api_keys", orderBy: "label", ascending: true, limit: 500 },
  ]);

  const rowsMany = many.data ?? [[], [], [], [], [], []];
  const logs: Row[] = rowsMany[0] ?? [];
  const alerts: Row[] = rowsMany[1] ?? [];
  const govRules: Row[] = rowsMany[2] ?? [];
  const services: Row[] = rowsMany[3] ?? [];
  const settings: Row[] = rowsMany[4] ?? [];
  const apiKeys: Row[] = rowsMany[5] ?? [];

  const isLoading = many.isLoading;
  const error = many.error;

  const update = useUpdateRecord("Updated");
  const insert = useInsertRecord("Created");

  // ---------- Access logs ----------
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const status = Number(l["status_code"] ?? 0);
      if (logStatusFilter === "success" && !(status >= 200 && status < 400)) return false;
      if (logStatusFilter === "error" && !(status >= 400)) return false;
      if (!logSearch) return true;
      const q = logSearch.toLowerCase();
      return (
        String(l["ip"] ?? "").toLowerCase().includes(q) ||
        String(l["path"] ?? "").toLowerCase().includes(q) ||
        String(l["user_agent"] ?? "").toLowerCase().includes(q) ||
        String(l["method"] ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs, logSearch, logStatusFilter]);

  // ---------- IP restrictions (system_settings) ----------
  const ipSetting = settings.find((s) => s["key"] === IP_LIST_KEY);
  const ipEntries = parseIpList(ipSetting?.["value"] as string | undefined);
  const [newIp, setNewIp] = useState("");
  const [newIpType, setNewIpType] = useState<"allow" | "deny">("deny");
  const [newIpReason, setNewIpReason] = useState("");

  const saveIpList = (entries: IpEntry[]) => {
    if (ipSetting) {
      update.mutate({
        table: "system_settings",
        id: String(ipSetting["id"]),
        values: { value: JSON.stringify(entries) },
      });
    } else {
      insert.mutate({
        table: "system_settings",
        values: {
          key: IP_LIST_KEY,
          label: "IP Access Restrictions",
          category: "security",
          value_type: "json",
          description: "Allow/deny list of IP addresses for API access",
          value: JSON.stringify(entries),
        },
      });
    }
  };

  const addIpEntry = () => {
    if (!newIp.trim()) return;
    const entries = [
      ...ipEntries,
      { ip: newIp.trim(), type: newIpType, reason: newIpReason.trim() || "Manual entry", addedAt: new Date().toISOString() },
    ];
    saveIpList(entries);
    setNewIp("");
    setNewIpReason("");
  };

  const removeIpEntry = (ip: string) => {
    saveIpList(ipEntries.filter((e) => e.ip !== ip));
  };

  // ---------- Region restrictions ----------
  const regionRules = govRules.filter((r) => Boolean(r["region"]));

  const toggleRegionRule = (rule: Row) => {
    update.mutate({
      table: "data_governance_rules",
      id: String(rule["id"]),
      values: { enabled: !rule["enabled"] },
    });
  };

  // ---------- Abuse detection ----------
  const abuseByIp = useMemo((): { ip: string; total: number; errors: number }[] => {
    const map = new Map<string, { ip: string; total: number; errors: number }>();
    for (const l of logs) {
      const ip = String(l["ip"] ?? "unknown");
      const entry = map.get(ip) ?? { ip, total: 0, errors: 0 };
      entry.total += 1;
      if (Number(l["status_code"] ?? 0) >= 400) entry.errors += 1;
      map.set(ip, entry);
    }
    return Array.from(map.values())
      .filter((e) => e.total >= 3)
      .sort((a, b) => b.errors - a.errors || b.total - a.total)
      .slice(0, 15);
  }, [logs]);

  const openAlerts = alerts.filter((a) => String(a["status"] ?? "").toLowerCase() !== "resolved");

  // ---------- Block action ----------
  const [blockIp, setBlockIp] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockKeyId, setBlockKeyId] = useState<string>("");

  const executeBlock = () => {
    if (!blockIp.trim() && !blockKeyId) return;
    insert.mutate({
      table: "security_alerts",
      values: {
        title: blockIp ? `Manual block: ${blockIp}` : "Manual API key revocation",
        description: blockReason || "Manually blocked from Security screen",
        category: "access_control",
        severity: "high",
        source: "manual",
        status: "open",
        detected_at: new Date().toISOString(),
      },
    });
    if (blockIp.trim()) {
      saveIpList([
        ...ipEntries,
        { ip: blockIp.trim(), type: "deny", reason: blockReason || "Manual block", addedAt: new Date().toISOString() },
      ]);
    }
    if (blockKeyId) {
      update.mutate({ table: "api_keys", id: blockKeyId, values: { status: "revoked" } });
    }
    setBlockIp("");
    setBlockReason("");
    setBlockKeyId("");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Security & Access" description="API access control and security monitoring" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Security & Access" description="API access control and security monitoring" />
        <ErrorState error={error} />
      </div>
    );
  }

  const deniedIps = ipEntries.filter((e) => e.type === "deny");
  const blockedRegions = regionRules.filter((r) => r["enabled"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Access"
        description="API access control, IP/region restrictions, and abuse detection"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Denied IPs" value={num(deniedIps.length)} icon={<Ban className="h-5 w-5" />} tone="red" />
        <StatCard label="Restricted Regions" value={num(blockedRegions.length)} icon={<MapIcon className="h-5 w-5" />} tone="amber" />
        <StatCard label="Abuse Signals" value={num(abuseByIp.length)} icon={<AlertTriangle className="h-5 w-5" />} tone="violet" />
        <StatCard label="Open Security Alerts" value={num(openAlerts.length)} icon={<Shield className="h-5 w-5" />} tone="cyan" />
      </div>

      {/* Access Logs */}
      <div
        ref={(el) => {
          refs.current["sec-logs"] = el;
        }}
        className="rounded-xl transition-all"
      >
        <GlassCard
          title="API Access Logs"
          icon={<Search className="h-4 w-4 text-primary" />}
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadRows("access-logs.csv", filteredLogs)}
              disabled={filteredLogs.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          }
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search by IP, path, method, user agent…"
                className="pl-9"
              />
            </div>
            <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success (2xx-3xx)</SelectItem>
                <SelectItem value="error">Errors (4xx-5xx)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredLogs.length === 0 ? (
            <EmptyState message="No access logs match your filters" />
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead>User Agent</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 200).map((l) => (
                    <TableRow key={String(l["id"])}>
                      <TableCell className="font-mono text-xs">{String(l["ip"] ?? "—")}</TableCell>
                      <TableCell className="text-xs">{String(l["method"] ?? "—")}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">{String(l["path"] ?? "—")}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            Number(l["status_code"] ?? 0) >= 400
                              ? "border-status-error/40 text-status-error"
                              : "border-status-success/40 text-status-success"
                          }
                        >
                          {String(l["status_code"] ?? "—")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{num(l["latency_ms"] as number)} ms</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {String(l["user_agent"] ?? "—")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{when(l["occurred_at"] as string)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* IP restrictions */}
        <div
          ref={(el) => {
            refs.current["sec-ip"] = el;
          }}
          className="rounded-xl transition-all"
        >
          <GlassCard title="IP Restrictions" icon={<Ban className="h-4 w-4 text-status-error" />}>
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs">IP / CIDR</Label>
                <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="203.0.113.0/24" />
              </div>
              <div className="w-[110px]">
                <Label className="text-xs">Type</Label>
                <Select value={newIpType} onValueChange={(v) => setNewIpType(v as "allow" | "deny")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deny">Deny</SelectItem>
                    <SelectItem value="allow">Allow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs">Reason</Label>
                <Input value={newIpReason} onChange={(e) => setNewIpReason(e.target.value)} placeholder="Rate limit abuse" />
              </div>
              <Button size="sm" onClick={addIpEntry} disabled={!newIp.trim()}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
            {ipEntries.length === 0 ? (
              <EmptyState message="No IP restrictions configured" />
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-auto">
                {ipEntries.map((entry) => (
                  <div
                    key={entry.ip}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3"
                  >
                    <div>
                      <p className="font-mono text-sm font-medium text-foreground">{entry.ip}</p>
                      <p className="text-xs text-muted-foreground">{entry.reason}</p>
                      <p className="text-xs text-muted-foreground">Added {when(entry.addedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          entry.type === "deny"
                            ? "border-status-error/40 text-status-error"
                            : "border-status-success/40 text-status-success"
                        }
                      >
                        {entry.type}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => removeIpEntry(entry.ip)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Region restrictions */}
        <div
          ref={(el) => {
            refs.current["sec-region"] = el;
          }}
          className="rounded-xl transition-all"
        >
          <GlassCard title="Region Restrictions" icon={<Globe className="h-4 w-4 text-status-warning" />}>
            {regionRules.length === 0 ? (
              <EmptyState message="No data governance region rules configured" />
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto">
                {regionRules.map((r) => (
                  <div
                    key={String(r["id"])}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <MapIcon className="h-4 w-4 text-status-warning" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{String(r["region"])}</p>
                        <p className="text-xs text-muted-foreground">
                          {String(r["name"] ?? "")} · {String(r["data_class"] ?? "")}
                        </p>
                      </div>
                    </div>
                    <Switch checked={Boolean(r["enabled"])} onCheckedChange={() => toggleRegionRule(r)} />
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Abuse detection */}
      <div
        ref={(el) => {
          refs.current["sec-abuse"] = el;
        }}
        className="rounded-xl transition-all"
      >
        <GlassCard title="Abuse Detection" icon={<AlertTriangle className="h-4 w-4 text-status-error" />}>
          {abuseByIp.length === 0 ? (
            <EmptyState message="No abuse patterns detected in recent request logs" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Error Rate</TableHead>
                    <TableHead>Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abuseByIp.map((e) => {
                    const rate = e.total ? e.errors / e.total : 0;
                    const severity = rate > 0.5 ? "critical" : rate > 0.2 ? "high" : "warning";
                    return (
                      <TableRow key={e.ip}>
                        <TableCell className="font-mono text-xs">{e.ip}</TableCell>
                        <TableCell className="text-right">{num(e.total)}</TableCell>
                        <TableCell className="text-right text-status-error">{num(e.errors)}</TableCell>
                        <TableCell className="text-right">{Math.round(rate * 100)}%</TableCell>
                        <TableCell>
                          <StatusBadge value={severity} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {openAlerts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Open security alerts</p>
              {openAlerts.slice(0, 6).map((a) => (
                <div key={String(a["id"])} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{String(a["title"] ?? "")}</p>
                    <StatusBadge value={String(a["severity"] ?? "")} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{String(a["description"] ?? "")}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Manual block */}
      <div
        ref={(el) => {
          refs.current["sec-block"] = el;
        }}
        className="rounded-xl transition-all"
      >
        <GlassCard title="Manual Block Action" icon={<Lock className="h-4 w-4 text-status-error" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Block IP (optional)</Label>
                <Input value={blockIp} onChange={(e) => setBlockIp(e.target.value)} placeholder="203.0.113.99" />
              </div>
              <div>
                <Label className="text-xs">Reason</Label>
                <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Brute force attempt" />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Revoke API key (optional)</Label>
                <Select value={blockKeyId} onValueChange={setBlockKeyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select key to revoke" />
                  </SelectTrigger>
                  <SelectContent>
                    {apiKeys
                      .filter((k) => String(k["status"]).toLowerCase() !== "revoked")
                      .map((k) => (
                        <SelectItem key={String(k["id"])} value={String(k["id"])}>
                          {String(k["label"])} ({String(k["key_prefix"])}…{String(k["last_four"])})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={!blockIp.trim() && !blockKeyId}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Execute Block
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm block action</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    This will create a security alert{blockIp ? `, deny IP ${blockIp}` : ""}
                    {blockKeyId ? ", and revoke the selected API key" : ""}. This action is immediate.
                  </p>
                  <DialogFooter>
                    <Button variant="destructive" onClick={executeBlock}>
                      Confirm
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
