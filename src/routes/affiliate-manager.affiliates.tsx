import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, BadgeCheck, ShieldAlert, PauseCircle, Globe2 } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, type EntitySource } from "@/components/affiliate/EntityWall";
import { EntityAvatar } from "@/components/affiliate/Money";
import {
  AffiliateProfileDrawer, type AffiliateRecord,
} from "@/components/affiliate/AffiliateProfile";
import { supabase } from "@/integrations/supabase/client";

// Affiliates are marketplace_affiliate_partners rows. The stored status for a
// verified affiliate is "approved". Email comes from the partner's profile and
// the code from their first active referral code; country, health and risk
// scores are not recorded, so they stay empty.
const STATUS: Record<string, string> = { verified: "approved", pending: "pending", suspended: "suspended" };
const source: EntitySource<AffiliateRecord> = {
  table: "marketplace_affiliate_partners",
  select: "id, user_id, display_name, status, created_at",
  filter: (f) =>
    f.column === "status" && STATUS[String(f.value)] ? [{ ...f, value: STATUS[String(f.value)] }] : null,
  sortColumn: (field) => (["display_name", "status", "created_at"].includes(field) ? field : null),
  searchColumns: ["display_name"],
  order: { column: "created_at", ascending: false },
  toRows: async (rows) => {
    const ids = rows.map((r) => String(r.id));
    const userIds = rows.map((r) => r.user_id).filter(Boolean) as string[];
    const db = supabase as any;
    const [profiles, codes] = await Promise.all([
      userIds.length
        ? db.from("profiles").select("id, email").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? db.from("marketplace_referral_codes").select("affiliate_partner_id, code")
            .in("affiliate_partner_id", ids).eq("active", true).order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (codes.error) throw codes.error;
    const emailOf = new Map<string, string | null>(
      ((profiles.data ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]),
    );
    const codeOf = new Map<string, string>();
    for (const c of (codes.data ?? []) as { affiliate_partner_id: string; code: string }[]) {
      if (!codeOf.has(c.affiliate_partner_id)) codeOf.set(c.affiliate_partner_id, c.code);
    }
    return rows.map((r) => ({
      id: String(r.id),
      display_name: String(r.display_name ?? ""),
      email: r.user_id ? emailOf.get(String(r.user_id)) ?? null : null,
      code: codeOf.get(String(r.id)) ?? null,
      country: null,
      status: String(r.status ?? ""),
      health_score: null,
      risk_score: null,
      created_at: (r.created_at as string | null) ?? null,
    }));
  },
};

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
        table="marketplace_affiliate_partners"
        source={source}
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
          { label: "Countries", icon: <Globe2 className="size-4" />, unavailable: true },
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
