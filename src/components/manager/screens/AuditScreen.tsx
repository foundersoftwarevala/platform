import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Download,
  FileJson,
  FileText,
  Power,
  Receipt,
  Search,
  Shield,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useManyRecords, type Row } from "@/lib/manager-queries";
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
  usd,
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

const TAB_TO_CHILD: Record<string, string> = {
  api: "audit-api",
  wallet: "audit-wallet",
  billing: "audit-billing",
  usage: "audit-usage",
  admin: "audit-admin",
  export: "audit-export",
};
const CHILD_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_CHILD).map(([k, v]) => [v, k]),
);

function downloadJson(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditScreen({ view }: { view?: string | undefined }) {
  const refs = useScrollIntoFocus(view);
  const [activeTab, setActiveTab] = useState<string>(
    (view && CHILD_TO_TAB[view]) || "api",
  );
  useEffect(() => {
    if (view && CHILD_TO_TAB[view]) setActiveTab(CHILD_TO_TAB[view]);
  }, [view]);

  const many = useManyRecords([
    { table: "audit_logs", orderBy: "occurred_at", ascending: false, limit: 500 },
    { table: "wallet_transactions", orderBy: "created_at", ascending: false, limit: 300 },
    { table: "invoices", orderBy: "issued_at", ascending: false, limit: 300 },
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 300 },
    { table: "api_request_logs", orderBy: "occurred_at", ascending: false, limit: 300 },
  ]);

  const rowsMany = many.data ?? [[], [], [], [], []];
  const auditLogs: Row[] = rowsMany[0] ?? [];
  const walletTx: Row[] = rowsMany[1] ?? [];
  const invoices: Row[] = rowsMany[2] ?? [];
  const usageEvents: Row[] = rowsMany[3] ?? [];
  const requestLogs: Row[] = rowsMany[4] ?? [];

  const isLoading = many.isLoading;
  const error = many.error;

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);

  const apiLogs = useMemo(
    () => auditLogs.filter((l) => String(l["entity_type"] ?? "").toLowerCase().includes("api")),
    [auditLogs],
  );
  const adminLogs = useMemo(
    () =>
      auditLogs.filter((l) =>
        ["admin", "role", "settings", "user"].some((k) =>
          String(l["entity_type"] ?? "").toLowerCase().includes(k),
        ),
      ),
    [auditLogs],
  );

  const filterBySearch = <T extends Row>(rows: T[], fields: string[]) => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => fields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)));
  };

  const filteredApi = filterBySearch(apiLogs, ["actor", "action", "entity_id", "ip"]);
  const filteredWallet = filterBySearch(walletTx, ["type", "status", "wallet_id", "reference"]);
  const filteredBilling = filterBySearch(invoices, ["invoice_number", "status"]);
  const filteredUsage = filterBySearch(usageEvents, ["event_type", "service_id"]);
  const filteredAdmin = filterBySearch(adminLogs, ["actor", "action", "entity_id"]);

  const exportSetForTab: Record<string, Row[]> = {
    api: filteredApi,
    wallet: filteredWallet,
    billing: filteredBilling,
    usage: filteredUsage,
    admin: filteredAdmin,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit & Logs" description="Complete audit trail for all API operations" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit & Logs" description="Complete audit trail for all API operations" />
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit & Logs" description="Complete audit trail across API, wallet, billing, usage and admin activity" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="API Logs" value={num(apiLogs.length)} icon={<Power className="h-5 w-5" />} tone="cyan" />
        <StatCard label="Wallet Tx" value={num(walletTx.length)} icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard label="Billing Logs" value={num(invoices.length)} icon={<Receipt className="h-5 w-5" />} tone="violet" />
        <StatCard label="Usage Events" value={num(usageEvents.length)} icon={<Activity className="h-5 w-5" />} tone="amber" />
        <StatCard label="Admin Actions" value={num(adminLogs.length)} icon={<Shield className="h-5 w-5" />} tone="red" />
      </div>

      <GlassCard title="Search" icon={<Search className="h-4 w-4 text-primary" />}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search across the active tab's logs…"
            className="pl-9"
          />
        </div>
      </GlassCard>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="api">API On/Off</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="admin">Admin Actions</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <div ref={(el) => { refs.current["audit-api"] = el; }} className="rounded-xl transition-all">
            <GlassCard title="API Toggle & Access Logs" icon={<Power className="h-4 w-4 text-primary" />}>
              {filteredApi.length === 0 ? (
                <EmptyState message="No API-related audit logs found" />
              ) : (
                <LogTable rows={filteredApi} onSelect={setSelected} />
              )}
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <div ref={(el) => { refs.current["audit-wallet"] = el; }} className="rounded-xl transition-all">
            <GlassCard title="Wallet Transactions" icon={<Wallet className="h-4 w-4 text-primary" />}>
              {filteredWallet.length === 0 ? (
                <EmptyState message="No wallet transactions found" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWallet.map((t) => (
                        <TableRow key={String(t["id"])}>
                          <TableCell>{String(t["type"] ?? "—")}</TableCell>
                          <TableCell className="text-right">{usd(Number(t["amount_usd"] ?? t["amount"] ?? 0))}</TableCell>
                          <TableCell><StatusBadge value={String(t["status"] ?? "")} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{String(t["reference"] ?? t["wallet_id"] ?? "—")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{when(t["created_at"] as string)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <div ref={(el) => { refs.current["audit-billing"] = el; }} className="rounded-xl transition-all">
            <GlassCard title="Billing / Invoices" icon={<Receipt className="h-4 w-4 text-primary" />}>
              {filteredBilling.length === 0 ? (
                <EmptyState message="No invoices found" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead>Period</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBilling.map((inv) => (
                        <TableRow key={String(inv["id"])}>
                          <TableCell className="font-mono text-xs">{String(inv["invoice_number"])}</TableCell>
                          <TableCell className="text-right">{usd(Number(inv["amount_usd"] ?? 0))}</TableCell>
                          <TableCell><StatusBadge value={String(inv["status"] ?? "")} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{when(inv["issued_at"] as string)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {String(inv["period_start"] ?? "")} – {String(inv["period_end"] ?? "")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <div ref={(el) => { refs.current["audit-usage"] = el; }} className="rounded-xl transition-all">
            <GlassCard title="Usage Events" icon={<Activity className="h-4 w-4 text-primary" />}>
              {filteredUsage.length === 0 ? (
                <EmptyState message="No usage events found" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsage.map((u) => (
                        <TableRow key={String(u["id"])}>
                          <TableCell>{String(u["event_type"] ?? "—")}</TableCell>
                          <TableCell className="font-mono text-xs">{String(u["service_id"] ?? "—")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{when(u["occurred_at"] as string)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {requestLogs.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Recent request log activity</p>
                  <LogTable
                    rows={requestLogs.slice(0, 20).map((r) => ({
                      id: r["id"],
                      actor: r["ip"],
                      action: `${r["method"]} ${r["path"]}`,
                      entity_type: "api_request",
                      severity: Number(r["status_code"]) >= 400 ? "error" : "info",
                      occurred_at: r["occurred_at"],
                      metadata: r,
                    }))}
                    onSelect={setSelected}
                  />
                </div>
              )}
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="admin">
          <div ref={(el) => { refs.current["audit-admin"] = el; }} className="rounded-xl transition-all">
            <GlassCard title="Admin Actions" icon={<Shield className="h-4 w-4 text-primary" />}>
              {filteredAdmin.length === 0 ? (
                <EmptyState message="No admin action logs found" />
              ) : (
                <LogTable rows={filteredAdmin} onSelect={setSelected} />
              )}
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="export">
          <div ref={(el) => { refs.current["audit-export"] = el; }} className="rounded-xl transition-all">
            <GlassCard title="Export Logs" icon={<Download className="h-4 w-4 text-primary" />}>
              <p className="mb-4 text-sm text-muted-foreground">
                Export the currently filtered set from each category as CSV or JSON.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(exportSetForTab).map(([key, rows]) => (
                  <div key={key} className="rounded-lg border border-border/50 bg-muted/20 p-4">
                    <p className="mb-1 text-sm font-medium capitalize text-foreground">{key}</p>
                    <p className="mb-3 text-xs text-muted-foreground">{num(rows.length)} records</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rows.length === 0}
                        onClick={() => downloadRows(`audit-${key}.csv`, rows)}
                      >
                        <FileText className="mr-1 h-4 w-4" />
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rows.length === 0}
                        onClick={() => downloadJson(`audit-${key}.json`, rows)}
                      >
                        <FileJson className="mr-1 h-4 w-4" />
                        JSON
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Detail</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Actor:</span> {String(selected["actor"] ?? "—")}</p>
              <p><span className="text-muted-foreground">Action:</span> {String(selected["action"] ?? "—")}</p>
              <p><span className="text-muted-foreground">Entity:</span> {String(selected["entity_type"] ?? "—")} / {String(selected["entity_id"] ?? "—")}</p>
              <p><span className="text-muted-foreground">Time:</span> {when(selected["occurred_at"] as string)}</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted/30 p-3 text-xs">
                {JSON.stringify(selected["metadata"] ?? selected, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogTable({ rows, onSelect }: { rows: Row[]; onSelect: (r: Row) => void }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Time</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 200).map((r) => (
            <TableRow key={String(r["id"])} className="cursor-pointer" onClick={() => onSelect(r)}>
              <TableCell className="text-xs">{String(r["actor"] ?? "—")}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{String(r["action"] ?? "—")}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {String(r["entity_type"] ?? "—")} {r["entity_id"] ? `#${String(r["entity_id"]).slice(0, 8)}` : ""}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    String(r["severity"] ?? "").toLowerCase() === "error" || String(r["severity"] ?? "").toLowerCase() === "critical"
                      ? "border-status-error/40 text-status-error"
                      : String(r["severity"] ?? "").toLowerCase() === "warning"
                        ? "border-status-warning/40 text-status-warning"
                        : "border-status-info/40 text-status-info"
                  }
                >
                  {String(r["severity"] ?? "info")}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{when(r["occurred_at"] as string)}</TableCell>
              <TableCell className="text-right text-xs text-primary">View</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
