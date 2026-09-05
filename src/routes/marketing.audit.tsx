import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Bell, Search, Shield, ShieldCheck } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import {
  QueryState,
  ScreenHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/marketing/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { recordAudit, tableQuery, useUpdateRow } from "@/lib/marketing/api";
import { dateTime, num, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/audit")({
  head: () => ({
    meta: [
      { title: "Audit & Compliance — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Immutable audit trail of every marketing action plus compliance status across DPDP, GDPR and TRAI rules.",
      },
      { property: "og:title", content: "Audit & Compliance — Software Vala" },
      {
        property: "og:description",
        content: "Full marketing audit trail, live alerts and compliance tracking.",
      },
    ],
  }),
  component: AuditScreen,
});

const REGULATIONS = ["DPDP Act", "GDPR", "TRAI DLT", "CAN-SPAM", "ASCI", "Meta Policy", "Google Policy"] as const;
const COMPLIANCE_STATUS = ["compliant", "attention", "at_risk", "in_review"] as const;

function AuditTrail() {
  const logs = useQuery(tableQuery("marketing_audit_logs", { column: "created_at" }));
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (logs.data ?? []).filter(
      (l) =>
        !term ||
        [l.actor, l.action, l.entity_type, l.entity_name, l.module, l.details]
          .some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [logs.data, search]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Audit events" value={num((logs.data ?? []).length)} icon={Shield} tone="violet" index={0} />
        <StatCard
          label="Actors"
          value={num(new Set((logs.data ?? []).map((l) => l.actor)).size)}
          icon={ShieldCheck}
          tone="blue"
          index={1}
        />
        <StatCard
          label="Modules touched"
          value={num(new Set((logs.data ?? []).map((l) => l.module)).size)}
          icon={Shield}
          tone="teal"
          index={2}
        />
        <StatCard
          label="Last 24h"
          value={num(
            (logs.data ?? []).filter(
              (l) => Date.now() - new Date(l.created_at).getTime() < 86_400_000,
            ).length,
          )}
          icon={Bell}
          tone="gold"
          index={3}
        />
      </div>

      <SectionCard
        title="Audit trail"
        description="Every create, update and delete recorded by the Marketing Manager"
        actions={
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit…"
              className="w-56 pl-8"
            />
          </div>
        }
      >
        <QueryState
          isLoading={logs.isLoading}
          error={logs.error}
          data={rows}
          emptyMessage="No audit events recorded yet."
        >
          {(list) => (
            <div className="overflow-x-auto">
              <Table style={{ minWidth: 1000 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{dateTime(l.created_at)}</TableCell>
                      <TableCell className="font-medium">{l.actor}</TableCell>
                      <TableCell>
                        <StatusBadge value={l.action} />
                      </TableCell>
                      <TableCell>{titleCase(l.entity_type)}</TableCell>
                      <TableCell>{l.entity_name ?? "—"}</TableCell>
                      <TableCell>{l.module}</TableCell>
                      <TableCell>{l.details ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </SectionCard>
    </div>
  );
}

function Alerts() {
  const alerts = useQuery(tableQuery("marketing_alerts", { column: "created_at" }));
  const update = useUpdateRow("marketing_alerts");

  const resolve = (row: { id: string; title: string }) =>
    update.mutate(
      { id: row.id, values: { status: "resolved", resolved_at: new Date().toISOString() } },
      {
        onSuccess: () => {
          toast.success("Alert resolved.");
          void recordAudit({
            actor: "Marketing Manager",
            action: "resolve",
            entity_type: "Alert",
            entity_id: row.id,
            entity_name: row.title,
            module: "Audit",
          });
        },
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <SectionCard title="Alerts" description="Operational alerts raised across marketing systems">
      <QueryState
        isLoading={alerts.isLoading}
        error={alerts.error}
        data={alerts.data}
        emptyMessage="No alerts raised."
      >
        {(list) => (
          <div className="space-y-2">
            {list.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-status-warning" />
                    {a.title}
                    <StatusBadge value={a.severity} />
                    <StatusBadge value={a.status} />
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {titleCase(a.category)} · raised {dateTime(a.created_at)}
                    {a.resolved_at ? ` · resolved ${dateTime(a.resolved_at)}` : ""}
                  </p>
                </div>
                {a.status !== "resolved" ? (
                  <Button size="sm" variant="outline" onClick={() => resolve(a)} disabled={update.isPending}>
                    Resolve
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </SectionCard>
  );
}

function AuditScreen() {
  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Audit & Compliance"
        description="Who changed what, live alerts, and regulatory compliance status."
      />
      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <AuditTrail />
        </TabsContent>
        <TabsContent value="alerts">
          <Alerts />
        </TabsContent>
        <TabsContent value="compliance">
          <DataScreen
            headless
            table="marketing_compliance_records"
            title="Compliance"
            description="Regulatory checks"
            module="Compliance"
            entityLabel="Compliance record"
            order={{ column: "last_checked" }}
            searchKeys={["item", "regulation", "owner"]}
            filterKey="status"
            filterOptions={COMPLIANCE_STATUS}
            minWidth={900}
            stats={[
              { label: "Checks", icon: Shield, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Compliant",
                icon: ShieldCheck,
                tone: "green",
                value: (r) => num(r.filter((x) => x.status === "compliant").length),
              },
              {
                label: "Needs attention",
                icon: AlertTriangle,
                tone: "gold",
                value: (r) => num(r.filter((x) => x.status !== "compliant").length),
              },
              {
                label: "Regulations",
                icon: Shield,
                tone: "blue",
                value: (r) => num(new Set(r.map((x) => x.regulation)).size),
              },
            ]}
            columns={[
              { key: "item", header: "Item", render: (r) => <span className="font-medium">{r.item}</span> },
              { key: "regulation", header: "Regulation", render: (r) => r.regulation },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "last_checked", header: "Last checked", render: (r) => dateTime(r.last_checked) },
              { key: "owner", header: "Owner", render: (r) => r.owner ?? "—" },
              { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
            ]}
            fields={[
              { key: "item", label: "Item", kind: "text", required: true, full: true },
              { key: "regulation", label: "Regulation", kind: "select", options: REGULATIONS },
              { key: "status", label: "Status", kind: "select", options: COMPLIANCE_STATUS },
              { key: "owner", label: "Owner", kind: "text" },
              { key: "last_checked", label: "Last checked", kind: "datetime" },
              { key: "notes", label: "Notes", kind: "textarea", full: true },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
