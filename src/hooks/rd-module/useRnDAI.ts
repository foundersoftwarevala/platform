import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { logger, toMessage } from "@/lib/rd-module/logger";
import { runRnDAIRequest } from "@/lib/rd-module/rnd-ai.functions";

type Payload = Record<string, string | undefined>;

function clean(payload: Payload): Record<string, string> {
  return Object.fromEntries(
    Object.entries(payload).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}

export const useRnDAI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const run = useServerFn(runRnDAIRequest);

  const callAI = async (type: string, payload: Payload): Promise<string | null> => {
    setIsLoading(true);
    try {
      const response = await run({ data: { type, data: clean(payload) } });
      return response.result;
    } catch (error) {
      const message = toMessage(error, "AI request failed");
      logger.error({ scope: "rnd.ai", event: "ai_request_failed", type }, error);
      toast.error("AI request failed", { description: message });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    callAI,
    chat: (message: string, context?: string) => callAI("chat", { message, context }),
    evaluateIdea: (title: string, description: string, category: string, author?: string) =>
      callAI("idea_evaluation", { title, description, category, author }),
    analyzeTrend: (trend: string, industry?: string, status?: string) =>
      callAI("trend_analysis", { trend, industry, status }),
    createPrototypePlan: (project: string, goal: string, techStack?: string, timeline?: string) =>
      callAI("prototype_plan", { project, goal, techStack, timeline }),
    assessImpact: (initiative: string, currentState: string, proposedChanges: string) =>
      callAI("impact_assessment", { initiative, currentState, proposedChanges }),
    analyzeCompetitors: (focusArea: string, competitors?: string, strengths?: string) =>
      callAI("competitor_analysis", { focusArea, competitors, strengths }),
    recommendTechStack: (
      projectType: string,
      requirements: string,
      scale?: string,
      teamExpertise?: string,
    ) => callAI("tech_stack_recommendation", { projectType, requirements, scale, teamExpertise }),
    synthesizeResearch: (topic: string, sources?: string, timePeriod?: string) =>
      callAI("research_synthesis", { topic, sources, timePeriod }),
    brainstormInnovation: (
      problemSpace: string,
      constraints?: string,
      targetUsers?: string,
      innovationLevel?: string,
    ) =>
      callAI("innovation_brainstorm", { problemSpace, constraints, targetUsers, innovationLevel }),
    analyzePatentLandscape: (technologyArea: string, keyFeatures?: string, targetMarket?: string) =>
      callAI("patent_landscape", { technologyArea, keyFeatures, targetMarket }),
    developRiskMitigation: (project: string, risks?: string, stage?: string) =>
      callAI("risk_mitigation", { project, risks, stage }),
    optimizeResources: (
      teamSize?: string,
      projects?: string,
      budget?: string,
      priorities?: string,
    ) => callAI("resource_optimization", { teamSize, projects, budget, priorities }),
    autoGenerateProposal: (opportunity: string, strategicFit?: string, resources?: string) =>
      callAI("auto_proposal", { opportunity, strategicFit, resources }),
    createTechnologyRadar: (domain?: string, timeHorizon?: string, focusAreas?: string) =>
      callAI("technology_radar", { domain, timeHorizon, focusAreas }),
    designExperiment: (hypothesis: string, variables?: string, successCriteria?: string) =>
      callAI("experiment_design", { hypothesis, variables, successCriteria }),
  };
};
