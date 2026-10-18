import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { devDashboardFn } from "@/lib/vala-ai/studio/developer/developer.functions";
import {
  loadStudioManagementFn,
  saveStudioManagementFn,
} from "@/lib/vala-ai/studio/management.functions";
import { useOperator } from "../session";

type Management = Awaited<ReturnType<typeof loadStudioManagementFn>>;
export function useStudioManagement() {
  const operator = useOperator();
  const queryClient = useQueryClient();
  const key = ["vala-studio-management", operator.id];
  const query = useQuery({ queryKey: key, queryFn: () => loadStudioManagementFn() });
  const dashboard = useQuery({
    queryKey: ["vala-studio-dashboard", operator.id],
    queryFn: () => devDashboardFn(),
  });
  const save = useMutation({
    mutationFn: (next: { payments: Management["payments"]; aliases: Management["aliases"] }) => {
      if (!query.data) throw new Error("Load configuration before saving.");
      return saveStudioManagementFn({ data: { ...next, version: query.data.version } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const payments = query.data?.payments ?? [];
  const aliases = query.data?.aliases ?? [];
  const savePayments: Dispatch<SetStateAction<typeof payments>> = (value) => {
    save.mutate({ payments: typeof value === "function" ? value(payments) : value, aliases });
  };
  const saveAliases: Dispatch<SetStateAction<typeof aliases>> = (value) => {
    save.mutate({ payments, aliases: typeof value === "function" ? value(aliases) : value });
  };
  return {
    payments,
    aliases,
    savePayments,
    saveAliases,
    modelNames: query.data?.modelNames ?? [],
    ownerData: query.data?.ownerData,
    dashboard: dashboard.data,
    error: save.error?.message ?? query.error?.message ?? dashboard.error?.message ?? null,
  };
}
