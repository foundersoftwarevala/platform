import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  generateFounderReport,
  loadFounderLearning,
  loadFounderReports,
  searchFounderKnowledge,
} from "@/lib/founder/brain/brain.functions";
import type { KnowledgeItem } from "@/lib/founder/brain/knowledge.server";
import type {
  DecisionMemory,
  LearningEntry,
  LearningTotals,
  OverridePattern,
} from "@/lib/founder/brain/learning.server";
import type { ReportRecord, ReportTotals } from "@/lib/founder/brain/reports.server";

export type {
  DecisionMemory,
  KnowledgeItem,
  LearningEntry,
  LearningTotals,
  OverridePattern,
  ReportRecord,
  ReportTotals,
};

/**
 * The Company Brain, the learning log and the reports, as the screens read
 * them.
 *
 * Each keeps loading, failed and answered apart. An empty answer means the
 * register is empty, which is a fact worth showing; a failed read means we do
 * not know, which is a different thing and must not be drawn as "none".
 */

export function useFounderKnowledge(
  query: { search?: string; kind?: string; staleOnly?: boolean } = {},
) {
  const search = useServerFn(searchFounderKnowledge);

  const result = useQuery({
    queryKey: [
      "founder",
      "knowledge",
      query.search ?? "",
      query.kind ?? "",
      query.staleOnly ?? false,
    ],
    queryFn: () => search({ data: query }),
    staleTime: 30_000,
  });

  const data = result.data as
    { items: KnowledgeItem[]; total: number; retrieval: string; degraded: string[] } | undefined;

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    // Named so a screen can say what kind of search this was rather than
    // implying it understood the question.
    retrieval: data?.retrieval ?? "FILTER_ONLY",
    degraded: data?.degraded ?? [],
    isLoading: result.isLoading,
    failed: result.isError,
    refetch: result.refetch,
  };
}

export function useFounderLearning() {
  const load = useServerFn(loadFounderLearning);

  const result = useQuery({
    queryKey: ["founder", "learning"],
    queryFn: () => load(),
    staleTime: 30_000,
  });

  const data = result.data as
    | {
        entries: LearningEntry[];
        memories: DecisionMemory[];
        patterns: OverridePattern[];
        totals: LearningTotals | null;
        degraded: string[];
      }
    | undefined;

  return {
    entries: data?.entries ?? [],
    memories: data?.memories ?? [],
    patterns: data?.patterns ?? [],
    // Null, not zero: a count that could not be taken is unknown, and the
    // screen shows it as unknown.
    totals: data?.totals ?? null,
    degraded: data?.degraded ?? [],
    isLoading: result.isLoading,
    failed: result.isError,
    refetch: result.refetch,
  };
}

export function useFounderReports() {
  const queryClient = useQueryClient();
  const load = useServerFn(loadFounderReports);
  const generate = useServerFn(generateFounderReport);

  const result = useQuery({
    queryKey: ["founder", "reports"],
    queryFn: () => load(),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (input: { reportType: string; days: number }) => generate({ data: input as never }),
    onSuccess: (raw) => {
      const response = raw as { ok?: boolean; report?: ReportRecord; error?: string } | undefined;
      if (response?.ok) {
        // A report that found nothing is a successful report, and says so
        // rather than being announced as a finding-free success.
        toast.success(
          response.report?.insufficientData
            ? "Report generated: not enough data for this period"
            : "Report generated",
        );
        void queryClient.invalidateQueries({ queryKey: ["founder", "reports"] });
      } else {
        toast.error(response?.error ?? "That report was not generated");
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "That report was not generated"),
  });

  const data = result.data as
    { reports: ReportRecord[]; totals: ReportTotals | null; degraded: string[] } | undefined;

  return {
    reports: data?.reports ?? [],
    totals: data?.totals ?? null,
    degraded: data?.degraded ?? [],
    isLoading: result.isLoading,
    failed: result.isError,
    refetch: result.refetch,
    generate: mutation.mutateAsync,
    isGenerating: mutation.isPending,
  };
}
