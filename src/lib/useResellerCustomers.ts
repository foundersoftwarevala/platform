// The reseller dashboard's clients, kept on the server.
//
// The clients workspace was written against the browser-side crud store, so
// this presents the same shape it expects - records, create, update, remove -
// while the rows themselves live in crm_customers. A client added on the
// dashboard is therefore the same row the Reseller Manager's Customers wall
// reads, which is what "connected" has to mean.
//
// What the table has no column for - a comment thread, attachments, an audit
// trail - is not pretended into existence here. Those arrays stay empty and
// the screen says so where it offers them.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import {
  createResellerCustomer,
  deleteResellerCustomer,
  listResellerCustomers,
  updateResellerCustomer,
} from "@/lib/reseller-dashboard.functions";
import type { CrudRecord, RecordStatus } from "@/lib/crud-store";

type Row = {
  id: string;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  country: string | null;
  plan: string | null;
  status: string | null;
  health_score: number | null;
  lifetime_value: number | null;
  created_at: string | null;
};

const KEY = ["reseller", "customers"];

function toRecord(row: Row): CrudRecord {
  return {
    id: row.id,
    name: row.contact_name ?? "",
    status: (row.status as RecordStatus) ?? "active",
    owner: "you",
    category: row.plan ?? "",
    amount: Number(row.lifetime_value ?? 0),
    date: row.created_at ?? new Date().toISOString(),
    notes: "",
    tags: [],
    comments: [],
    audit: [],
    attachments: [],
    extra: {
      company: row.company_name ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      industry: row.industry ?? "",
      location: row.country ?? "",
      health: Number(row.health_score ?? 0),
    },
  };
}

/** Turn the workspace's record shape back into the table's columns. */
function toColumns(patch: Partial<CrudRecord>) {
  const extra = patch.extra ?? {};
  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.contact_name = patch.name;
  if (patch.status !== undefined) columns.status = patch.status;
  if (patch.category !== undefined) columns.plan = patch.category;
  if ("company" in extra) columns.company_name = String(extra.company ?? "");
  if ("email" in extra) columns.email = String(extra.email ?? "");
  if ("phone" in extra) columns.phone = String(extra.phone ?? "");
  if ("industry" in extra) columns.industry = String(extra.industry ?? "");
  if ("location" in extra) columns.country = String(extra.location ?? "");
  if ("health" in extra) columns.health_score = Number(extra.health ?? 0);
  return columns;
}

export function useResellerCustomers() {
  const queryClient = useQueryClient();
  const list = useServerFn(listResellerCustomers);
  const create = useServerFn(createResellerCustomer);
  const update = useServerFn(updateResellerCustomer);
  const remove = useServerFn(deleteResellerCustomer);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => ((await list()) as Row[]).map(toRecord),
    staleTime: 15_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const createMutation = useMutation({
    mutationFn: (patch: Partial<CrudRecord>) =>
      create({ data: { contact_name: patch.name ?? "", ...toColumns(patch) } as never }),
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
