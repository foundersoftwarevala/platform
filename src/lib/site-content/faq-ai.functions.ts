import { createServerFn } from "@tanstack/react-start";

type GenInput = { topic?: string; count?: number; category?: string };
type GenOutput = {
  items: Array<{ question: string; answer: string; category: string }>;
  error?: string;
};

const SYSTEM = `You write FAQs for the Software Vala software marketplace.
Hard facts you MUST respect and never contradict:
- 12,000+ ready-to-deploy software solutions across 80+ master categories.
- ONE fixed price for every product: $249 one-time, lifetime access. No tiers, no renewals, no advance payment, no hidden charges.
- Every product includes full source code, white label rights, SaaS/multi-tenant ready builds, live demo before purchase, 2-hour (120 min) delivery and 1 year free support.
- Partner tracks: reseller (up to 40% margin), vendor/author publishing, franchise territory rights, affiliate.
Return STRICT JSON only: {"items":[{"question":"...","answer":"...","category":"..."}]}
Answers must be 1-3 sentences, factual, no marketing fluff, no invented metrics.`;

export const generateFaqs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => (d ?? {}) as GenInput)
  .handler(async ({ data }): Promise<GenOutput> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { items: [], error: "AI is not configured yet." };
    const count = Math.min(Math.max(data.count ?? 6, 1), 12);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `Generate ${count} new customer FAQs${
                data.category ? ` for the category "${data.category}"` : ""
              }${data.topic ? ` about: ${data.topic}` : ""}.`,
            },
          ],
        }),
      });
      if (res.status === 429) return { items: [], error: "Rate limit reached. Try again shortly." };
      if (res.status === 402) return { items: [], error: "AI credits exhausted." };
      if (!res.ok) return { items: [], error: `AI gateway error (${res.status}).` };
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { items: [], error: "AI returned an unexpected format." };
      const parsed = JSON.parse(match[0]) as GenOutput;
      const items = (parsed.items ?? [])
        .filter((i) => i && i.question && i.answer)
        .map((i) => ({
          question: String(i.question),
          answer: String(i.answer),
          category: String(i.category || data.category || "General"),
        }));
      return { items };
    } catch (e) {
      return { items: [], error: e instanceof Error ? e.message : "Network error." };
    }
  });