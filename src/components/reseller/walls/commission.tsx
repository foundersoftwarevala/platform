import { Percent, FileText, Coins, Layers, CheckCircle2, Pause, Play, Trash2 } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const CURRENCIES = ["INR", "USD"] as const;
const STATE = ["true", "false"] as const;

/**
 * Commission rules, read and written on reseller_commission_rules.
 *
 * The wall used to show four invented rules that lived in one operator's
 * browser and were gone on reload, while the real table sat unread. The
 * columns here are the table's own: a plan code, a percentage or a fixed
 * amount, the volume it starts at, and the order rules are applied in.
 */
export const config: WallConfig = {
  resource: "reseller_commission_rules",
  scope: "commission", entity: "rule", route: "/commission",
  eyebrow: "Finance", title: "Commission Wall",
  subtitle: "The rules that decide what a reseller earns — by plan, rate, volume and priority.",
  icon: Percent, primaryLabel: "New Rule",
  seed: [],
  columns: [
    { key: "plan_code", header: "Plan", render: (r) => <div className="font-semibold text-[13px]">{r.plan_code ?? "—"}</div> },
    {
      key: "rate_percent", header: "Rate", align: "right",
      render: (r) => <span className="font-semibold">{r.rate_percent == null ? "—" : `${r.rate_percent}%`}</span>,
    },
    {
      key: "fixed_amount", header: "Fixed", align: "right",
      render: (r) => <span>{r.fixed_amount ? `${r.currency ?? ""} ${Number(r.fixed_amount).toLocaleString()}` : "—"}</span>,
    },
    { key: "min_volume", header: "From volume", align: "right", render: (r) => <span>{r.min_volume ?? "—"}</span> },
    { key: "priority", header: "Priority", align: "right", render: (r) => <span>{r.priority ?? "—"}</span> },
    {
      key: "active", header: "State",
      render: (r) => <StatusPill value={r.active ? "active" : "paused"} />,
    },
  ],
  filters: [
    { key: "active", label: "State", options: STATE },
    { key: "currency", label: "Currency", options: CURRENCIES },
  ],
  kpis: [
    { label: "Active Rules", icon: Play, compute: (r) => r.filter((x) => x.active).length },
    { label: "Total Rules", icon: FileText, compute: (r) => (r.length ? r.length : "—") },
    {
      label: "Average Rate", icon: Coins,
      compute: (r) => {
        const rated = r.filter((x) => x.rate_percent != null);
        if (!rated.length) return "—";
        return `${(rated.reduce((s, x) => s + Number(x.rate_percent), 0) / rated.length).toFixed(1)}%`;
      },
    },
    { label: "Plans Covered", hint: "Distinct plan codes", icon: Layers, compute: (r) => (r.length ? new Set(r.map((x) => x.plan_code)).size : "—") },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { active: true } },
    { key: "pause", label: "Pause", icon: Pause, patch: { active: false } },
    { key: "delete", label: "Retire", icon: Trash2, variant: "destructive", confirmTitle: "Retire these rules?", confirmDescription: "A retired rule stops applying to new orders. Commission already earned is untouched." },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { active: true } },
    { key: "pause", label: "Pause", icon: Pause, patch: { active: false } },
  ],
  formFields: [
    { key: "plan_code", label: "Plan code", type: "text", required: true, placeholder: "e.g. pro" },
    { key: "rate_percent", label: "Rate (%)", type: "number", placeholder: "18" },
    { key: "currency", label: "Currency", type: "select", options: CURRENCIES, defaultValue: "INR" },
    { key: "priority", label: "Priority", type: "number", defaultValue: 100 },
    { key: "active", label: "Active", type: "select", options: STATE, defaultValue: "true" },
  ],
  searchFields: ["plan_code", "currency"],
  primaryField: "plan_code", subField: "currency",
};
