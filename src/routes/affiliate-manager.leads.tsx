import { createFileRoute } from "@tanstack/react-router";
import { UserSearch, TrendingUp } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Lead = { id: string; email: string; status: string; affiliate_id: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/leads")({
  head: () => ({ meta: [{ title: "Leads — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Lead>
      title="Lead Management"
      description="Every lead sourced by every affiliate with pipeline, follow-up and conversion."
      crumbLabel="Leads"
      table="leads"
      searchColumns={["email"]}
      searchPlaceholder="Search leads by email…"
      filters={["Status", "Source", "Affiliate", "Date"]}
      tabs={["All", "New", "Contacted", "Qualified", "Converted", "Lost"]}
      kpis={[
        { label: "Total Leads", icon: <UserSearch className="size-4" />, tone: "primary" },
        { label: "New", tone: "warning", filter: [{ column: "status", value: "new" }] },
        { label: "Converted", icon: <TrendingUp className="size-4" />, tone: "success", filter: [{ column: "status", value: "converted" }] },
      ]}
      columns={[
        { key: "email", label: "Lead" },
        { key: "aff", label: "Affiliate" },
        { key: "created", label: "Created" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(l) => (
        <Row id={l.id}>
          <Cell>{l.email}</Cell>
          <Cell className="font-mono text-[11px] text-muted-foreground">{l.affiliate_id?.slice(0, 8) ?? "—"}</Cell>
          <Cell>{fmtDate(l.created_at)}</Cell>
          <Cell><StatusCell value={l.status} /></Cell>
        </Row>
      )}
      emptyIcon={UserSearch}
      emptyTitle="No leads yet"
      emptyDescription="Leads captured by affiliates appear here with pipeline, follow-up and conversion."
      primaryActionLabel="Add Lead"
    />
  ),
});
