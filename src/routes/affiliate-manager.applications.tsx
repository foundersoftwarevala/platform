import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, Clock, ShieldCheck, ShieldX, ClipboardList } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Application = {
  id: string; applicant_name: string; email: string; country: string | null;
  category: string | null; status: string; risk_score: number; kyc_status: string;
  submitted_at: string;
};

export const Route = createFileRoute("/affiliate-manager/applications")({
  head: () => ({ meta: [{ title: "Applications — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Application>
      title="Applications"
      description="Every affiliate application with KYC status, risk score, and approval workflow."
      crumbLabel="Applications"
      table="affiliate_applications"
      searchColumns={["applicant_name", "email", "country"]}
      searchPlaceholder="Search by name, email, country…"
      filters={["Status", "KYC", "Country", "Risk", "Date"]}
      tabs={["All", "Pending", "Reviewing", "Approved", "Rejected"]}
      order={{ column: "submitted_at", ascending: false }}
      kpis={[
        { label: "Pending", icon: <Clock className="size-4" />, tone: "warning", filter: [{ column: "status", value: "pending" }] },
        { label: "Reviewing", icon: <ClipboardList className="size-4" />, tone: "primary", filter: [{ column: "status", value: "reviewing" }] },
        { label: "Approved", icon: <ShieldCheck className="size-4" />, tone: "success", filter: [{ column: "status", value: "approved" }] },
        { label: "Rejected", icon: <ShieldX className="size-4" />, tone: "destructive", filter: [{ column: "status", value: "rejected" }] },
        { label: "KYC Verified", filter: [{ column: "kyc_status", value: "verified" }] },
        { label: "Total", icon: <UserPlus className="size-4" /> },
      ]}
      columns={[
        { key: "app", label: "Applicant" },
        { key: "country", label: "Country" },
        { key: "category", label: "Category" },
        { key: "kyc", label: "KYC" },
        { key: "risk", label: "Risk", align: "right" },
        { key: "submitted", label: "Submitted" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(a) => (
        <Row id={a.id}>
          <Cell><div className="font-medium">{a.applicant_name}</div><div className="text-[11px] text-muted-foreground">{a.email}</div></Cell>
          <Cell>{a.country ?? "—"}</Cell>
          <Cell>{a.category ?? "—"}</Cell>
          <Cell><StatusCell value={a.kyc_status} /></Cell>
          <Cell align="right" className="tabular-nums">{a.risk_score}</Cell>
          <Cell>{fmtDate(a.submitted_at)}</Cell>
          <Cell><StatusCell value={a.status} /></Cell>
        </Row>
      )}
      emptyIcon={UserPlus}
      emptyTitle="No applications yet"
      emptyDescription="New affiliate applications appear here with KYC, risk score, and approval workflow."
      primaryActionLabel="New Application"
    />
  ),
});
