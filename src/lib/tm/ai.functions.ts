import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
}

/** Generates task breakdowns with Lovable AI. No canned/mock output. */
export const generateTasks = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AITaskSuggestion[]> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are the task planner for a software agency operations platform. Break a work brief into concrete, independently deliverable engineering tasks. Reply with JSON only.",
          },
          {
            role: "user",
            content: [
              `Brief: ${data.brief}`,
              `Produce exactly ${data.count} tasks.`,
              data.context.categories.length ? `Allowed categories: ${data.context.categories.join(", ")}.` : "",
              data.context.members.length ? `Team roles available: ${data.context.members.join(", ")}.` : "",
              'Return JSON of shape {"tasks":[{"title","description","category","priority","difficulty","estimated_hours","sla_hours","tags":[],"subtasks":[],"suggested_owner_role"}]}.',
              "priority ∈ low|medium|high|critical. difficulty ∈ easy|medium|hard|expert. estimated_hours and sla_hours are numbers.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`AI gateway failed [${response.status}]: ${body}`);
      if (response.status === 429) throw new Error("AI rate limit reached, please retry shortly.");
      if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed [${response.status}]`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "{}";

    const parsed = z
      .object({
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
            }),
          )
          .default([]),
      })
      .safeParse(JSON.parse(content));

    if (!parsed.success) throw new Error("AI returned an unexpected response shape.");
    return parsed.data.tasks;
  });
