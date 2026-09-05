import { createFileRoute } from "@tanstack/react-router";
import { Network, TrendingUp } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell } from "@/components/affiliate/EntityWall";

type Affiliate = { id: string; display_name: string; code: string | null; country: string | null; status: string; health_score: number | null };

export const Route = createFileRoute("/affiliate-manager/referral-network")({
  head: () => ({ meta: [{ title: "Referral Network — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Affiliate>
      title="Referral Network"
      description="Multi-level referral tree with parent/child structure, growth and network analytics."
      crumbLabel="Referral Network"
      table="affiliates"
      searchColumns={["display_name", "code", "country"]}
      searchPlaceholder="Search network…"
      filters={["Level", "Country", "Status"]}
      tabs={["All Levels", "Level 1", "Level 2", "Top Recruiters"]}
      kpis={[
        { label: "Network Size", icon: <Network className="size-4" />, tone: "primary" },
        { label: "Active", icon: <TrendingUp className="size-4" />, tone: "success", filter: [{ column: "status", value: "verified" }] },
      ]}
      columns={[
        { key: "name", label: "Affiliate" },
        { key: "code", label: "Code" },
        { key: "country", label: "Country" },
        { key: "health", label: "Health", align: "right" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(a) => (
        <Row id={a.id}>
          <Cell className="font-medium">{a.display_name}</Cell>
          <Cell className="font-mono text-[12px]">{a.code ?? "—"}</Cell>
          <Cell>{a.country ?? "—"}</Cell>
          <Cell align="right" className="tabular-nums">{a.health_score ?? "—"}</Cell>
          <Cell><StatusCell value={a.status} /></Cell>
        </Row>
      )}
      emptyIcon={Network}
      emptyTitle="No network yet"
      emptyDescription="Multi-level referral tree with parent/child structure appears here as the network grows."
    />
  ),
});
