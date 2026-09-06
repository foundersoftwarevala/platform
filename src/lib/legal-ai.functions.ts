import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { aiComplete } from "@/lib/ai-gateway.server";
import { buildLegalPrompts, type LegalAIType } from "@/lib/legal-ai.server";

/**
 * Legal AI, routed and recorded.
 *
 * The source calls the Lovable gateway directly on a LOVABLE_API_KEY. Lovable
 * is no longer part of this platform and that variable is not set, so every
 * legal AI feature failed the moment it was used. It now goes through AI API
 * Manager like every other AI call here: one place holds the credential, an
 * operator can change provider or model without a deployment, and the call is
 * metered.
 *
 * Two things this adds that the source has no room for, and on legal work they
 * are the point rather than the polish.
 *
 * Every run is a record (section 27). The request, who asked, the jurisdiction,
 * the provider and model, how long it took and what came back are written to
 * legal_ai_requests before anything reaches a screen. An assessment nobody can
 * trace back to the run that produced it is not evidence of anything.
 *
 * And the output is advisory (sections 23 and 34). Nothing here writes a
 * policy, publishes an agreement, records an acceptance or closes a violation.
 * The result is returned with its request id so a person can act on it and that
 * action can be attributed to them.
 *
 * Section 35 is handled in the prompt: the model is told not to invent statutes,
 * cases, regulations or registration numbers, and to say plainly when it cannot
 * cite an authoritative source. A model can still be wrong - which is exactly
 * why the review status on every request starts as unreviewed.
 */

const admin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

/** The signed-in caller, and whether they may use the legal AI at all. */
async function requireLegalUser(): Promise<{ userId: string }> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const db = await admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized: sign in required");

  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", data.user.id);
  const allowed = new Set([
    "admin", "boss", "founder", "super_admin", "boss_owner",
    "legal", "finance", "employee", "sales_support_manager",
  ]);
  if (!(roles ?? []).some((r) => allowed.has(String(r.role)))) {
    throw new Error("Legal AI is available to legal and operator roles.");
  }
  return { userId: data.user.id };
}

/**
 * Appended to every legal prompt.
 *
 * Section 35 forbids inventing legal authorities. A model asked for a citation
 * will usually produce one whether or not it has one, so it is told what to do
 * when it cannot: say so.
 */
const EVIDENCE_RULE = `
Rules you must follow:
- Never invent statutes, case names, regulation numbers, registration numbers, court decisions or legal authorities.
- Cite a source only if you are confident it exists and is being described accurately. Give the jurisdiction and the section.
- Where you cannot cite an authoritative source, write "SOURCE NOT VERIFIED" against that point rather than producing a citation.
- You are producing an advisory draft for a person to review. Do not state that anything is legally compliant, binding, or approved.
- Say plainly when a question needs a qualified lawyer in the relevant jurisdiction.`;

const inputSchema = z.object({
  type: z.enum([
    "legal_chat", "contract_draft", "compliance_check", "risk_analysis",
    "clause_suggest", "nda_review", "dispute_guide",
  ]),
  prompt: z.string().trim().min(3).max(8000),
  jurisdiction: z.string().trim().max(120).optional(),
  contractType: z.string().trim().max(120).optional(),
  context: z.string().trim().max(4000).optional(),
  inputReference: z.string().trim().max(200).optional(),
});

export const askLegalAI = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { userId } = await requireLegalUser();
    const db = await admin();

    const { systemPrompt, userPrompt } = buildLegalPrompts(data.type as LegalAIType, data.prompt, {
      jurisdiction: data.jurisdiction,
      contractType: data.contractType,
      context: data.context,
    });

    // The run is recorded before it starts, so a request that fails or times
    // out still leaves a trace rather than disappearing.
    const { data: request } = await db
      .from("legal_ai_requests")
      .insert({
        ai_type: data.type,
        requested_by: userId,
        jurisdiction: data.jurisdiction ?? null,
        input_reference: data.inputReference ?? null,
        status: "running",
      })
      .select("id")
      .single();
    const requestId = request?.id as string | undefined;

    const started = Date.now();
    try {
      const { text, model, service } = await aiComplete({
        module: "legal-manager",
        maxTokens: 2000,
        messages: [
          { role: "system", content: systemPrompt + "\n" + EVIDENCE_RULE },
          { role: "user", content: userPrompt },
        ],
      });

      if (requestId) {
        await db
          .from("legal_ai_requests")
          .update({
            status: "completed",
            provider: service,
            model,
            output: text,
            latency_ms: Date.now() - started,
            completed_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        ok: true as const,
        requestId,
        text,
        model,
        service,
        // Said in the response as well as the prompt, so a screen cannot
        // present this as a finding.
        advisory: true as const,
        notice:
          "This is an AI draft for human review. It is not legal advice and nothing here is approved or binding until a person reviews and approves it.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The legal AI request failed.";
      if (requestId) {
        await db
          .from("legal_ai_requests")
          .update({
            status: "failed",
            error: message,
            latency_ms: Date.now() - started,
            completed_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }
      throw new Error(message);
    }
  });

/** Record a person's decision on an AI run (sections 23, 34). */
export const reviewLegalAI = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      requestId: z.string().uuid(),
      decision: z.enum(["accepted", "rejected", "superseded"]),
      note: z.string().trim().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireLegalUser();
    const db = await admin();

    const { error } = await db
      .from("legal_ai_requests")
      .update({
        review_status: data.decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) return { ok: false as const, reason: error.message };

    await db.rpc("legal_log", {
      p_action: "AI Output Reviewed",
      p_entity_type: "legal_ai_request",
      p_entity_id: data.requestId,
      p_new: { review_status: data.decision },
      p_reason: data.note ?? null,
    });

    return { ok: true as const, decision: data.decision };
  });
