import { rdOperator } from "./auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/lib/rd-module/supabase/client.server");
  return supabaseAdmin;
}

export const TEAM_AREAS = [
  "general",
  "process",
  "tools",
  "research",
  "prototypes",
  "collaboration",
  "product",
] as const;

export const submitTeamFeedback = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        member: z.string().trim().min(2, "Enter your name or code").max(80),
        area: z.enum(TEAM_AREAS),
        content: z.string().trim().min(5, "Feedback is too short").max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data: row, error } = await db.from("rnd_team_feedback").insert(data).select().single();
    if (error) throw new Error("Could not save feedback");
    return row;
  });

/** Runs AI over the latest team feedback and stores a new insight snapshot. */
export const runFeedbackInsights = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .handler(async () => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data: entries, error } = await db
      .from("rnd_team_feedback")
      .select("member, area, content")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load feedback");
    if (!entries || entries.length < 2)
      throw new Error("Add at least 2 feedback entries before running analysis.");
    const { generateFeedbackInsights, INSIGHTS_MODEL } = await import("./feedback-insights.server");
    const result = await generateFeedbackInsights(entries);
    const { data: row, error: saveErr } = await db
      .from("rnd_feedback_insights")
      .insert({
        summary: result.summary,
        themes: result.themes as never,
        improvements: result.improvements as never,
        feedback_count: entries.length,
        model: INSIGHTS_MODEL,
      })
      .select("id")
      .single();
    if (saveErr) throw new Error("Could not save insights");
    return { id: row.id };
  });
