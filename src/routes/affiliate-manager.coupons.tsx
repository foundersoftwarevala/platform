import { createFileRoute } from "@tanstack/react-router";
import { TicketPercent, CheckCircle2 } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate, type EntitySource } from "@/components/affiliate/EntityWall";
import { supabase } from "@/integrations/supabase/client";

type Code = { id: string; code: string; status: string; uses_count: number; expires_at: string | null; created_at: string };

// Coupons are the company's marketplace_coupons (Software Vala alone creates
// and manages them). A coupon is "expired" once its expiry has passed and
// "disabled" when switched off. Uses are its recorded redemptions.
const startOfToday = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const source: EntitySource<Code> = {
  table: "marketplace_coupons",
  select: "id, code, active, expires_at, created_at",
  filter: (f) => {
    if (f.column !== "status") return null;
    if (f.value === "active") return [{ column: "active", value: true }];
    if (f.value === "expired") return [{ column: "expires_at", op: "lt", value: startOfToday() }];
    return null;
  },
  sortColumn: (field) => (["created_at", "code", "expires_at"].includes(field) ? field : null),
  searchColumns: ["code"],
  order: { column: "created_at", ascending: false },
  toRows: async (rows) => {
    const ids = rows.map((r) => String(r.id));
    const uses = new Map<string, number>();
    if (ids.length) {
      const { data, error } = await (supabase as any)
        .from("marketplace_coupon_redemptions").select("coupon_id").in("coupon_id", ids);
      if (error) throw error;
      for (const u of (data ?? []) as { coupon_id: string }[]) {
        uses.set(u.coupon_id, (uses.get(u.coupon_id) ?? 0) + 1);
      }
    }
    const now = Date.now();
    return rows.map((r) => {
      const expires = (r.expires_at as string | null) ?? null;
      return {
        id: String(r.id),
        code: String(r.code ?? ""),
        status: !r.active ? "disabled" : expires && Date.parse(expires) < now ? "expired" : "active",
        uses_count: uses.get(String(r.id)) ?? 0,
        expires_at: expires,
        created_at: String(r.created_at ?? ""),
      };
    });
  },
};

export const Route = createFileRoute("/affiliate-manager/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Code>
      title="Coupons"
      description="Public and private discount coupons with usage limits, stacking rules and expiry."
      crumbLabel="Coupons"
      table="marketplace_coupons"
      source={source}
      searchColumns={["code"]}
      searchPlaceholder="Search coupons…"
      filters={["Status", "Discount", "Product", "Expiry"]}
      tabs={["All", "Active", "Expired"]}
      kpis={[
        { label: "Coupons", icon: <TicketPercent className="size-4" />, tone: "primary" },
        { label: "Active", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "active" }] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "uses", label: "Uses", align: "right" },
        { key: "exp", label: "Expires" },
        { key: "created", label: "Created" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(c) => (
        <Row id={c.id}>
          <Cell className="font-mono">{c.code}</Cell>
          <Cell align="right" className="tabular-nums">{c.uses_count.toLocaleString()}</Cell>
          <Cell>{fmtDate(c.expires_at)}</Cell>
          <Cell>{fmtDate(c.created_at)}</Cell>
          <Cell><StatusCell value={c.status} /></Cell>
        </Row>
      )}
      emptyIcon={TicketPercent}
      emptyTitle="No coupons"
      emptyDescription="Public and private coupons appear here with usage, stacking and expiry rules."
      primaryActionLabel="Create Coupon"
    />
  ),
});
