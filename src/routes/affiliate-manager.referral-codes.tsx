import { createFileRoute } from "@tanstack/react-router";
import { Ticket, CheckCircle2, XCircle } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate, type EntitySource } from "@/components/affiliate/EntityWall";
import { supabase } from "@/integrations/supabase/client";

type Code = { id: string; code: string; status: string; uses_count: number; expires_at: string | null; created_at: string };

// Referral codes are marketplace_referral_codes rows that belong to an
// affiliate. A code is active or not; codes carry no expiry, so the expiry
// column stays empty and the "Expired" view has nothing to show. Uses are the
// orders attributed through the code.
const STATUS: Record<string, boolean> = { active: true, disabled: false };
const source: EntitySource<Code> = {
  table: "marketplace_referral_codes",
  select: "id, code, active, created_at",
  fixed: [{ column: "affiliate_partner_id", op: "not_null", value: null }],
  filter: (f) =>
    f.column === "status" && String(f.value) in STATUS ? [{ column: "active", value: STATUS[String(f.value)] }] : null,
  sortColumn: (field) => (field === "created_at" || field === "code" ? field : null),
  searchColumns: ["code"],
  order: { column: "created_at", ascending: false },
  toRows: async (rows) => {
    const ids = rows.map((r) => String(r.id));
    const uses = new Map<string, number>();
    if (ids.length) {
      const { data, error } = await (supabase as any)
        .from("marketplace_order_attributions").select("referral_code_id").in("referral_code_id", ids);
      if (error) throw error;
      for (const a of (data ?? []) as { referral_code_id: string }[]) {
        uses.set(a.referral_code_id, (uses.get(a.referral_code_id) ?? 0) + 1);
      }
    }
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code ?? ""),
      status: r.active ? "active" : "disabled",
      uses_count: uses.get(String(r.id)) ?? 0,
      expires_at: null,
      created_at: String(r.created_at ?? ""),
    }));
  },
};

export const Route = createFileRoute("/affiliate-manager/referral-codes")({
  head: () => ({ meta: [{ title: "Referral Codes — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Code>
      title="Referral Codes"
      description="Coupon, referral and campaign codes with usage and expiry."
      crumbLabel="Referral Codes"
      table="marketplace_referral_codes"
      source={source}
      searchColumns={["code"]}
      searchPlaceholder="Search codes…"
      filters={["Status", "Campaign", "Affiliate", "Expiry"]}
      tabs={["All", "Active", "Expired", "Disabled"]}
      kpis={[
        { label: "Total Codes", icon: <Ticket className="size-4" />, tone: "primary" },
        { label: "Active", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "active" }] },
        { label: "Expired", icon: <XCircle className="size-4" />, tone: "destructive", filter: [{ column: "status", value: "expired" }] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "uses", label: "Uses", align: "right" },
        { key: "expires", label: "Expires" },
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
      emptyIcon={Ticket}
      emptyTitle="No codes generated"
      emptyDescription="Generate codes in bulk from campaigns or issue custom codes per affiliate."
      primaryActionLabel="Generate Codes"
    />
  ),
});
