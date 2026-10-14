import {
  Code,
  FileText,
  FlaskConical,
  Lightbulb,
  MessageSquare,
  Radar,
  Shield,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { useRnDAI } from "@/hooks/rd-module/useRnDAI";

export type RnDAIApi = ReturnType<typeof useRnDAI>;
export type FieldValues = Record<string, string>;

export interface CapabilityField {
  key: string;
  placeholder: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
}

export interface CapabilityAction {
  label: string;
  icon: LucideIcon;
  variant?: "primary" | "outline";
  /** Field keys that must be filled before the action is enabled. */
  requires?: string[];
  run: (api: RnDAIApi, values: FieldValues) => Promise<string | null>;
}

export interface Capability {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  fields: CapabilityField[];
  actions: CapabilityAction[];
  legend?: { label: string; hint: string; tone: string }[];
}

/** The chat capability is rendered by AIAssistantChat, the rest share the generic form. */
export const CHAT_CAPABILITY_ID = "chat";

export const capabilities: Capability[] = [
  {
    id: CHAT_CAPABILITY_ID,
    label: "AI Chat",
    icon: MessageSquare,
    title: "R&D AI Assistant",
    description: "Ask anything about R&D strategy, innovation or technology trends.",
    fields: [],
    actions: [],
  },
  {
    id: "evaluate",
    label: "Idea Evaluator",
    icon: Lightbulb,
    title: "AI Idea Evaluator",
    description: "Get comprehensive AI analysis of your R&D ideas.",
    fields: [
      { key: "title", label: "Idea title", placeholder: "Idea title", required: true },
      {
        key: "description",
        label: "Description",
        placeholder: "Describe your idea in detail...",
        multiline: true,
        required: true,
      },
      { key: "category", label: "Category", placeholder: "Category (e.g. AI, UX, DevTools)" },
    ],
    actions: [
      {
        label: "Evaluate idea",
        icon: Sparkles,
        requires: ["title", "description"],
        run: (api, v) =>
          api.evaluateIdea(v["title"] ?? "", v["description"] ?? "", v["category"] || "General"),
      },
    ],
  },
  {
    id: "trends",
    label: "Trend Analysis",
    icon: TrendingUp,
    title: "AI Trend Analyzer",
    description: "Deep-dive into market and technology trends.",
    fields: [
      {
        key: "trend",
        label: "Trend",
        placeholder: "Enter a trend to analyze (e.g. 'AI-powered code generation')",
        multiline: true,
        required: true,
      },
    ],
    actions: [
      {
        label: "Analyze trend",
        icon: TrendingUp,
        requires: ["trend"],
        run: (api, v) => api.analyzeTrend(v["trend"] ?? ""),
      },
    ],
  },
  {
    id: "prototype",
    label: "Prototype Planner",
    icon: Code,
    title: "AI Prototype Planner",
    description: "Generate detailed prototype development plans.",
    fields: [
      { key: "project", label: "Project name", placeholder: "Project name", required: true },
      {
        key: "goal",
        label: "Project goal",
        placeholder: "Project goal — what are you trying to achieve?",
        multiline: true,
        required: true,
      },
    ],
    actions: [
      {
        label: "Generate plan",
        icon: Code,
        requires: ["project", "goal"],
        run: (api, v) => api.createPrototypePlan(v["project"] ?? "", v["goal"] ?? ""),
      },
      {
        label: "Risk analysis",
        icon: Shield,
        variant: "outline",
        requires: ["project"],
        run: (api, v) => api.developRiskMitigation(v["project"] ?? ""),
      },
    ],
  },
  {
    id: "brainstorm",
    label: "Innovation Lab",
    icon: Sparkles,
    title: "AI Innovation Lab",
    description: "Generate innovative ideas through AI brainstorming.",
    fields: [
      {
        key: "problemSpace",
        label: "Problem space",
        placeholder: "Describe the problem space or area you want to innovate in...",
        multiline: true,
        required: true,
      },
    ],
    actions: [
      {
        label: "Generate innovation ideas",
        icon: Sparkles,
        requires: ["problemSpace"],
        run: (api, v) => api.brainstormInnovation(v["problemSpace"] ?? ""),
      },
    ],
  },
  {
    id: "proposal",
    label: "Auto Proposal",
    icon: FileText,
    title: "AI Proposal Generator",
    description: "Auto-generate complete R&D proposals.",
    fields: [
      {
        key: "opportunity",
        label: "Opportunity",
        placeholder: "Describe the market opportunity or problem to address...",
        multiline: true,
        required: true,
      },
    ],
    actions: [
      {
        label: "Generate full proposal",
        icon: FileText,
        requires: ["opportunity"],
        run: (api, v) => api.autoGenerateProposal(v["opportunity"] ?? ""),
      },
    ],
  },
  {
    id: "radar",
    label: "Tech Radar",
    icon: Radar,
    title: "AI Technology Radar",
    description: "Generate a technology radar for strategic planning.",
    fields: [
      { key: "domain", label: "Domain", placeholder: "Domain (default: Software Development)" },
      { key: "horizon", label: "Time horizon", placeholder: "Time horizon (default: 2 years)" },
    ],
    legend: [
      { label: "ADOPT", hint: "Production ready", tone: "border-success/40 text-success" },
      { label: "TRIAL", hint: "Worth piloting", tone: "border-info/40 text-info" },
      { label: "ASSESS", hint: "Worth exploring", tone: "border-warning/40 text-warning" },
      { label: "HOLD", hint: "Proceed with caution", tone: "border-danger/40 text-danger" },
    ],
    actions: [
      {
        label: "Generate technology radar",
        icon: Radar,
        run: (api, v) =>
          api.createTechnologyRadar(
            v["domain"] || "Software Development",
            v["horizon"] || "2 years",
          ),
      },
    ],
  },
  {
    id: "experiment",
    label: "Experiment Design",
    icon: FlaskConical,
    title: "AI Experiment Designer",
    description: "Design controlled experiments for R&D validation.",
    fields: [
      {
        key: "hypothesis",
        label: "Hypothesis",
        placeholder:
          "Enter your hypothesis to test (e.g. 'AI code completion cuts dev time by 30%')",
        multiline: true,
        required: true,
      },
    ],
    actions: [
      {
        label: "Design experiment",
        icon: FlaskConical,
        requires: ["hypothesis"],
        run: (api, v) => api.designExperiment(v["hypothesis"] ?? ""),
      },
    ],
  },
];
