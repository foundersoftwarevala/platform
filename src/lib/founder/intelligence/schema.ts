import { z } from "zod";

/**
 * What Founder AI is allowed to hand back, and how it is checked.
 *
 * Free text is fine for a person to read and useless for anything else to act
 * on, so the operations that feed the Decision Engine return structured output
 * and that output is validated before it is believed. A model that returns a
 * confidence of 150, an option referring to a KPI that does not exist, or a
 * FACT with no source is not producing a slightly imperfect answer — it is
 * producing one that would put a wrong number in front of an executive.
 *
 * The evidence taxonomy is the part worth being strict about. FACT,
 * OBSERVATION and CALCULATION assert something about the company and must name
 * where they came from; ASSUMPTION and INFERENCE are the model's own and must
 * not pretend otherwise. The schema refuses the confusion rather than trusting
 * the prompt to prevent it.
 */

export const EvidenceKindSchema = z.enum([
  "FACT",
  "OBSERVATION",
  "CALCULATION",
  "ASSUMPTION",
  "INFERENCE",
  "RECOMMENDATION",
]);

export const SeveritySchema = z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const EvidenceSchema = z
  .object({
    kind: EvidenceKindSchema,
    statement: z.string().min(3).max(600),
    /** The context block id this came from, e.g. CTX2. */
    sourceRef: z.string().max(80).nullable().optional(),
    calculation: z.string().max(400).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const asserts =
      value.kind === "FACT" || value.kind === "OBSERVATION" || value.kind === "CALCULATION";
    if (asserts && !value.sourceRef?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceRef"],
        message: `${value.kind} must name the context it came from; an unsourced claim is an inference.`,
      });
    }
    if (value.kind === "CALCULATION" && !value.calculation?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["calculation"],
        message: "A CALCULATION must state how it was worked out.",
      });
    }
  });

export const OptionSchema = z.object({
  label: z.string().min(1).max(4),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(1200),
  expectedBenefit: z.string().max(600).nullable().optional(),
  expectedCost: z.string().max(600).nullable().optional(),
  riskSummary: z.string().max(600).nullable().optional(),
  // Null is the correct answer when no figure could be estimated. Section 15
  // asks for UNKNOWN rather than fake precision.
  financialImpact: z.number().finite().nullable().optional(),
  financialBasis: z.string().max(400).nullable().optional(),
  customerImpact: SeveritySchema.nullable().optional(),
  operationalImpact: SeveritySchema.nullable().optional(),
  reversibility: z.enum(["REVERSIBLE", "PARTIAL", "IRREVERSIBLE", "UNKNOWN"]),
  timeToEffect: z.string().max(200).nullable().optional(),
  dependencies: z.array(z.string().max(200)).max(20).default([]),
});

export const RecommendationSchema = z
  .object({
    summary: z.string().min(10).max(1200),
    evidence: z.array(EvidenceSchema).min(1).max(40),
    options: z.array(OptionSchema).min(1).max(8),
    /** Must match one of the options' labels; checked below. */
    recommendedOption: z.string().min(1).max(4).nullable(),
    risks: z.array(z.string().min(3).max(500)).max(20).default([]),
    unknowns: z.array(z.string().min(3).max(500)).max(20).default([]),
    /** The model's own reading, kept apart from the derived confidence. */
    confidence: z.number().min(0).max(100),
    approvalRequired: z.boolean(),
    /** Set when the model believes it cannot answer on the evidence given. */
    insufficientEvidence: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.recommendedOption) {
      const labels = value.options.map((o) => o.label);
      if (!labels.includes(value.recommendedOption)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recommendedOption"],
          message: `The recommended option "${value.recommendedOption}" is not one of ${labels.join(", ")}.`,
        });
      }
    }
    // Saying the evidence is insufficient and recommending anyway is the exact
    // contradiction section 12 exists to prevent.
    if (value.insufficientEvidence && value.recommendedOption) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendedOption"],
        message: "A recommendation cannot be made while the evidence is declared insufficient.",
      });
    }
    // Every option label must be distinct, or a chosen option is ambiguous.
    const labels = value.options.map((o) => o.label);
    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Option labels must be distinct.",
      });
    }
  });

export type Recommendation = z.infer<typeof RecommendationSchema>;

export const INTENTS = [
  "COMPANY_STATUS",
  "ATTENTION",
  "KPI_ANALYSIS",
  "GOAL_ANALYSIS",
  "RISK_ANALYSIS",
  "DECISION_SUPPORT",
  "APPROVAL_REVIEW",
  "PERFORMANCE_ANALYSIS",
  "FORECAST",
  "ANOMALY_ANALYSIS",
  "REPORT",
  "RESEARCH",
  "OPERATIONAL_QUERY",
  "GENERAL_ASSISTANCE",
] as const;

export const IntentSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().min(0).max(100),
  /** What in the question led here, so an operator can see the reading. */
  because: z.string().min(3).max(300),
  /** Set when the question could mean two different operational things. */
  ambiguous: z.boolean().default(false),
  clarification: z.string().max(300).nullable().optional(),
});

export type IntentResult = z.infer<typeof IntentSchema>;

export const ExplanationSchema = z.object({
  answer: z.string().min(10).max(4000),
  evidence: z.array(EvidenceSchema).max(40).default([]),
  unknowns: z.array(z.string().min(3).max(500)).max(20).default([]),
  /** Anything in the context that tried to issue instructions. */
  suspiciousContent: z.array(z.string().max(300)).max(10).default([]),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

/**
 * A prediction is never a fact.
 *
 * Every forecast has to carry the horizon it covers, the method behind it and
 * what it assumes, because a number without those is a guess wearing a
 * decimal point.
 */
export const ForecastSchema = z.object({
  metric: z.string().min(1).max(120),
  baseline: z.number().finite().nullable(),
  projected: z.number().finite().nullable(),
  horizon: z.string().min(2).max(120),
  method: z.string().min(3).max(400),
  assumptions: z.array(z.string().min(3).max(300)).min(1).max(20),
  confidence: z.number().min(0).max(100),
  evidence: z.array(EvidenceSchema).max(20).default([]),
  /** Set when the data is too thin to project at all. */
  cannotProject: z.boolean().default(false),
});

export type Forecast = z.infer<typeof ForecastSchema>;

/** The JSON shape descriptions handed to the model, kept beside the schemas. */
export const SHAPE_HINTS = {
  recommendation: `{
  "summary": "string",
  "evidence": [{ "kind": "FACT|OBSERVATION|CALCULATION|ASSUMPTION|INFERENCE|RECOMMENDATION", "statement": "string", "sourceRef": "CTX1 (required for FACT, OBSERVATION and CALCULATION)", "calculation": "string (required for CALCULATION)" }],
  "options": [{ "label": "A", "title": "string", "description": "string", "expectedBenefit": "string|null", "expectedCost": "string|null", "riskSummary": "string|null", "financialImpact": "number|null — null if it cannot be estimated", "financialBasis": "string|null", "customerImpact": "INFO|LOW|MEDIUM|HIGH|CRITICAL|null", "operationalImpact": "INFO|LOW|MEDIUM|HIGH|CRITICAL|null", "reversibility": "REVERSIBLE|PARTIAL|IRREVERSIBLE|UNKNOWN", "timeToEffect": "string|null", "dependencies": ["string"] }],
  "recommendedOption": "A|null — null when the evidence will not support one",
  "risks": ["string"],
  "unknowns": ["string"],
  "confidence": 0,
  "approvalRequired": true,
  "insufficientEvidence": false
}`,
  intent: `{ "intent": "one of the listed intents", "confidence": 0, "because": "string", "ambiguous": false, "clarification": "string|null" }`,
  explanation: `{ "answer": "string", "evidence": [{ "kind": "...", "statement": "string", "sourceRef": "CTX1" }], "unknowns": ["string"], "suspiciousContent": ["string"] }`,
  forecast: `{ "metric": "string", "baseline": "number|null", "projected": "number|null", "horizon": "string", "method": "string", "assumptions": ["string"], "confidence": 0, "evidence": [...], "cannotProject": false }`,
} as const;
