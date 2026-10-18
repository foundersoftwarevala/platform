import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  decideFounderApproval,
  loadApprovalSuggestions,
  loadFounderGovernance,
} from "@/lib/founder/decision.functions";
import type { ApprovalSuggestion } from "@/lib/founder/decision.types";
import type {
  ComplianceItemView,
  GovernanceView,
  PreventiveAction,
  RiskCategoryView,
} from "@/lib/founder/governance.server";

export type { ApprovalSuggestion, ComplianceItemView, PreventiveAction, RiskCategoryView };

/**
 * Governance data for the Risk & Compliance and Approval Suggestions screens.
 *
 * Both screens existed and both drew from arrays written into the component.
 * This is the wiring that replaces those arrays, and it keeps the same three
 * states the rest of the module uses: loading, failed, and an answer — where
 * an empty answer means the register is empty, which is a fact, rather than
 * that the read failed, which is not.
 */

const EMPTY: GovernanceView = {
  riskCategories: [],
  compliance: [],
  preventive: [],
  openRisks: 0,
  criticalRisks: 0,
  sources: {},
  degraded: [],
};

export function useFounderGovernance() {
  const fetchGovernance = useServerFn(loadFounderGovernance);

  const query = useQuery({
    queryKey: ["founder", "governance"],
    queryFn: () => fetchGovernance(),
    staleTime: 30_000,
  });

  const data = (query.data as GovernanceView | undefined) ?? EMPTY;

  return {
    ...data,
    isLoading: query.isLoading,
    failed: query.isError,
    refetch: query.refetch,
  };
}

/**
 * The approval queue, and the one action a person can take on it.
 *
 * Every verdict needs a reason — the server refuses one without — so the
 * caller must supply it rather than the screen inventing a default.
 */
export function useApprovalSuggestions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchSuggestions = useServerFn(loadApprovalSuggestions);
  const decide = useServerFn(decideFounderApproval);

  const query = useQuery({
    queryKey: ["founder", "approval-suggestions"],
    queryFn: () => fetchSuggestions(),
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: (input: {
      approvalId: string;
      verdict: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
      reason: string;
    }) => decide({ data: input }),
    onSuccess: (result) => {
      if (result?.ok) {
        toast.success(t("ceo.decision_recorded"));
        void queryClient.invalidateQueries({ queryKey: ["founder"] });
      } else {
        // The server's refusal is shown as written: it explains which rule
        // stopped it, which is more use than a generic failure.
        toast.error(result?.error ?? "That decision was not recorded");
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "That decision failed"),
  });

  return {
    suggestions: (query.data as ApprovalSuggestion[] | undefined) ?? [],
    isLoading: query.isLoading,
    failed: query.isError,
    refetch: query.refetch,
    decide: mutation.mutateAsync,
    isDeciding: mutation.isPending,
  };
}
