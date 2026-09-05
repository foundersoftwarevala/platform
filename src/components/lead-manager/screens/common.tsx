import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Agent, Lead } from "@/lib/lead-manager/types";

/** Runs a real API call, refreshes every Lead Manager query and surfaces the result. */
export function useAction() {
  const qc = useQueryClient();
  return useCallback(
    async <T,>(fn: () => Promise<T>, success: string) => {
      try {
        const result = await fn();
        toast.success(success);
        await qc.invalidateQueries({ queryKey: ["lm"] });
        return result;
      } catch (error) {
        toast.error((error as Error).message);
        return undefined;
      }
    },
    [qc],
  );
}

export const agentNameMap = (agents: Agent[]) =>
  new Map(agents.map((a) => [a.id, a.name] as const));

export const leadNameMap = (leads: Lead[]) => new Map(leads.map((l) => [l.id, l.name] as const));

export function printReport(title: string) {
  document.title = `${title} — Software Vala Lead Manager`;
  window.print();
}
