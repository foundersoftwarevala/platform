import { rdOperator } from "./auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/lib/rd-module/supabase/client.server");
  return supabaseAdmin;
}

function fail(message: string, error: { message: string } | null) {
  if (error) throw new Error(`${message}: ${error.message}`);
}

const ideaSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(4000),
  category: z.enum(["ai", "uiux", "devtools", "client", "automation"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  author: z.string().min(2).max(60).default("vala(rnd)0000"),
  feasibility: z.number().int().min(0).max(100).default(0),
});

export const createIdea = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) => ideaSchema.parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rnd_ideas")
      .insert({ ...data, status: "evaluating" })
      .select()
      .single();
    fail("Could not save idea", error);
    await db.from("rnd_notifications").insert({
      type: "idea",
      title: "New Idea Submitted",
      message: `${data.title} has been added to Future Lab`,
    });
    return row;
  });

export const voteIdea = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), delta: z.number().int().min(-1).max(1) }).parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: current, error: readError } = await db
      .from("rnd_ideas")
      .select("votes")
      .eq("id", data.id)
      .single();
    fail("Idea not found", readError);
    const votes = Math.max(0, (current?.votes ?? 0) + data.delta);
    const { error } = await db
      .from("rnd_ideas")
      .update({ votes, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    fail("Could not register vote", error);
    return { votes };
  });

export const updateIdeaStatus = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["evaluating", "approved", "in_prototype", "rejected"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("rnd_ideas")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    fail("Could not update idea", error);
    return { ok: true };
  });

export const createPrototype = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        name: z.string().min(3).max(160),
        modules: z.array(z.string().min(1)).default([]),
        estimated_hours: z.number().int().min(0).max(10000).default(0),
        team: z.array(z.string().min(1)).default([]),
        integrations: z.array(z.string().min(1)).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rnd_prototypes")
      .insert({ ...data, status: "active" })
      .select()
      .single();
    fail("Could not create prototype", error);
    return row;
  });

export const updatePrototypeProgress = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        progress: z.number().int().min(0).max(100),
        completed_hours: z.number().int().min(0).max(10000).optional(),
        status: z.enum(["active", "testing", "completed", "paused"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { id, ...patch } = data;
    const { error } = await db
      .from("rnd_prototypes")
      .update({
        progress: patch.progress,
        updated_at: new Date().toISOString(),
        ...(patch.completed_hours !== undefined ? { completed_hours: patch.completed_hours } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      })
      .eq("id", id);
    fail("Could not update prototype", error);
    return { ok: true };
  });

export const saveImpactAnalysis = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        feature: z.string().min(2).max(160),
        revenue_impact: z.enum(["low", "medium", "high"]),
        effort_level: z.enum(["low", "medium", "high"]),
        technical_risk: z.enum(["low", "medium", "high"]),
        user_demand: z.number().int().min(0).max(100),
        performance_load: z.number().int().min(0).max(100),
        maintenance_cost: z.enum(["low", "medium", "high"]),
        ai_recommendation: z.string().max(4000).default(""),
        score_revenue: z.number().int().min(0).max(100),
        score_effort: z.number().int().min(0).max(100),
        score_risk: z.number().int().min(0).max(100),
        score_demand: z.number().int().min(0).max(100),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rnd_impact_analyses")
      .insert(data)
      .select()
      .single();
    fail("Could not save impact analysis", error);
    return row;
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        content: z.string().min(5).max(2000),
        source: z.enum(["survey", "support_ticket", "chat_log", "interview"]),
        category: z.enum(["feature_request", "pain_point", "praise", "bug"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { runRnDAI } = await import("./rnd-ai.server");
    let sentiment = "neutral";
    let sentimentScore = 0;
    try {
      const verdict = await runRnDAI("chat", {
        message: `Classify the sentiment of this product feedback. Reply with ONLY one JSON object: {"sentiment":"positive|neutral|negative","score":number between -1 and 1}. Feedback: ${data.content}`,
        context: "Sentiment classification",
      });
      const match = verdict.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { sentiment?: string; score?: number };
        if (parsed.sentiment) sentiment = parsed.sentiment;
        if (typeof parsed.score === "number")
          sentimentScore = Math.max(-1, Math.min(1, parsed.score));
      }
    } catch (error) {
      console.error("Sentiment analysis failed, storing as neutral", error);
    }
    const { data: row, error } = await db
      .from("rnd_feedback")
      .insert({ ...data, sentiment, sentiment_score: sentimentScore, status: "in_review" })
      .select()
      .single();
    fail("Could not save feedback", error);
    return row;
  });

export const voteFeedback = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: current, error: readError } = await db
      .from("rnd_feedback")
      .select("votes")
      .eq("id", data.id)
      .single();
    fail("Feedback not found", readError);
    const votes = (current?.votes ?? 0) + 1;
    const { error } = await db.from("rnd_feedback").update({ votes }).eq("id", data.id);
    fail("Could not register vote", error);
    return { votes };
  });

export const voteDecision = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), vote: z.enum(["approve", "reject", "hold"]) }).parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: current, error: readError } = await db
      .from("rnd_decisions")
      .select("votes_approve, votes_reject, votes_hold")
      .eq("id", data.id)
      .single();
    fail("Decision not found", readError);
    const column =
      data.vote === "approve"
        ? "votes_approve"
        : data.vote === "reject"
          ? "votes_reject"
          : "votes_hold";
    const next = ((current as Record<string, number> | null)?.[column] ?? 0) + 1;
    const update =
      data.vote === "approve"
        ? { votes_approve: next }
        : data.vote === "reject"
          ? { votes_reject: next }
          : { votes_hold: next };
    const { error } = await db.from("rnd_decisions").update(update).eq("id", data.id);
    fail("Could not register vote", error);
    return { ok: true };
  });

export const setDecisionStatus = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected", "on_hold"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rnd_decisions")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("title")
      .single();
    fail("Could not update decision", error);
    await db.from("rnd_notifications").insert({
      type: "approval",
      title: "Decision Updated",
      message: `${row?.title ?? "Decision"} is now ${data.status.replace("_", " ")}`,
    });
    return { ok: true };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const query = db.from("rnd_notifications").update({ read: true });
    const { error } = data.id ? await query.eq("id", data.id) : await query.eq("read", false);
    fail("Could not update notifications", error);
    return { ok: true };
  });

export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("rnd_notifications")
      .update({ dismissed: true, read: true })
      .eq("id", data.id);
    fail("Could not dismiss notification", error);
    return { ok: true };
  });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        budget_id: z.string().uuid(),
        description: z.string().min(2).max(200),
        amount: z.number().int(),
        type: z.enum(["credit", "deduction"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const amount = data.type === "deduction" ? -Math.abs(data.amount) : Math.abs(data.amount);
    const { data: row, error } = await db
      .from("rnd_transactions")
      .insert({ ...data, amount, status: "completed" })
      .select()
      .single();
    fail("Could not record transaction", error);
    return row;
  });

export const upsertTechnology = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        category: z.enum([
          "languages",
          "frameworks",
          "tools",
          "platforms",
          "techniques",
          "infrastructure",
        ]),
        ring: z.enum(["adopt", "trial", "assess", "hold"]),
        description: z.string().max(500).default(""),
        relevance: z.number().int().min(0).max(100).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db.from("rnd_technologies").insert(data).select().single();
    fail("Could not save technology", error);
    return row;
  });

export const savePipelineItem = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        title: z.string().min(2).max(160),
        description: z.string().max(1000).default(""),
        stage: z.enum(["ideation", "research", "prototype", "testing", "launch", "completed"]),
        priority: z.enum(["low", "medium", "high", "critical"]),
        assignee: z.string().min(2).max(60),
        due_date: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rnd_pipeline_items")
      .insert({ ...data, due_date: data.due_date ?? null })
      .select()
      .single();
    fail("Could not add pipeline item", error);
    return row;
  });

export const movePipelineItem = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(["ideation", "research", "prototype", "testing", "launch", "completed"]),
        progress: z.number().int().min(0).max(100),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("rnd_pipeline_items")
      .update({ stage: data.stage, progress: data.progress, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    fail("Could not move pipeline item", error);
    return { ok: true };
  });

export const saveIdeaEvaluation = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        title: z.string().min(2).max(160),
        description: z.string().max(4000).default(""),
        category: z.string().max(60).default("General"),
        scores: z.record(z.string(), z.number()),
        ai_analysis: z.string().max(20000).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rnd_idea_evaluations")
      .insert(data)
      .select()
      .single();
    fail("Could not save evaluation", error);
    return row;
  });

export const saveChatMessage = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        session_id: z.string().min(1).max(80),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20000),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("rnd_ai_messages").insert(data);
    fail("Could not store message", error);
    return { ok: true };
  });
