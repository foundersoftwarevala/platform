import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Play, Pause } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtMoney, fmtDate } from "@/components/affiliate/EntityWall";

type Campaign = { id: string; name: string; status: string; budget_cents: number; starts_at: string | null; ends_at: string | null };

export const Route = createFileRoute("/affiliate-manager/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Campaign>
      title="Campaigns"
      description="Product, promo and seasonal campaigns with budget, timeline and approval."
      crumbLabel="Campaigns"
      table="campaigns"
      searchColumns={["name"]}
      searchPlaceholder="Search campaigns…"
      filters={["Status", "Product", "Timeline"]}
      tabs={["All", "Active", "Scheduled", "Ended", "Draft"]}
      kpis={[
        { label: "Total", icon: <Megaphone className="size-4" />, tone: "primary" },
        { label: "Active", icon: <Play className="size-4" />, tone: "success", filter: [{ column: "status", value: "active" }] },
        { label: "Paused", icon: <Pause className="size-4" />, tone: "warning", filter: [{ column: "status", value: "paused" }] },
      ]}
      columns={[
        { key: "name", label: "Campaign" },
        { key: "budget", label: "Budget", align: "right" },
        { key: "starts", label: "Starts" },
        { key: "ends", label: "Ends" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(c) => (
        <Row id={c.id}>
          <Cell className="font-medium">{c.name}</Cell>
          <Cell align="right" className="tabular-nums">{fmtMoney(c.budget_cents)}</Cell>
          <Cell>{fmtDate(c.starts_at)}</Cell>
          <Cell>{fmtDate(c.ends_at)}</Cell>
          <Cell><StatusCell value={c.status} /></Cell>
        </Row>
      )}
      emptyIcon={Megaphone}
      emptyTitle="No campaigns yet"
      emptyDescription="Launch a campaign with products, budget, timeline and commission rules."
      primaryActionLabel="Launch Campaign"
    />
  ),
});
