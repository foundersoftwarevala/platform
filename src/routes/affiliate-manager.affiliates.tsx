import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, BadgeCheck, ShieldAlert, PauseCircle, Globe2 } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell } from "@/components/affiliate/EntityWall";
import { EntityAvatar } from "@/components/affiliate/Money";
import {
  AffiliateProfileDrawer, type AffiliateRecord,
} from "@/components/affiliate/AffiliateProfile";

export const Route = createFileRoute("/affiliate-manager/affiliates")({
  head: () => ({
    meta: [
      { title: "Affiliate Directory — Software Vala Affiliate Manager" },
      { name: "description", content: "Search, review and manage every affiliate partner with health, risk and status insight." },
    ],
  }),
  component: AffiliatesWall,
});

function AffiliatesWall() {
  const [active, setActive] = useState<AffiliateRecord | null>(null);

  return (
    <>
      <EntityWall<AffiliateRecord>
        title="Affiliate Directory"
        description="Every affiliate, referral partner and sales partner across every country and category."
        crumbLabel="Affiliates"
        table="affiliates"
        searchColumns={["display_name", "email", "code", "country"]}
        searchPlaceholder="Search affiliates by name, email, code, country…"
        filters={["Status", "Country", "Category", "Tier"]}
        tabs={["All", "Verified", "Pending", "Suspended"]}
        kpis={[
          { label: "Total", icon: <Users className="size-4" />, tone: "primary" },
          { label: "Verified", icon: <BadgeCheck className="size-4" />, tone: "success", filter: [{ column: "status", value: "verified" }] },
          { label: "Pending", tone: "warning", filter: [{ column: "status", value: "pending" }] },
          { label: "Suspended", icon: <PauseCircle className="size-4" />, tone: "destructive", filter: [{ column: "status", value: "suspended" }] },
          { label: "At Risk", icon: <ShieldAlert className="size-4" />, tone: "warning", filter: [{ column: "risk_score", op: "gte", value: 70 }] },
          { label: "Countries", icon: <Globe2 className="size-4" /> },
        ]}
        columns={[
          { key: "display_name", label: "Affiliate", sortable: true },
          { key: "code", label: "Code", sortable: true },
          { key: "country", label: "Country", sortable: true, hideOnMobile: true },
          { key: "health_score", label: "Health", align: "right", sortable: true, hideOnMobile: true },
          { key: "risk_score", label: "Risk", align: "right", sortable: true, hideOnMobile: true },
          { key: "status", label: "Status", sortable: true },
        ]}
        renderRow={(a) => (
          <Row id={a.id} onOpen={() => setActive(a)}>
            <Cell>
              <div className="flex items-center gap-2.5">
                <EntityAvatar name={a.display_name} size="sm" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.display_name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{a.email ?? "—"}</div>
                </div>
              </div>
            </Cell>
            <Cell className="font-mono text-[12px]">{a.code ?? "—"}</Cell>
            <Cell className="hidden lg:table-cell">{a.country ?? "—"}</Cell>
            <Cell align="right" className="hidden tabular-nums lg:table-cell">{a.health_score ?? "—"}</Cell>
            <Cell align="right" className="hidden tabular-nums lg:table-cell">{a.risk_score ?? "—"}</Cell>
            <Cell><StatusCell value={a.status} /></Cell>
          </Row>
        )}
        emptyIcon={Users}
        emptyTitle="No affiliates yet"
        emptyDescription="Approved affiliates appear here with performance, health, and risk."
        primaryActionLabel="Add Affiliate"
      />
      <AffiliateProfileDrawer affiliate={active} onOpenChange={(o) => !o && setActive(null)} />
    </>
  );
}
