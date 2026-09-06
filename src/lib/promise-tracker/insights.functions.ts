import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { aiComplete } from "@/lib/ai-gateway.server";

/**
 * Where AI Insights come from.
 *
 * The source ships six insight rows describing invented risk for invented
 * promises, and nothing that could ever produce a seventh. The screen therefore
 * looked complete while being a fixed list, and once the fabricated promises
 * were left out it had nothing at all to show.
 *
 * This generates them from the real register: open promises, how close their
 * deadlines are, how far they have already slipped, what escalation they have
 * attracted and what has been fined against them. The model is asked to score
 * and advise; it is never asked to decide anything, and nothing it returns
 * changes a promise. Applying a suggestion remains a separate, authorised,
 * audited step.
 *
 * Two safeguards worth naming. Scores are clamped to 0-100 here rather than
 * trusted, because a model that returns 780 would otherwise paint every board
 * red. And a promise already carrying an open insight is skipped, so running
 * this twice does not bury the screen in duplicates.
 */

const admin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

/** The signed-in caller, and whether they may run this at all. */
async function requireOperator(): Promise<{ userId: string }> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const db = await admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized: sign in required");

  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", data.user.id);
  const allowed = new Set([
    "admin", "boss", "founder", "super_admin", "boss_owner",
    "employee", "sales", "support", "finance", "sales_support_manager",
  ]);
  if (!(roles ?? []).some((r) => allowed.has(String(r.role)))) {
    throw new Error("Generating insights needs manager or operator rights.");
  }
  return { userId: data.user.id };
}

const SYSTEM =
  "You assess delivery risk on business commitments for an operations console. " +
  "For each promise you are given, judge how likely it is to be missed and what " +
  "the team should do next. Be concrete and brief. Reply with JSON only, no prose " +
  "and no code fence.";

const shape = z.object({
  insights: z
    .array(
      z.object({
        code: z.string(),
        delay_risk: z.coerce.number(),
        miss_probability: z.coerce.number(),
        suggested_action: z.string().min(3).max(400),
        escalation_advice: z.string().min(3).max(400),
        reason: z.string().max(600).optional().default(""),
      }),
    )
    .default([]),
});

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

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

export const generatePromiseInsights = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(25).default(10) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireOperator();
    const db = await admin();

    // Only work that is still in play, and only promises that do not already
    // have an insight waiting to be acted on.
    const { data: open, error } = await db
      .from("promises")
      .select(
        "id, code, title, description, status, priority, deadline, delay_days, " +
          "escalation_level, fine_amount, owner, receiver, sub_category",
      )
      .in("status", ["pending", "active", "due_soon", "delayed", "broken"])
      .order("deadline", { ascending: true })
      .limit(60);
    if (error) throw new Error(error.message);

    const { data: existing } = await db
      .from("promise_ai_insights")
      .select("promise_id")
      .eq("state", "open");
    const busy = new Set((existing ?? []).map((r) => String(r.promise_id)));

    const candidates = (open ?? []).filter((p) => !busy.has(String(p.id))).slice(0, data.limit);
    if (candidates.length === 0) {
      return {
        ok: true as const,
        generated: 0,
        message: "Every open promise already has an insight waiting.",
      };
    }

    const now = Date.now();
    const brief = candidates.map((p) => ({
      code: p.code,
      title: p.title,
      status: p.status,
      priority: p.priority,
      hours_to_deadline: Math.round((new Date(p.deadline).getTime() - now) / 3_600_000),
      days_already_late: p.delay_days,
      escalation_level: p.escalation_level,
      fined_so_far: Number(p.fine_amount ?? 0),
      category: p.sub_category,
    }));

    const { text, model, service } = await aiComplete({
      module: "promise-tracker",
      json: true,
      maxTokens: 1800,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            "Assess these commitments. A negative hours_to_deadline means the deadline " +
            "has already passed.\n\n" +
            JSON.stringify(brief, null, 2) +
            '\n\nReturn {"insights":[{"code","delay_risk","miss_probability",' +
            '"suggested_action","escalation_advice","reason"}]}. ' +
            "delay_risk and miss_probability are integers from 0 to 100.",
        },
      ],
    });

    const parsed = shape.safeParse(extractJson(text));
    if (!parsed.success) throw new Error("The AI returned an unexpected response shape.");

    const byCode = new Map(candidates.map((p) => [String(p.code), String(p.id)]));
    const rows = parsed.data.insights
      .filter((i) => byCode.has(i.code))
      .map((i) => ({
        promise_id: byCode.get(i.code)!,
        delay_risk: clamp(i.delay_risk),
        miss_probability: clamp(i.miss_probability),
        suggested_action: i.suggested_action,
        escalation_advice: i.escalation_advice,
        reason: i.reason || null,
        state: "open",
      }));

    if (rows.length === 0) {
      return { ok: true as const, generated: 0, message: "The model returned nothing usable." };
    }

    const { error: writeError } = await db.from("promise_ai_insights").insert(rows);
    if (writeError) throw new Error(writeError.message);

    // Generating advice is itself an event worth recording (section 22).
    await db.rpc("pt_audit", {
      p_action: "AI Insights Generated",
      p_promise_id: null,
      p_details: `${rows.length} insight(s) from ${service}${model ? ` (${model})` : ""}`,
      p_old: null,
      p_new: String(rows.length),
    });

    return {
      ok: true as const,
      generated: rows.length,
      model,
      service,
      requestedBy: userId,
    };
  });
