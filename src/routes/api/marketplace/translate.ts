import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { executeAiRequest } from "@/lib/ai-api.functions";

/**
 * Translate catalogue text.
 *
 * The marketplace is read from sixty countries but every product name, category
 * name and description is written once, in English. This turns a batch of that
 * text into another language and hands it back.
 *
 * It does not hold a provider, a model or a key of its own. Every call goes
 * through AI API Manager, which is where the provider, the model, the
 * credential and the usage metering live - a second AI client here would mean a
 * second place to configure, a second place to pay for and a second place to
 * leak from. If nothing is configured there, this says so plainly and
 * translates nothing; it never invents a translation.
 *
 * What comes back is stored by the digest of the source text, so the same
 * sentence on twenty products is translated once and read from the database
 * ever after.
 */

const MAX_ITEMS = 40;
const MAX_CHARS = 6000;

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** Translations already held for these texts. */
async function cached(hashes: string[], locale: string) {
  const held = new Map<string, string>();
  if (!url() || hashes.length === 0) return held;
  try {
    const list = hashes.map((h) => `"${h}"`).join(",");
    const response = await fetch(
      `${url()}/rest/v1/marketplace_translations?select=source_hash,translated_text` +
        `&locale=eq.${encodeURIComponent(locale)}&source_hash=in.(${encodeURIComponent(list)})`,
      { headers: admin() },
    );
    if (!response.ok) return held;
    const rows = (await response.json()) as { source_hash: string; translated_text: string }[];
    for (const row of rows) held.set(row.source_hash, row.translated_text);
  } catch (error) {
    console.error("[translate] cache read failed", error);
  }
  return held;
}

async function store(
  rows: { source_hash: string; locale: string; source_text: string; translated_text: string;
    provider: string | null; model: string | null }[],
) {
  if (!url() || rows.length === 0) return;
  try {
    await fetch(
      `${url()}/rest/v1/marketplace_translations?on_conflict=source_hash,locale`,
      {
        method: "POST",
        headers: { ...admin(), "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      },
    );
  } catch (error) {
    console.error("[translate] store failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/translate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { texts?: unknown; locale?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const locale = String(body.locale ?? "").trim().slice(0, 16);
        const texts = Array.isArray(body.texts)
          ? body.texts.map((t) => String(t ?? "").trim()).filter(Boolean).slice(0, MAX_ITEMS)
          : [];

        if (!locale) return Response.json({ error: "Which language?" }, { status: 400 });
        if (texts.length === 0) return Response.json({ translations: {} });
        if (texts.join("").length > MAX_CHARS) {
          return Response.json({ error: "Too much text in one request." }, { status: 413 });
        }

        const hashes = texts.map(digest);
        const held = await cached(hashes, locale);

        const missing: string[] = [];
        for (let i = 0; i < texts.length; i++) {
          if (!held.has(hashes[i]!)) missing.push(texts[i]!);
        }

        // Everything already known: no model call at all.
        if (missing.length === 0) {
          const translations: Record<string, string> = {};
          texts.forEach((text, i) => {
            translations[text] = held.get(hashes[i]!) ?? text;
          });
          return Response.json({ translations, locale, translated: 0, fromCache: texts.length });
        }

        let answer: { text: string; provider?: string | null; model?: string | null };
        try {
          answer = await executeAiRequest({
            module: "marketplace-translation",
            system:
              "You translate short product and category names and one-line product " +
              "descriptions for a software marketplace. Return only a JSON array of " +
              "strings, the same length and order as the input. Keep product names " +
              "recognisable, do not add words, do not explain.",
            prompt:
              `Translate each item into ${locale}. Reply with a JSON array only.\n` +
              JSON.stringify(missing),
          });
        } catch (error) {
          // AI API Manager has no active provider or no real credential. Say so;
          // never fall back to inventing a translation or echoing the English
          // back as if it were one.
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Translation is not available until a provider is configured in AI API Manager.",
              reason: "ai_not_configured",
            },
            { status: 503 },
          );
        }

        let produced: string[] = [];
        try {
          const cleaned = answer.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
          const parsed = JSON.parse(cleaned) as unknown;
          if (Array.isArray(parsed)) produced = parsed.map((v) => String(v ?? ""));
        } catch {
          produced = [];
        }
        if (produced.length !== missing.length) {
          return Response.json(
            { error: "The provider did not return a usable translation.", reason: "bad_response" },
            { status: 502 },
          );
        }

        await store(
          missing.map((source, i) => ({
            source_hash: digest(source),
            locale,
            source_text: source,
            translated_text: produced[i]!,
            provider: answer.provider ?? null,
            model: answer.model ?? null,
          })),
        );

        const freshly = new Map(missing.map((source, i) => [digest(source), produced[i]!]));
        const translations: Record<string, string> = {};
        texts.forEach((text, i) => {
          const key = hashes[i]!;
          translations[text] = held.get(key) ?? freshly.get(key) ?? text;
        });

        return Response.json({
          translations,
          locale,
          translated: missing.length,
          fromCache: texts.length - missing.length,
          provider: answer.provider ?? null,
          model: answer.model ?? null,
        });
      },
    },
  },
});
