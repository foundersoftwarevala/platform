import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, ShieldCheck, UserCog } from "lucide-react";
import { EntityWall, Row, Cell } from "@/components/affiliate/EntityWall";
import { TimeAgo } from "@/components/affiliate/Money";

type AuditRow = {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  actor_id: string | null;
  affiliate_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function actorLabel(row: AuditRow): string {
  const meta = row.metadata ?? {};
  const actor = (meta["actor"] as string | undefined) ?? row.actor_id;
  return actor ? actor.slice(0, 8) : "system";
}

export const Route = createFileRoute("/affiliate-manager/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log — Software Vala Affiliate Manager" },
      {
        name: "description",
        content:
          "Immutable operator audit trail of every approval, suspension, payout, commission and bulk action.",
      },
      { property: "og:title", content: "Audit Log — Software Vala Affiliate Manager" },
      {
        property: "og:description",
        content: "Immutable operator audit trail across the affiliate control center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditLogWall,
});

function AuditLogWall() {
  return (
    <EntityWall<AuditRow>
      title="Audit Log"
      description="Immutable, append-only record of every operator action — approvals, suspensions, commission and payout changes, bulk runs and imports."
      crumbLabel="Audit Log"
      table="activity_log"
      searchColumns={["action", "entity"]}
      searchPlaceholder="Search by action or entity…"
      filters={["Entity", "Actor", "Date"]}
      tabs={["All", "Affiliate", "Commission", "Payout", "Wallet", "Bulk"]}
      kpis={[
        { label: "Total Events", icon: <ScrollText className="size-4" />, tone: "primary" },
        {
          label: "Affiliate Actions",
          icon: <UserCog className="size-4" />,
          tone: "default",
          filter: [{ column: "entity", op: "ilike", value: "%affiliate%" }],
        },
        {
          label: "Financial Actions",
          icon: <ShieldCheck className="size-4" />,
          tone: "success",
          filter: [{ column: "action", op: "ilike", value: "%payout%" }],
        },
      ]}
      columns={[
        { key: "action", label: "Action" },
        { key: "entity", label: "Entity" },
        { key: "actor", label: "Actor" },
        { key: "when", label: "When" },
      ]}
      renderRow={(r) => (
        <Row id={r.id}>
          <Cell className="font-medium">{r.action}</Cell>
          <Cell className="font-mono text-[11px] text-muted-foreground">
            {r.entity ?? "—"}
            {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
          </Cell>
          <Cell className="font-mono text-[11px] text-muted-foreground">{actorLabel(r)}</Cell>
          <Cell>
            <TimeAgo value={r.created_at} />
          </Cell>
        </Row>
      )}
      emptyIcon={ScrollText}
      emptyTitle="No audit events yet"
      emptyDescription="Every operator action — approvals, suspensions, payouts and bulk runs — is recorded here automatically."
    />
  );
}
