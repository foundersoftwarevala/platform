import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { logger, toMessage } from "@/lib/rd-module/logger";
import { runProManagerAIRequest } from "@/lib/rd-module/pm-ai.functions";

type Payload = Record<string, string | number | boolean | undefined | null>;

function clean(payload: Payload): Record<string, string> {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );
}

export const useProManagerAI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const run = useServerFn(runProManagerAIRequest);

  const callAI = async (type: string, payload: Payload): Promise<string | null> => {
    setIsLoading(true);
    try {
      const response = await run({ data: { type, data: clean(payload) } });
      return response.result;
    } catch (error) {
      const message = toMessage(error, "AI request failed");
      logger.error({ scope: "pm.ai", event: "ai_request_failed", type }, error);
      toast.error("AI request failed", { description: message });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    callAI,
    helpdeskReply: (message: string, topic?: string, language?: string, history?: string) =>
      callAI("helpdesk_reply", { message, topic, language, history }),
    triageIssue: (code: string, build: string, summary: string, status: string, attempts: number) =>
      callAI("issue_fix", { code, build, summary, status, attempts }),
    churnRisk: (user_code: string, csat: number, risk: string, feedback: string) =>
      callAI("churn_risk", { user_code, csat, risk, feedback }),
    escalationSummary: (
      code: string,
      source: string,
      priority: string,
      subject: string,
      description: string,
    ) => callAI("escalation_summary", { code, source, priority, subject, description }),
    decisionAdvice: (input: {
      code: string;
      type: string;
      priority: string;
      is_financial: boolean;
      subject: string;
      description: string;
      amount?: number | null;
    }) => callAI("decision_recommendation", input),
    slaAdvice: (input: {
      code: string;
      action: string;
      task_code: string;
      owner: string;
      deadline: string;
      status: string;
      priority: string;
    }) => callAI("sla_advice", input),
    healthAnalysis: (metrics: string) => callAI("health_analysis", { metrics }),
    qualityPattern: (input: {
      pattern: string;
      affected_entity: string;
      entity_type: string;
      description: string;
      confidence: number;
      suggested_action: string;
    }) => callAI("quality_pattern", input),
    complianceReview: (
      user_code: string,
      agreement_accepted: boolean,
      violations: number,
      legal_flag: boolean,
    ) => callAI("compliance_review", { user_code, agreement_accepted, violations, legal_flag }),
    usageAdvice: (input: {
      user_code: string;
      api_pct: number;
      storage_pct: number;
      ai_calls_pct: number;
      fair_usage_alert: boolean;
    }) => callAI("usage_advice", input),
  };
};
