import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Alert = { id: string; severity: string; category: string; message: string; status: string; created_at: string };

export const Route = createFileRoute("/affiliate-manager/compliance")({
  head: () => ({ meta: [{ title: "Compliance — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Alert>
      title="Compliance"
      description="Identity, tax, KYC, anti-fraud alerts and policy risk across every affiliate."
      crumbLabel="Compliance"
      table="compliance_alerts"
      searchColumns={["message"]}
      searchPlaceholder="Search alerts…"
      filters={["Severity", "Category", "Status", "Date"]}
      tabs={["All", "Open", "Investigating", "Resolved", "Critical"]}
      kpis={[
        { label: "Open", icon: <ShieldAlert className="size-4" />, tone: "warning", filter: [{ column: "status", value: "open" }] },
        { label: "Critical", icon: <ShieldX className="size-4" />, tone: "destructive", filter: [{ column: "severity", value: "critical" }] },
        { label: "Resolved", icon: <ShieldCheck className="size-4" />, tone: "success", filter: [{ column: "status", value: "resolved" }] },
      ]}
      columns={[
        { key: "sev", label: "Severity" },
        { key: "cat", label: "Category" },
        { key: "msg", label: "Message" },
        { key: "date", label: "Raised" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(a) => (
        <Row id={a.id}>
          <Cell><StatusCell value={a.severity} /></Cell>
          <Cell>{a.category}</Cell>
          <Cell className="truncate max-w-md">{a.message}</Cell>
          <Cell>{fmtDate(a.created_at)}</Cell>
          <Cell><StatusCell value={a.status} /></Cell>
        </Row>
      )}
      emptyIcon={ShieldCheck}
      emptyTitle="No compliance alerts"
      emptyDescription="Fraud, KYC, tax and policy alerts appear here with severity and status."
    />
  ),
});
