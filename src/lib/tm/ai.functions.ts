import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { executeAiRequest } from "@/lib/ai-api.functions";
import { requireCallerRole } from "@/lib/auth/caller-roles";

/**
 * Who may ask for suggestions: the roles RouteAccessGate lets into
 * /task-manager, where the AI Task Generator lives. Platform operators are
 * added by requireCallerRole.
 */
const TASK_MANAGER_ROLES = ["developer", "support", "sales"] as const;

/**
 * The AI Task Generator of section 18.
 *
 * This used to call the Lovable AI gateway directly on a LOVABLE_API_KEY.
 * Lovable is no longer part of this platform, and that key is not set on the
 * server, so every generation attempt failed with "AI is not configured" -
 * which read as a broken screen rather than as a removed vendor.
 *
 * It now goes through AI API Manager, which is the single place this platform
 * keeps AI providers, models and credentials. That means the provider can be
 * changed by an operator without a deployment, the call is metered into
 * usage_events like every other AI call, and there is exactly one place a key
 * lives. Nothing here holds a credential of its own.
 *
 * Suggestions are returned for review and are not written to the task table.
 * Section 18 is explicit that a person approves them before they become tasks,
 * and section 27 is explicit that nothing may be invented: if no provider is
 * configured, this raises the reason rather than returning a plausible-looking
 * list that nobody asked a model for.
 */

const inputSchema = z.object({
  brief: z.string().min(10).max(4000),
  count: z.number().int().min(1).max(8).default(4),
  context: z
    .object({
      categories: z.array(z.string()).max(20).default([]),
      members: z.array(z.string()).max(40).default([]),
    })
    .default({ categories: [], members: [] }),
});

export interface AITaskSuggestion {
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  difficulty: "easy" | "medium" | "hard" | "expert";
  estimated_hours: number;
  sla_hours: number;
  tags: string[];
  subtasks: string[];
  suggested_owner_role: string;
  acceptance_criteria: string[];
}

const suggestionSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().default(""),
        category: z.string().default("development"),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        difficulty: z.enum(["easy", "medium", "hard", "expert"]).default("medium"),
        estimated_hours: z.coerce.number().min(0.5).max(200).default(4),
        sla_hours: z.coerce.number().min(1).max(720).default(24),
        tags: z.array(z.string()).default([]),
        subtasks: z.array(z.string()).default([]),
        suggested_owner_role: z.string().default("developer"),
        acceptance_criteria: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

const SYSTEM =
  "You are the task planner for a software agency operations platform. Break a work " +
  "brief into concrete, independently deliverable engineering tasks. Reply with JSON only, " +
  "with no prose and no code fence.";

/** Models often wrap JSON in a fence or a sentence; take the object itself. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The AI provider did not return a JSON object.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export const generateTasks = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AITaskSuggestion[]> => {
    // Every generation is a metered provider call, and nothing checked who was
    // asking, so anyone who could reach /_serverFn could spend the platform's AI
    // credit. The caller must now be signed in and hold a Task Manager role.
    await requireCallerRole(TASK_MANAGER_ROLES, "The AI Task Generator is available to Task Manager roles.");

    const prompt = [
      `Brief: ${data.brief}`,
      `Produce exactly ${data.count} tasks.`,
      data.context.categories.length
        ? `Allowed categories: ${data.context.categories.join(", ")}.`
        : "",
      data.context.members.length
        ? `Team roles available: ${data.context.members.join(", ")}.`
        : "",
      'Return JSON of shape {"tasks":[{"title","description","category","priority",' +
        '"difficulty","estimated_hours","sla_hours","tags":[],"subtasks":[],' +
        '"suggested_owner_role","acceptance_criteria":[]}]}.',
      "priority is one of low|medium|high|critical. difficulty is one of easy|medium|hard|expert. " +
        "estimated_hours and sla_hours are numbers.",
    ]
      .filter(Boolean)
      .join("\n");

    // Routed, credentialed and metered by AI API Manager. If no provider is
    // active there, this throws with that reason and the screen shows it.
    const { text } = await executeAiRequest({
      module: "task-manager",
      system: SYSTEM,
      prompt,
    });

    const parsed = suggestionSchema.safeParse(extractJson(text));
    if (!parsed.success) throw new Error("AI returned an unexpected response shape.");
    return parsed.data.tasks;
  });
