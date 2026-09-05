import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Activity } from "lucide-react";
import { EntityWall, Row, Cell, fmtDate } from "@/components/affiliate/EntityWall";

type Log = { id: string; action: string; entity: string | null; entity_id: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Log>
      title="Analytics"
      description="Revenue, commission, campaign, affiliate, sales, traffic, country and growth analytics with forecast."
      crumbLabel="Analytics"
      table="activity_log"
      searchColumns={["action", "entity"]}
      searchPlaceholder="Search events…"
      filters={["Entity", "Date", "Actor"]}
      tabs={["Overview", "Revenue", "Campaigns", "Country", "Growth"]}
      kpis={[
        { label: "Events (all-time)", icon: <BarChart3 className="size-4" />, tone: "primary" },
        { label: "Live Activity", icon: <Activity className="size-4" />, tone: "success" },
      ]}
      columns={[
        { key: "action", label: "Action" },
        { key: "entity", label: "Entity" },
        { key: "eid", label: "ID" },
        { key: "when", label: "When" },
      ]}
      renderRow={(l) => (
        <Row id={l.id}>
          <Cell className="font-mono text-[12px]">{l.action}</Cell>
          <Cell>{l.entity ?? "—"}</Cell>
          <Cell className="font-mono text-[11px] text-muted-foreground">{l.entity_id?.slice(0, 8) ?? "—"}</Cell>
          <Cell>{fmtDate(l.created_at)}</Cell>
        </Row>
      )}
      emptyIcon={BarChart3}
      emptyTitle="No analytics events"
      emptyDescription="Every operator and system event feeds live analytics, forecasts and AI insights."
    />
  ),
});
