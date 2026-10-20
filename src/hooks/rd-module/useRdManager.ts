import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addOpportunityNote,
  createRdProject,
  getOpportunity,
  listEvaluations,
  listOpportunities,
  listRdProjects,
  saveEvaluation,
  updateOpportunity,
  updateRdProject,
} from "@/lib/rd-module/rd-opportunities.functions";
import type {
  Evaluation,
  Opportunity,
  OpportunityEvent,
  RdProject,
} from "@/lib/rd-module/rd-opportunity-types";

export interface OpportunityDetailData {
  opportunity: Opportunity;
  events: OpportunityEvent[];
  evaluation: Evaluation | null;
  projects: RdProject[];
  similar: {
    opportunities: {
      id: string;
      public_request_id: string;
      title: string;
      status: string;
      type: string;
    }[];
    products: { id: string; product: string; version: string; user_code: string }[];
    ideas: { id: string; title: string; status: string }[];
  };
}

export const rdKeys = {
  all: ["rd-manager"] as const,
  list: ["rd-manager", "opportunities"] as const,
  projects: ["rd-manager", "projects"] as const,
  evaluations: ["rd-manager", "evaluations"] as const,
  detail: (id: string) => ["rd-manager", "detail", id] as const,
};

export function useOpportunities() {
  const fn = useServerFn(listOpportunities);
  return useQuery({
    queryKey: rdKeys.list,
    queryFn: async () => (await fn()) as unknown as Opportunity[],
    refetchInterval: 15_000,
  });
}
export function useRdProjects() {
  const fn = useServerFn(listRdProjects);
  return useQuery({
    queryKey: rdKeys.projects,
    queryFn: async () => (await fn()) as unknown as RdProject[],
  });
}
export function useRdEvaluations() {
  const fn = useServerFn(listEvaluations);
  return useQuery({
    queryKey: rdKeys.evaluations,
    queryFn: async () => (await fn()) as unknown as Evaluation[],
  });
}
export function useOpportunityDetail(id: string | null) {
  const fn = useServerFn(getOpportunity);
  return useQuery({
    queryKey: rdKeys.detail(id ?? ""),
    queryFn: async () => (await fn({ data: { id: id! } })) as unknown as OpportunityDetailData,
    enabled: !!id,
  });
}

function useAction<T>(fn: (args: { data: T }) => Promise<unknown>, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: T) => fn({ data }),
    onSuccess: () => {
      toast.success(success);
      qc.invalidateQueries({ queryKey: rdKeys.all });
      qc.invalidateQueries({ queryKey: ["rnd"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRdActions() {
  const update = useServerFn(updateOpportunity);
  const note = useServerFn(addOpportunityNote);
  const evaluate = useServerFn(saveEvaluation);
  const project = useServerFn(createRdProject);
  const projectUpdate = useServerFn(updateRdProject);
  return {
    update: useAction(
      update as never as (a: {
        data: NonNullable<Parameters<typeof update>[0]>["data"];
      }) => Promise<unknown>,
      "Opportunity updated",
    ),
    note: useAction(
      note as never as (a: {
        data: NonNullable<Parameters<typeof note>[0]>["data"];
      }) => Promise<unknown>,
      "Saved",
    ),
    evaluate: useAction(
      evaluate as never as (a: {
        data: NonNullable<Parameters<typeof evaluate>[0]>["data"];
      }) => Promise<unknown>,
      "Evaluation saved",
    ),
    project: useAction(
      project as never as (a: {
        data: NonNullable<Parameters<typeof project>[0]>["data"];
      }) => Promise<unknown>,
      "Project created",
    ),
    projectUpdate: useAction(
      projectUpdate as never as (a: {
        data: NonNullable<Parameters<typeof projectUpdate>[0]>["data"];
      }) => Promise<unknown>,
      "Project updated",
    ),
  };
}
