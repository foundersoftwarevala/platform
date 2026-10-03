// The reseller dashboard's leads, kept on the server.
//
// Same arrangement as the clients workspace: the screen was written against
// the browser-side crud store, so this presents the shape it expects while
// the rows live in the leads table - the one the manager's Leads wall reads.
// A lead a reseller enters is therefore a lead the company has, not a note in
// one browser tab.
//
// The screen's six pipeline columns are not the table's statuses, and its
// source list is not the table's source list, so both are translated here in
// one place, both ways. A patch only sends the columns that actually changed:
// re-sending every field used to send next_follow_up as "" (not a timestamp),
// which made every update fail.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import {
  createResellerLead,
  deleteResellerLead,
  listResellerLeads,
  updateResellerLead,
} from "@/lib/reseller-dashboard.functions";
import type { CrudRecord, RecordStatus } from "@/lib/crud-store";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  industry: string | null;
  source: string | null;
  sub_source: string | null;
  campaign: string | null;
  referrer: string | null;
  utm_source: string | null;
  status: string | null;
  priority: string | null;
  country: string | null;
  requirements: string | null;
  deal_value: number | null;
  next_follow_up: string | null;
  created_at: string | null;
};

const KEY = ["reseller", "leads"];

/** The pipeline columns on the screen. */
export type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

// Column -> lead_status_type. "Qualified" is a lead that has shown interest,
// "Proposal" one in negotiation.
const STAGE_TO_STATUS: Record<LeadStage, string> = {
  new: "new",
  contacted: "contacted",
  qualified: "interested",
  proposal: "negotiation",
  won: "won",
  lost: "lost",
};

// lead_status_type -> column. A lead awaiting a follow-up has been contacted;
// a lead marked spam is closed without a sale, so it sits with the lost ones.
const STATUS_TO_STAGE: Record<string, LeadStage> = {
  new: "new",
  contacted: "contacted",
  follow_up: "contacted",
  interested: "qualified",
  negotiation: "proposal",
  won: "won",
  lost: "lost",
  spam: "lost",
};

export function stageOf(status: string | null | undefined): LeadStage {
  return STATUS_TO_STAGE[status ?? "new"] ?? "new";
}

// The screen's source names -> lead_source_type. The name chosen is kept in
// sub_source, so "Event" stays "Event" while the source column reads manual.
const SOURCE_TO_ENUM: Record<string, string> = {
  Website: "website",
  Referral: "referral",
  "Cold Outreach": "manual",
  Event: "manual",
  Partner: "referral",
  Social: "social",
  "Inbound Call": "manual",
  Other: "manual",
};

const ENUM_LABEL: Record<string, string> = {
  website: "Website", seo: "SEO", social: "Social", ads: "Ads", marketplace: "Marketplace",
  referral: "Referral", manual: "Manual", api: "API", whatsapp: "WhatsApp",
};

function sourceLabel(row: Row) {
  if (row.sub_source && row.sub_source in SOURCE_TO_ENUM) return row.sub_source;
  return row.source ? ENUM_LABEL[row.source] ?? row.source : "";
}

function toRecord(row: Row): CrudRecord {
  return {
    id: row.id,
    name: row.name ?? "",
    status: "active" as RecordStatus,
    owner: "you",
    category: sourceLabel(row),
    amount: Number(row.deal_value ?? 0),
    date: row.created_at ?? new Date().toISOString(),
    notes: row.requirements ?? "",
    tags: [],
    comments: [],
    audit: [],
    attachments: [],
    extra: {
      email: row.email ?? "",
      phone: row.phone ?? "",
      company: row.company ?? "",
      industry: row.industry ?? "",
      source: sourceLabel(row),
      campaign: row.campaign ?? "",
      referrer: row.referrer ?? "",
      utm: row.utm_source ?? "",
      country: row.country ?? "",
      value: Number(row.deal_value ?? 0),
      stage: stageOf(row.status),
      status: row.status ?? "new",
      followUp: row.next_follow_up ?? "",
    },
  };
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

/** Turn the workspace's record shape back into the table's columns. */
function toColumns(patch: Partial<CrudRecord>) {
  const extra = patch.extra ?? {};
  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.name = patch.name;
  if (patch.notes !== undefined) columns.requirements = patch.notes;
  if ("email" in extra) columns.email = text(extra.email);
  if ("phone" in extra) columns.phone = text(extra.phone);
  if ("company" in extra) columns.company = text(extra.company);
  if ("country" in extra && text(extra.country)) columns.country = text(extra.country);
  if ("value" in extra) columns.deal_value = Math.max(0, Number(extra.value ?? 0) || 0);
  if ("stage" in extra) columns.status = STAGE_TO_STATUS[extra.stage as LeadStage] ?? "new";
  if ("source" in extra && text(extra.source)) {
    const label = text(extra.source);
    const value = SOURCE_TO_ENUM[label];
    if (value) {
      columns.source = value;
      columns.sub_source = label;
    }
  }
  if ("campaign" in extra) columns.campaign = text(extra.campaign) || null;
  if ("referrer" in extra) columns.referrer = text(extra.referrer) || null;
  if ("utm" in extra) columns.utm_source = text(extra.utm) || null;
  // An empty date is no date: the column is a timestamp and refuses "".
  if ("followUp" in extra) columns.next_follow_up = text(extra.followUp) || null;
  return columns;
}

/** Only the columns whose value differs from what the row already holds. */
function changedColumns(patch: Partial<CrudRecord>, current: CrudRecord | undefined) {
  const next = toColumns(patch);
  if (!current) return next;
  const before = toColumns(current);
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => before[k] !== v));
}

export function useResellerLeads() {
  const queryClient = useQueryClient();
  const list = useServerFn(listResellerLeads);
  const create = useServerFn(createResellerLead);
  const update = useServerFn(updateResellerLead);
  const remove = useServerFn(deleteResellerLead);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => ((await list()) as Row[]).map(toRecord),
    staleTime: 15_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const createMutation = useMutation({
    mutationFn: (patch: Partial<CrudRecord>) =>
      create({ data: { name: patch.name ?? "", ...toColumns(patch) } as never }),
    onSuccess: refresh,
  });
  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<CrudRecord> }) => {
      const current = (query.data ?? []).find((r) => r.id === input.id);
      const columns = changedColumns(input.patch, current);
      // Nothing changed: there is nothing to save, and nothing failed.
      if (!Object.keys(columns).length) return null;
      return update({ data: { id: input.id, patch: columns } as never });
    },
    onSuccess: refresh,
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
  });

  return {
    records: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    create: (patch: Partial<CrudRecord>) => createMutation.mutateAsync(patch),
    /** Resolves once the row is saved (null when nothing changed); rejects with the reason otherwise. */
    update: (id: string, patch: Partial<CrudRecord>) => updateMutation.mutateAsync({ id, patch }),
    remove: (id: string) => removeMutation.mutateAsync(id),
    saving: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
  };
}
