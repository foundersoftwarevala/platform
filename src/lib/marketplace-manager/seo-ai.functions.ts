import { createServerFn } from "@tanstack/react-start";
import { aiComplete } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { operatorRefusal } from "@/lib/auth/operator-check";

type SeoInput = {
  topic: string;
  type?: "homepage" | "category" | "product" | "collection";
  locale?: string;
};

type SeoOutput = {
  title: string;
  description: string;
  h1: string;
  keywords: string[];
  hashtags: string[];
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  canonical: string;
  schema: string;
};

function fallback(input: SeoInput): SeoOutput {
  const t = input.topic.trim() || "Software Vala Marketplace";
  const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const baseDesc = `${t} — discover, compare and buy verified business software on Software Vala. Trusted vendors, instant delivery, global support.`;
  return {
    title: `${t} | Software Vala Marketplace`.slice(0, 60),
    description: baseDesc.slice(0, 158),
    h1: t,
    keywords: [t.toLowerCase(), "software", "marketplace", "saas", "business tools"],
    hashtags: [`#${slug}`, "#SoftwareVala", "#Marketplace", "#SaaS", "#BusinessSoftware"],
    ogTitle: `${t} on Software Vala`,
    ogDescription: baseDesc.slice(0, 158),
    twitterTitle: `${t} | Software Vala`,
    twitterDescription: baseDesc.slice(0, 158),
    canonical: `/${slug}`,
    schema: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": input.type === "product" ? "Product" : "WebPage",
        name: t,
        description: baseDesc,
      },
      null,
      2,
    ),
  };
}

export const generateSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as SeoInput)
  .handler(async ({ data, context }): Promise<SeoOutput> => {
    // The guard here read an undeclared `key`, so Generate threw on every call.
    // An operator is checked instead; with no AI provider configured the
    // gateway throws and the catch below returns the template result.
    const refusal = await operatorRefusal(context);
    if (refusal) throw new Error(refusal);
    if (typeof data?.topic !== "string") return fallback({ topic: "" });

    const sys = `You are an SEO specialist for a global software marketplace.
Return STRICT JSON only, no markdown. Schema:
{"title":string<=60,"description":string<=158,"h1":string,"keywords":string[5-10],"hashtags":string[6-10 starting with #],"ogTitle":string,"ogDescription":string,"twitterTitle":string,"twitterDescription":string,"canonical":string starting with /,"schema":object (schema.org JSON-LD)}`;

    const user = `Generate worldwide-optimized SEO for: "${data.topic}"
Page type: ${data.type ?? "homepage"} | Locale: ${data.locale ?? "global/en"}
Brand: Software Vala Marketplace.`;

    try {
      const __ai = await aiComplete({
      module: "marketplace-seo",
      messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
      json: true,
    });
    // Shaped like the gateway reply the surrounding code already parses.
    const res = {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: __ai.text } }] }),
      text: async () => __ai.text,
    };
      if (!res.ok) return fallback(data);
      const json = await res.json();
      const txt = json?.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(txt);
      if (parsed && typeof parsed.schema === "object") {
        parsed.schema = JSON.stringify(parsed.schema, null, 2);
      }
      return { ...fallback(data), ...parsed };
    } catch {
      return fallback(data);
    }
  });
