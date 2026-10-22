import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireJsonObject, type Json } from "@/lib/json";
import { aiComplete } from "@/lib/ai-gateway.server";

import { deleteRecord, insertRecord, updateRecord } from "./manager-data.functions";
import { generateSeo } from "./seo-ai.functions";
export { deleteRecord, insertRecord, updateRecord };

const aiSchema = z.object({
  task: z.enum(["suggestions", "content", "meta", "reel", "assistant"]).default("assistant"),
  // Bounded: every character goes to a paid AI gateway.
  prompt: z.string().min(1).max(4000),
  persist: z.boolean().optional(),
  context: z.string().max(8000).optional(),
});

/**
 * Every function below writes or runs work with the service role, which reads
 * and writes past every policy. They had no check of their own, so any caller -
 * a customer, or nobody signed in - could start a catalogue audit, insert
 * reports or rewrite crawl state. The SEO console's people are the operators
 * plus the seo and marketing staff the route gate admits.
 */
async function seoOperator(action: string) {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  return requireOperator(action, { alsoAllow: ["seo", "marketing"] });
}

export type SeoAiManagerService = {
  id: string;
  name: string;
  category: string;
  status: string;
  approvalStatus: string;
  pricingTier: string;
};

export const listSeoAiManagerServices = createServerFn({ method: "GET" }).handler(
  async (): Promise<SeoAiManagerService[]> => {
    await seoOperator("Reading AI API Manager services for SEO");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("api_services")
      .select("id, name, category, status, approval_status, pricing_tier")
      .in("category", ["ai", "llm"])
      .order("name")
      .limit(200);
    if (error) throw new Error(`AI API Manager services could not be read: ${error.message}`);
    return (data ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      status: service.status,
      approvalStatus: service.approval_status,
      pricingTier: service.pricing_tier,
    }));
  },
);

const automationSchema = z.object({ id: z.string().min(1) });
const recrawlSchema = z.object({ id: z.string().min(1) });
const searchConsoleSchema = z.object({
  siteUrl: z.string().trim().min(1).max(2048),
  days: z.number().int().min(1).max(365).default(30),
});
const semrushSchema = z.object({
  domain: z.string().min(1),
  database: z.string().min(1).default("us"),
});
const aiContentSchema = z.object({
  topic: z.string().trim().min(2).max(1000),
  targetKeyword: z.string().trim().max(200).optional(),
  locale: z.string().trim().min(2).max(40).default("en"),
});
const aiKeywordsSchema = z.object({
  topic: z.string().trim().min(2).max(500),
  locale: z.string().trim().min(2).max(40).default("en"),
  count: z.number().int().min(1).max(20).default(10),
});

const seoContentDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  targetKeyword: z.string().trim().min(1).max(200),
  body: z
    .string()
    .trim()
    .min(100)
    .max(30000)
    .refine(
      (body) => wordCount(body) >= 500,
      "The generated draft must contain at least 500 words.",
    ),
});
const seoKeywordIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        keyword: z.string().trim().min(2).max(200),
        rationale: z.string().trim().min(1).max(1000),
        impact: z.enum(["low", "medium", "high"]),
        confidence: z.number().int().min(0).max(100),
      }),
    )
    .min(1)
    .max(20),
});

function parseAiJson<T>(text: string, schema: z.ZodType<T>, label: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`The AI provider returned invalid JSON for ${label}. Please retry.`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`The AI provider returned an invalid ${label} response. Please retry.`);
  }
  return result.data;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

async function getGoogleSearchConsoleAccessToken(): Promise<string> {
  const configured = process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS?.trim();
  if (!configured) {
    throw new Error(
      "Google Search Console is not configured. Set GOOGLE_SEARCH_CONSOLE_CREDENTIALS on the server to a JSON object containing client_id, client_secret, and refresh_token.",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(configured);
  } catch {
    throw new Error("GOOGLE_SEARCH_CONSOLE_CREDENTIALS must contain valid JSON.");
  }
  const credentials = z
    .object({
      client_id: z.string().min(1),
      client_secret: z.string().min(1),
      refresh_token: z.string().min(1),
    })
    .safeParse(raw);
  if (!credentials.success) {
    throw new Error(
      "GOOGLE_SEARCH_CONSOLE_CREDENTIALS must include client_id, client_secret, and refresh_token.",
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.data.client_id,
      client_secret: credentials.data.client_secret,
      refresh_token: credentials.data.refresh_token,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = z
    .object({
      access_token: z.string().min(1).optional(),
      error_description: z.string().optional(),
      error: z.string().optional(),
    })
    .safeParse(await response.json().catch(() => null));
  if (!response.ok || !result.success || !result.data.access_token) {
    const reason = result.success
      ? (result.data.error_description ?? result.data.error)
      : undefined;
    throw new Error(
      `Google OAuth token refresh failed${reason ? `: ${reason}` : ` (HTTP ${response.status})`}.`,
    );
  }
  return result.data.access_token;
}

function normalizeSearchConsoleSite(value: string): string {
  const site = value.trim();
  if (/^sc-domain:[a-z0-9.-]+$/i.test(site)) return site;
  let url: URL;
  try {
    url = new URL(site);
  } catch {
    throw new Error("Enter a verified Search Console property URL or sc-domain:example.com.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Search Console property must be an HTTP(S) URL without credentials.");
  }
  return url.href;
}

export const generateWithAi = createServerFn({ method: "POST" })
  .inputValidator((value) => aiSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Generating SEO suggestions");
    const generated = await generateSeo({
      data: {
        topic: data.prompt,
        type: "homepage",
        locale: data.context ?? "global/en",
      },
    });

    const suggestion = {
      task: data.task,
      title: generated.title,
      description: generated.description,
      h1: generated.h1,
      keywords: generated.keywords,
      hashtags: generated.hashtags,
      ogTitle: generated.ogTitle,
      ogDescription: generated.ogDescription,
      twitterTitle: generated.twitterTitle,
      twitterDescription: generated.twitterDescription,
      canonical: generated.canonical,
      schema: generated.schema,
      context: data.context ?? null,
      generatedAt: new Date().toISOString(),
      // Whether a model wrote this or the built-in template did, and why. It
      // travels with the suggestion so the screen showing it, and the row
      // stored below, both say which they are.
      source: generated.source,
      reason: generated.reason,
    };

    // This insert could never have succeeded. `seo_ai_suggestions` requires a
    // `title` and has no `task` column, so every write was rejected, swallowed
    // by the empty catch below it, and then reported back as `persisted: true`.
    // It now writes the columns the table actually has, and says whether the
    // row landed instead of assuming it did.
    let persisted = false;
    let persistError: string | null = null;
    if (data.persist) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("seo_ai_suggestions").insert({
          title: suggestion.title || data.prompt.slice(0, 120),
          suggestion: JSON.stringify(suggestion),
          target_type: "page",
          target_ref: data.context ?? null,
          status: "pending",
        });
        if (error) persistError = error.message;
        else persisted = true;
      } catch (problem) {
        // A generation that cannot be stored is still a useful generation, so
        // this does not fail the call — but the reason travels back with it.
        persistError = problem instanceof Error ? problem.message : "could not be stored";
      }
    }

    return {
      ok: true,
      task: data.task,
      suggestion,
      persisted,
      persistError,
      generatedAt: suggestion.generatedAt,
    };
  });

export const generateSeoContentDraft = createServerFn({ method: "POST" })
  .inputValidator((value) => aiContentSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Generating SEO content");
    const generated = await aiComplete({
      module: "seo-content-writer",
      maxTokens: 3000,
      json: true,
      messages: [
        {
          role: "system",
          content:
            "Write an original, useful SEO article draft for a global business software marketplace. " +
            "Return only JSON with title, targetKeyword, and body. The body must be at least 500 words, " +
            "use Markdown headings, avoid fabricated statistics, citations, product claims, and guarantees. " +
            "Do not claim the article has been fact-checked or published.",
        },
        {
          role: "user",
          content: [
            `Topic: ${data.topic}`,
            `Target keyword: ${data.targetKeyword || "choose the best natural primary keyword"}`,
            `Language/locale: ${data.locale}`,
          ].join("\n"),
        },
      ],
    });
    const draft = parseAiJson(generated.text, seoContentDraftSchema, "article draft");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error } = await supabaseAdmin
      .from("seo_content_items")
      .insert({
        title: draft.title,
        content_type: "blog",
        target_keyword: draft.targetKeyword,
        body: draft.body,
        word_count: wordCount(draft.body),
        status: "draft",
        model: generated.model ?? generated.service,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Generated draft could not be saved: ${error.message}`);
    if (!saved) throw new Error("Generated draft was not saved.");

    return {
      id: saved.id,
      title: draft.title,
      targetKeyword: draft.targetKeyword,
      body: draft.body,
      wordCount: wordCount(draft.body),
      model: generated.model ?? generated.service,
      status: "draft" as const,
    };
  });

export const generateSeoKeywordIdeas = createServerFn({ method: "POST" })
  .inputValidator((value) => aiKeywordsSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Generating SEO keyword ideas");
    const generated = await aiComplete({
      module: "seo-keyword-research",
      maxTokens: 1800,
      json: true,
      messages: [
        {
          role: "system",
          content:
            "Produce distinct, natural search keyword ideas for a business software marketplace. " +
            "Return only JSON: {ideas:[{keyword,rationale,impact,confidence}]}. " +
            "Use impact low|medium|high and an integer confidence 0-100 as an AI estimate, not measured search volume. " +
            "Never invent search volume, CPC, ranking, or difficulty data.",
        },
        {
          role: "user",
          content: `Generate at most ${data.count} keyword ideas for: ${data.topic}\nLanguage/locale: ${data.locale}`,
        },
      ],
    });
    const result = parseAiJson(generated.text, seoKeywordIdeasSchema, "keyword ideas");
    const ideas = result.ideas.slice(0, data.count);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error } = await supabaseAdmin
      .from("seo_ai_suggestions")
      .insert(
        ideas.map((idea) => ({
          title: idea.keyword,
          suggestion: idea.rationale,
          target_type: "keyword",
          target_ref: data.topic,
          impact: idea.impact,
          confidence: idea.confidence,
          status: "pending",
          model: generated.model ?? generated.service,
        })),
      )
      .select("id");
    if (error) throw new Error(`Keyword ideas could not be saved: ${error.message}`);
    if (!saved || saved.length !== ideas.length) {
      throw new Error("Not all generated keyword ideas were saved.");
    }

    return {
      ideas: ideas.map((idea, index) => ({ ...idea, id: saved[index].id })),
      model: generated.model ?? generated.service,
    };
  });

export const runAutomation = createServerFn({ method: "POST" })
  .inputValidator((value) => automationSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Running an SEO automation");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: automation, error: automationError } = await supabaseAdmin
      .from("seo_automations")
      .select("id,name")
      .eq("id", data.id)
      .maybeSingle();

    if (automationError) throw new Error(automationError.message);
    if (!automation) throw new Error("Automation not found");

    // This used to insert a run marked "completed", one item processed, with
    // no work done at all - a fabricated success in the run history. There is
    // no executor for seo_automations yet, so it says so instead.
    throw new Error(
      `"${automation.name}" has no executor yet, so nothing was run and no run was recorded.`,
    );
  });

/**
 * Run the catalogue audit and record it.
 *
 * This used to write `score: 94` with `pages_crawled: 0`, `issues_found: 0`
 * and a breakdown of seven invented percentages — a fabricated grade, into the
 * same `seo_audits` table that the real audit at
 * `POST /api/internal/seo-audit` writes to, indistinguishable from it once
 * stored. It now runs that same real audit: the counts are counts of rows in
 * the live catalogue, and the score is those counts weighted by severity.
 */
export const runSiteAudit = createServerFn({ method: "POST" }).handler(async () => {
  await seoOperator("Running the catalogue audit");
  const { runCatalogueAudit } = await import("@/lib/seo/catalogue-audit.server");
  const startedAt = new Date().toISOString();
  const result = await runCatalogueAudit();

  return {
    ok: true as const,
    score: result.score,
    pagesCrawled: result.pagesCrawled,
    issuesFound: result.issuesFound,
    message: `Audit complete — ${result.pagesCrawled} indexable page(s), ${result.issuesFound} issue(s)`,
    startedAt,
  };
});

export const runTechnicalChecks = createServerFn({ method: "POST" }).handler(async () => {
  await seoOperator("Running technical checks");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const counts = await supabaseAdmin
    .from("seo_technical_checks")
    .select("id", { count: "exact", head: true });
  if (counts.error) throw new Error(counts.error.message);
  const recorded = counts.count ?? 0;

  // Nothing is executed here: this counts the checks already recorded. It used
  // to say "N live technical checks completed" over a capped page of rows.
  return {
    ok: true,
    checked: recorded,
    message: `${recorded} technical check record(s) on file; this does not run new checks`,
  };
});

/**
 * Generate the monthly SEO report.
 *
 * The message this returns — "generated from live records" — used to sit on
 * top of a summary of eight hardcoded constants: clicks 0, impressions 0,
 * conversions 0, tracked_keywords 0, open_issues 0, and so on. Nothing was
 * read. The figures now come from `seo_report_summary`, which counts them in
 * SQL over `seo_keyword_rankings` and `seo_issues`, because a report is an
 * aggregate and an aggregate computed from a fetched page of rows is wrong as
 * soon as the table outgrows the page.
 */
export const generateSeoReport = createServerFn({ method: "POST" }).handler(async () => {
  await seoOperator("Generating the SEO report");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const date = new Date().toISOString();
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const periodEnd = date.slice(0, 10);

  // This RPC is absent from cloud types; narrow its actual JSON wire contract.
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    fn: "seo_report_summary",
    args: { p_period_start: string; p_period_end: string },
  ) => Promise<{ data: Json; error: { message: string } | null }>;
  const { data: summary, error: summaryError } = await rpc("seo_report_summary", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (summaryError) throw new Error(summaryError.message);

  const figures = requireJsonObject(summary ?? {}, "SEO report summary");
  const { error } = await supabaseAdmin.from("seo_reports").insert({
    name: `Monthly SEO report · ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    report_type: "monthly",
    status: "ready",
    period_start: periodStart,
    period_end: periodEnd,
    generated_at: date,
    summary,
  });

  if (error) throw new Error(error.message);

  // A period with no ranking rows in it is said out loud, so nobody reads a
  // measured zero into a month that was never measured.
  const rows = Number(figures.ranking_rows ?? 0);
  const message = rows
    ? `SEO report generated — ${figures.clicks} click(s), ${figures.impressions} impression(s), ${figures.open_issues} open issue(s)`
    : `SEO report generated — no ranking data recorded between ${periodStart} and ${periodEnd}; ${figures.open_issues} open issue(s)`;

  return { ok: true, message, generatedAt: date, summary: figures };
});

export const recrawlUrl = createServerFn({ method: "POST" })
  .inputValidator((value) => recrawlSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Re-crawling a URL");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: record, error } = await supabaseAdmin
      .from("seo_indexing_records")
      .select("id,url")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!record) throw new Error("Indexing record not found");

    // A real request. This used to decide the status from whether the URL
    // string contained "softwarevala.com" and record that as a crawl. Only the
    // site's own pages are fetched, so a record cannot point the server at
    // somewhere else.
    const { siteUrl } = await import("@/lib/seo/site-url");
    const site = siteUrl();
    let target: URL;
    try {
      target = new URL(String(record.url ?? ""), site);
    } catch {
      throw new Error("That indexing record does not hold a valid URL.");
    }
    if (target.origin !== new URL(site).origin) {
      throw new Error(`Only ${new URL(site).host} pages are re-crawled from here.`);
    }
    let status = 0;
    try {
      const response = await fetch(target, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      status = response.status;
    } catch {
      status = 0;
    }

    const { error: writeError } = await supabaseAdmin
      .from("seo_indexing_records")
      .update({
        crawl_status: status === 200 ? "crawled" : "error",
        index_state: status === 200 ? "eligible" : "excluded",
        http_status: status,
        last_crawled_at: new Date().toISOString(),
        notes:
          status === 200
            ? "Live URL check completed."
            : status === 0
              ? "The URL did not answer within 15 seconds."
              : `Live URL returned HTTP ${status}.`,
      })
      .eq("id", data.id);
    if (writeError) throw new Error(writeError.message);

    return { ok: true, httpStatus: status, status: status === 200 ? "crawled" : "error" };
  });

export const syncSearchConsole = createServerFn({ method: "POST" })
  .inputValidator((value) => searchConsoleSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Syncing Search Console");
    const siteUrl = normalizeSearchConsoleSite(data.siteUrl);
    const accessToken = await getGoogleSearchConsoleAccessToken();
    const periodEnd = new Date().toISOString().slice(0, 10);
    const periodStart = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const endpoint =
      `https://searchconsole.googleapis.com/webmasters/v3/sites/` +
      `${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: periodStart,
        endDate: periodEnd,
        dimensions: ["date", "query"],
        rowLimit: 25000,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(
        `Google Search Console returned HTTP ${response.status}${detail ? `: ${detail}` : ""}.`,
      );
    }
    const payload = z
      .object({
        rows: z
          .array(
            z.object({
              keys: z.array(z.string()).length(2),
              clicks: z.number().finite().nonnegative(),
              impressions: z.number().finite().nonnegative(),
              ctr: z.number().finite().nonnegative(),
              position: z.number().finite().nonnegative(),
            }),
          )
          .optional(),
      })
      .safeParse(await response.json().catch(() => null));
    if (!payload.success) {
      throw new Error("Google Search Console returned an unexpected analytics response.");
    }

    const rows = payload.data.rows ?? [];
    const totals = new Map<
      string,
      {
        keyword: string;
        recordedOn: string;
        clicks: number;
        impressions: number;
        positionWeight: number;
      }
    >();
    for (const row of rows) {
      const [recordedOn, keyword] = row.keys;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(recordedOn) || !keyword.trim()) {
        throw new Error("Google Search Console returned an invalid date or query.");
      }
      const key = `${recordedOn}\u0000${keyword}`;
      const total = totals.get(key) ?? {
        keyword,
        recordedOn,
        clicks: 0,
        impressions: 0,
        positionWeight: 0,
      };
      total.clicks += row.clicks;
      total.impressions += row.impressions;
      total.positionWeight += row.position * row.impressions;
      totals.set(key, total);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rankings: Array<{
      keyword_id: string;
      recorded_on: string;
      clicks: number;
      impressions: number;
      position: number;
    }> = [];
    const uniqueKeywords = [...new Set([...totals.values()].map((row) => row.keyword))];
    type SearchConsoleTotal = {
      keyword: string;
      recordedOn: string;
      clicks: number;
      impressions: number;
      positionWeight: number;
    };
    const totalsByKeyword = new Map<string, SearchConsoleTotal[]>();
    for (const total of totals.values()) {
      const grouped = totalsByKeyword.get(total.keyword);
      if (grouped) grouped.push(total);
      else totalsByKeyword.set(total.keyword, [total]);
    }
    for (let offset = 0; offset < uniqueKeywords.length; offset += 200) {
      const keywordBatch = uniqueKeywords.slice(offset, offset + 200);
      const { error: keywordWriteError } = await supabaseAdmin.from("seo_keywords").upsert(
        keywordBatch.map((keyword) => ({
          keyword,
          country: "global",
          region: "global",
          status: "tracking",
        })),
        { onConflict: "keyword,country", ignoreDuplicates: true },
      );
      if (keywordWriteError) throw new Error(keywordWriteError.message);

      const { data: keywordRows, error: keywordReadError } = await supabaseAdmin
        .from("seo_keywords")
        .select("id,keyword")
        .eq("country", "global")
        .in("keyword", keywordBatch);
      if (keywordReadError) throw new Error(keywordReadError.message);
      const idByKeyword = new Map((keywordRows ?? []).map((row) => [row.keyword, row.id]));
      for (const keyword of keywordBatch) {
        const keywordId = idByKeyword.get(keyword);
        if (!keywordId) throw new Error(`Could not resolve the SEO keyword "${keyword}".`);
        for (const total of totalsByKeyword.get(keyword) ?? []) {
          rankings.push({
            keyword_id: keywordId,
            recorded_on: total.recordedOn,
            clicks: Math.round(total.clicks),
            impressions: Math.round(total.impressions),
            position:
              total.impressions > 0 ? Math.round(total.positionWeight / total.impressions) : 0,
          });
        }
      }
    }

    for (let offset = 0; offset < rankings.length; offset += 500) {
      const { error: rankingWriteError } = await supabaseAdmin
        .from("seo_keyword_rankings")
        .upsert(rankings.slice(offset, offset + 500), {
          onConflict: "keyword_id,recorded_on",
        });
      if (rankingWriteError) throw new Error(rankingWriteError.message);
    }

    return {
      ok: true as const,
      siteUrl,
      periodStart,
      periodEnd,
      rowsSynced: rankings.length,
      keywordsSynced: uniqueKeywords.length,
      truncated: rows.length === 25000,
    };
  });

export const syncSemrush = createServerFn({ method: "POST" })
  .inputValidator((value) => semrushSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Importing from Semrush");
    // No Semrush client exists here either; "N imported" was one row read.
    throw new Error(`Semrush is not connected, so nothing was imported for ${data.domain}.`);
  });
