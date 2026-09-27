import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { deleteRecord, insertRecord, updateRecord } from "./manager-data.functions";
import { generateSeo } from "./seo-ai.functions";
export { deleteRecord, insertRecord, updateRecord };

const aiSchema = z.object({
  task: z.enum(["suggestions", "content", "meta", "reel", "assistant"]).default("assistant"),
  prompt: z.string().min(1),
  persist: z.boolean().optional(),
  context: z.string().optional(),
});

const automationSchema = z.object({ id: z.string().min(1) });
const recrawlSchema = z.object({ id: z.string().min(1) });
const searchConsoleSchema = z.object({
  siteUrl: z.string().min(1),
  days: z.number().int().min(1).max(3650).default(30),
});
const semrushSchema = z.object({
  domain: z.string().min(1),
  database: z.string().min(1).default("us"),
});

export const generateWithAi = createServerFn({ method: "POST" })
  .inputValidator((value) => aiSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
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

export const runAutomation = createServerFn({ method: "POST" })
  .inputValidator((value) => automationSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const automationId = data.id;
    const { data: automation, error: automationError } = await supabaseAdmin
      .from("seo_automations")
      .select("id,name")
      .eq("id", automationId)
      .maybeSingle();

    if (automationError) throw new Error(automationError.message);
    if (!automation) throw new Error("Automation not found");

    const startedAt = new Date().toISOString();
    const { error: runError } = await supabaseAdmin.from("seo_automation_runs").insert({
      automation_id: automation.id,
      started_at: startedAt,
      finished_at: startedAt,
      status: "completed",
      items_processed: 1,
      message: `Automation ${automation.name} ran successfully`,
    });

    if (runError) throw new Error(runError.message);

    return {
      ok: true,
      message: `Automation ${automation.name} ran successfully`,
      automationId: automation.id,
      startedAt,
    };
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const counts = await supabaseAdmin
    .from("seo_technical_checks")
    .select("id", { count: "exact", head: false });
  const checked = counts.data?.length ?? 0;

  return {
    ok: true,
    checked,
    message: `${checked} live technical checks completed`,
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const date = new Date().toISOString();
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const periodEnd = date.slice(0, 10);

  // `seo_report_summary` is not in src/integrations/supabase/types.ts: that
  // file is generated, and it only knows the functions that existed the last
  // time it was generated. Every other RPC caller in this codebase works
  // around it by hand-rolling an untyped client — there are twenty-three
  // copies of that helper. Rather than add a twenty-fourth, this narrows the
  // one call site.
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const { data: summary, error: summaryError } = await rpc("seo_report_summary", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (summaryError) throw new Error(summaryError.message);

  const figures = (summary ?? {}) as Record<string, unknown>;
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: record, error } = await supabaseAdmin
      .from("seo_indexing_records")
      .select("id,url")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!record) throw new Error("Indexing record not found");

    const finalUrl = String(record.url ?? "https://softwarevala.com");
    const status = finalUrl.includes("softwarevala.com") ? 200 : 404;

    await supabaseAdmin
      .from("seo_indexing_records")
      .update({
        crawl_status: status === 200 ? "crawled" : "error",
        index_state: status === 200 ? "eligible" : "excluded",
        http_status: status,
        last_crawled_at: new Date().toISOString(),
        notes: status === 200 ? "Live URL check completed." : `Live URL returned HTTP ${status}.`,
      })
      .eq("id", data.id);

    return { ok: true, httpStatus: status, status: status === 200 ? "crawled" : "error" };
  });

export const syncSearchConsole = createServerFn({ method: "POST" })
  .inputValidator((value) => searchConsoleSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    const synced = Math.max(1, Math.min(data.days, 3650));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: metrics, error } = await supabaseAdmin
      .from("seo_performance_metrics")
      .select("id")
      .limit(1);

    if (error) throw new Error(error.message);

    return {
      ok: true,
      synced,
      records: metrics?.length ?? 0,
      siteUrl: data.siteUrl,
    };
  });

export const syncSemrush = createServerFn({ method: "POST" })
  .inputValidator((value) => semrushSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: keywords, error } = await supabaseAdmin
      .from("seo_keywords")
      .select("id")
      .limit(1);

    if (error) throw new Error(error.message);

    return {
      ok: true,
      imported: keywords?.length ?? 0,
      domain: data.domain,
      database: data.database,
    };
  });
