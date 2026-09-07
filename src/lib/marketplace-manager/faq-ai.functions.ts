import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * The AI FAQ generator, on retrieved facts rather than remembered ones.
 *
 * The previous generator carried the marketplace's figures hardcoded in its
 * system prompt — the catalogue size, the price, the reseller margins — which
 * meant it would keep asserting them after they stopped being true, and there
 * was no record of where any answer came from. It also referenced an undefined
 * `key` variable, so every click threw a ReferenceError before reaching the
 * model at all.
 *
 * This retrieves the facts from the database first, hands the model only those,
 * and stores the sources on each draft. Section 28's forbidden list is enforced
 * by giving the model the things it may not assert, and by keeping every draft
 * as an unapproved, clearly-flagged draft until a person publishes it.
 */

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(base, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type SystemFact = { key: string; statement: string; source: string };
export type FactSheet = {
  ok: boolean;
  reason?: string;
  facts?: SystemFact[];
  unverifiable?: { key: string; note: string }[];
};

/** The facts an FAQ is allowed to state, counted from the live system. */
export const getFaqFacts = createServerFn({ method: "GET" }).handler(
  async (): Promise<FactSheet> => callAsUser("mm_faq_facts", {}),
);

export const generateFaqDrafts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      topic: z.string().max(300).optional(),
      category_id: z.string().uuid().optional(),
      count: z.number().int().min(1).max(10).optional(),
      language: z.string().max(8).optional(),
      audience: z.string().max(120).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean;
    created?: number;
    error?: string;
    needsConfiguration?: boolean;
    facts?: SystemFact[];
  }> => {
    // Facts first. If the caller is not an operator this refuses here, before
    // anything is generated.
    const sheet = await callAsUser<FactSheet>("mm_faq_facts", {});
    if (!sheet.ok) {
      return { ok: false, error: "This is for marketplace operators." };
    }
    const facts = sheet.facts ?? [];

    const system = [
      "You write FAQ answers for the Software Vala software marketplace.",
      "",
      "You may state ONLY what the facts below say. They were counted from the",
      "live system a moment ago. Do not add figures, prices, discounts, delivery",
      "times, refund terms, guarantees, legal claims, product capabilities or",
      "certifications that are not in this list — not even ones you believe are",
      "true of this company.",
      "",
      "Verified facts:",
      ...facts.map((f) => `- ${f.statement}  [source: ${f.source}]`),
      "",
      "Explicitly NOT verifiable, and therefore forbidden:",
      ...(sheet.unverifiable ?? []).map((u) => `- ${u.key}: ${u.note}`),
      "",
      'If a good answer would need something outside the verified list, write the',
      'answer as exactly "Source information required." and nothing else.',
      "",
      'Return STRICT JSON only: {"items":[{"question":"...","answer":"..."}]}',
      "Answers are one to three sentences, factual, no marketing language.",
    ].join("\n");

    const count = Math.min(Math.max(data.count ?? 5, 1), 10);
    let text: string;
    try {
      const { aiComplete } = await import("@/lib/ai-gateway.server");
      const out = await aiComplete({
        module: "faq",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              `Write ${count} customer FAQs` +
              (data.topic ? ` about: ${data.topic}` : "") +
              (data.audience ? ` for ${data.audience}` : "") +
              ".",
          },
        ],
      });
      text = out.text;
    } catch (error) {
      // The honest failure. No AI credential is configured in this environment,
      // and saying so is more useful than a generic error.
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        needsConfiguration: /credential|not configured|API key/i.test(message),
        error: message,
        facts,
      };
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: "The model did not return usable JSON.", facts };

    let items: { question?: string; answer?: string }[] = [];
    try {
      items = (JSON.parse(match[0]) as { items?: typeof items }).items ?? [];
    } catch {
      return { ok: false, error: "The model's JSON could not be parsed.", facts };
    }

    const sources = facts.map((f) => f.source);
    let created = 0;
    for (const item of items) {
      const question = String(item.question ?? "").trim();
      const answer = String(item.answer ?? "").trim();
      if (!question || !answer) continue;
      const res = await callAsUser<{ ok: boolean }>("mm_faq_save", {
        p_patch: {
          question,
          answer,
          category_id: data.category_id,
          language: data.language ?? "en",
          ai_generated: true,
          ai_sources: sources,
        },
      });
      if (res.ok) created += 1;
    }

    return { ok: true, created, facts };
  });
