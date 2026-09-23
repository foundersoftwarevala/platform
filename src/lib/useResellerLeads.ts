// The reseller dashboard's leads, kept on the server.
//
// Same arrangement as the clients workspace: the screen was written against
// the browser-side crud store, so this presents the shape it expects while
// the rows live in the leads table - the one the manager's Leads wall reads.
// A lead a reseller enters is therefore a lead the company has, not a note in
// one browser tab.
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
  status: string | null;
  priority: string | null;
  country: string | null;
  requirements: string | null;
  deal_value: number | null;
  next_follow_up: string | null;
  created_at: string | null;
};

const KEY = ["reseller", "leads"];

/** The dashboard calls the column "stage"; the table calls it status. */
function toRecord(row: Row): CrudRecord {
  return {
    id: row.id,
    name: row.name ?? "",
    status: "active" as RecordStatus,
    owner: "you",
    category: row.source ?? "",
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
      source: row.source ?? "",
      country: row.country ?? "",
      value: Number(row.deal_value ?? 0),
      stage: row.status ?? "new",
      followUp: row.next_follow_up ?? "",
    },
  };
}

function toColumns(patch: Partial<CrudRecord>) {
  const extra = patch.extra ?? {};
  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.name = patch.name;
  if (patch.notes !== undefined) columns.requirements = patch.notes;
  if ("email" in extra) columns.email = String(extra.email ?? "");
  if ("phone" in extra) columns.phone = String(extra.phone ?? "");
  if ("company" in extra) columns.company = String(extra.company ?? "");
  if ("industry" in extra) columns.industry = String(extra.industry ?? "");
  if ("country" in extra) columns.country = String(extra.country ?? "");
  if ("value" in extra) columns.deal_value = Number(extra.value ?? 0);
  if ("stage" in extra) columns.status = String(extra.stage ?? "new");
  if ("followUp" in extra) columns.next_follow_up = String(extra.followUp ?? "");
  return columns;
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
    mutationFn: (input: { id: string; patch: Partial<CrudRecord> }) =>
      update({ data: { id: input.id, patch: toColumns(input.patch) } as never }),
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
    update: (id: string, patch: Partial<CrudRecord>) => updateMutation.mutateAsync({ id, patch }),
    remove: (id: string) => removeMutation.mutateAsync(id),
    saving: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
  };
}
